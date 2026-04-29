"""
Scan Service — orchestrates MindScan: catalog discovery + AI entity grouping + glossary proposals.
"""
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.scan import (
    CatalogScan,
    ScanProposal,
    DetectedEntity,
    DetectedTable,
    DetectedColumn,
)
from app.models.glossary import GlossaryEntry
from app.models.entity import GlossaryMetric, GlossaryDimension
from app.services import catalog_service, ai_service
from app.services.audit_service import log_activity

logger = logging.getLogger(__name__)


SYNC_TABLE_THRESHOLD = 10  # Scans with more tables than this run as background jobs


def start_scan(
    catalog: str,
    schemas: list[str],
    warehouse_id: str,
    model_endpoint: str,
    created_by: str,
    db: Session,
) -> dict:
    """
    Start a MindScan across one or more schemas.
    ≤10 tables: runs synchronously.
    >10 tables: queued as a background job, returns immediately.
    """
    schema_label = ", ".join(schemas)
    scan = CatalogScan(
        catalog_name=catalog,
        schema_name=schema_label,
        scan_type="schema",
        warehouse_id=warehouse_id,
        model_endpoint=model_endpoint,
        status="scanning",
        status_message="Discovering tables...",
        created_by=created_by,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    log_activity(
        db, action="mindscan.start", module="mindscan", actor=created_by,
        entity_type="scan", entity_id=str(scan.id),
        detail=f"Started MindScan for {catalog} schemas: {schema_label}",
        extra_data={"catalog": catalog, "schemas": schemas, "warehouse_id": warehouse_id, "model_endpoint": model_endpoint},
        source="manual",
    )

    # Quick count: list tables first to decide sync vs async
    from app.services import catalog_service
    total_tables = 0
    for schema in schemas:
        try:
            tables = catalog_service.list_tables(catalog, schema, warehouse_id)
            total_tables += len(tables)
        except Exception:
            pass

    scan.table_count = total_tables
    scan.status_message = f"Found {total_tables} tables. {'Running in background...' if total_tables > SYNC_TABLE_THRESHOLD else 'Processing...'}"
    db.commit()

    if total_tables <= SYNC_TABLE_THRESHOLD:
        # Small scan — run synchronously
        try:
            _execute_scan(scan, catalog, schemas, warehouse_id, model_endpoint, db)
            log_activity(
                db, action="mindscan.complete", module="mindscan", actor="system",
                entity_type="scan", entity_id=str(scan.id),
                detail=f"MindScan complete: {scan.proposal_count} proposals",
                source="system",
            )
            return scan.to_json()
        except Exception as e:
            scan.status = "failed"
            scan.status_message = str(e)[:500]
            db.commit()
            logger.exception(f"MindScan failed for {catalog}.{schema_label}: {e}")
            raise
    else:
        # Large scan — schedule background job
        _schedule_background_scan(
            scan.id, catalog, schemas, warehouse_id, model_endpoint
        )
        return scan.to_json()


def _schedule_background_scan(
    scan_id: int,
    catalog: str,
    schemas: list[str],
    warehouse_id: str,
    model_endpoint: str,
):
    """Schedule a scan as a one-shot background job via APScheduler."""
    from apscheduler.schedulers.background import BackgroundScheduler
    from app.utils.database import SessionLocal

    scheduler = BackgroundScheduler()

    def run_scan_job():
        db = SessionLocal()
        try:
            scan = db.query(CatalogScan).filter(CatalogScan.id == scan_id).first()
            if not scan:
                logger.error(f"Background scan job: scan {scan_id} not found")
                return

            try:
                _execute_scan(scan, catalog, schemas, warehouse_id, model_endpoint, db)
                log_activity(
                    db, action="mindscan.complete", module="mindscan", actor="system",
                    entity_type="scan", entity_id=str(scan.id),
                    detail=f"MindScan complete: {scan.proposal_count} proposals",
                    source="system",
                )
            except Exception as e:
                scan.status = "failed"
                scan.status_message = str(e)[:500]
                db.commit()
                logger.exception(f"Background MindScan failed: {e}")
        finally:
            db.close()
            scheduler.shutdown(wait=False)

    scheduler.add_job(run_scan_job, trigger="date", id=f"mindscan_{scan_id}")
    scheduler.start()
    logger.info(f"[MindScan {scan_id}] Scheduled as background job ({schemas})")


def _execute_scan(
    scan: CatalogScan,
    catalog: str,
    schemas: list[str],
    warehouse_id: str,
    model_endpoint: str,
    db: Session,
):
    """Core scan orchestration: discover → describe → AI group → AI glossary → persist."""

    # Step 1: List tables across all selected schemas
    logger.info(f"[MindScan {scan.id}] Step 1: Listing tables in {catalog} schemas: {schemas}")
    tables = []
    for schema in schemas:
        try:
            schema_tables = catalog_service.list_tables(catalog, schema, warehouse_id)
            tables.extend(schema_tables)
        except Exception as e:
            logger.warning(f"Failed to list tables in {catalog}.{schema}: {e}")

    scan.table_count = len(tables)
    scan.schema_count = len(schemas)
    scan.status_message = f"Found {len(tables)} tables across {len(schemas)} schemas. Describing columns..."
    db.commit()

    if not tables:
        scan.status = "complete"
        scan.status_message = "No tables found in selected schemas"
        scan.completed_at = datetime.now(timezone.utc)
        db.commit()
        return

    # Step 2: Describe each table
    logger.info(f"[MindScan {scan.id}] Step 2: Describing {len(tables)} tables")
    tables_metadata = []
    total_columns = 0
    for t in tables:
        try:
            desc = catalog_service.describe_table(
                catalog, t["schema"], t["table_name"], warehouse_id
            )
            total_columns += len(desc.get("columns", []))
            tables_metadata.append(desc)
        except Exception as e:
            logger.warning(f"Failed to describe {t['table_name']}: {e}")
            tables_metadata.append({
                "catalog": catalog,
                "schema": t["schema"],
                "table_name": t["table_name"],
                "full_name": t["full_name"],
                "columns": [],
            })

    scan.column_count = total_columns
    scan.status_message = f"Described {len(tables_metadata)} tables ({total_columns} columns). AI grouping..."
    db.commit()

    # Step 3: AI entity grouping
    logger.info(f"[MindScan {scan.id}] Step 3: AI entity grouping")
    entity_groups = ai_service.propose_entity_groupings(
        tables_metadata, model_endpoint, warehouse_id
    )

    if not entity_groups:
        # Fallback: use naming convention grouping
        logger.info(f"[MindScan {scan.id}] AI returned no groups, using naming convention fallback")
        entity_groups = _fallback_grouping(tables_metadata)

    scan.entity_count = len(entity_groups)
    scan.status_message = f"AI proposed {len(entity_groups)} entities. Generating glossary..."
    db.commit()

    # Step 4: Persist entities, tables, columns + create proposals
    logger.info(f"[MindScan {scan.id}] Step 4: Persisting entities and generating glossary")
    proposal_count = 0

    for group in entity_groups:
        entity_name = group.get("entity_name", "unknown")
        entity_desc = group.get("description", "")
        group_tables = group.get("tables", [])
        confidence = group.get("confidence_score", 0.7)

        # Create detected entity
        entity = DetectedEntity(
            scan_id=scan.id,
            name=entity_name,
            description=entity_desc,
            entity_type="ai_derived",
            source_hint=f"MindScan of {catalog}.{schema}",
            confidence_score=confidence,
            status="pending",
            pii_flag=False,
        )
        db.add(entity)
        db.flush()

        # Create detected tables + columns
        entity_tables_meta = []
        for full_table_name in group_tables:
            table_meta = next(
                (t for t in tables_metadata if t["full_name"] == full_table_name),
                None,
            )
            if not table_meta:
                # Try matching by table_name only
                tbl_name = full_table_name.split(".")[-1] if "." in full_table_name else full_table_name
                table_meta = next(
                    (t for t in tables_metadata if t["table_name"] == tbl_name),
                    None,
                )
            if not table_meta:
                continue

            entity_tables_meta.append(table_meta)

            detected_table = DetectedTable(
                entity_id=entity.id,
                catalog=table_meta["catalog"],
                schema_name=table_meta["schema"],
                table_name=table_meta["table_name"],
                description="",
                column_count=len(table_meta.get("columns", [])),
                row_count=0,
                status="detected",
            )
            db.add(detected_table)
            db.flush()

            for col in table_meta.get("columns", []):
                detected_col = DetectedColumn(
                    table_id=detected_table.id,
                    column_name=col["name"],
                    data_type=col.get("type", "string"),
                    business_description=col.get("comment", ""),
                    status="ok",
                )
                db.add(detected_col)

        # Create scan proposal
        proposal = ScanProposal(
            scan_id=scan.id,
            entity_id=entity.id,
            proposed_name=entity_name,
            proposed_description=entity_desc,
            table_names=json.dumps(group_tables),
            confidence_score=confidence,
            status="proposed",
        )
        db.add(proposal)
        db.flush()

        # Step 5: AI glossary proposals for this entity
        try:
            glossary_items = ai_service.propose_glossary_entries(
                entity_name, entity_desc, entity_tables_meta, model_endpoint, warehouse_id
            )

            for item in glossary_items:
                entry = GlossaryEntry(
                    proposal_id=proposal.id,
                    entity_id=entity.id,
                    kind=item.get("kind", "definition"),
                    scope=item.get("scope", "column"),
                    target_name=item.get("target_name", ""),
                    name=item.get("name", ""),
                    description=item.get("description", ""),
                    formula=item.get("formula"),
                    source_column=item.get("source_column"),
                    source_table=item.get("source_table"),
                    confidence_score=item.get("confidence_score", 0.7),
                    status="proposed",
                )
                db.add(entry)

        except Exception as e:
            logger.warning(f"Glossary generation failed for entity {entity_name}: {e}")

        proposal_count += 1

    # Step 6: Finalize scan
    scan.proposal_count = proposal_count
    scan.status = "complete"
    scan.status_message = f"Scan complete: {len(entity_groups)} entities, {proposal_count} proposals"
    scan.completed_at = datetime.now(timezone.utc)
    db.commit()
    logger.info(f"[MindScan {scan.id}] Complete: {proposal_count} proposals")


def _fallback_grouping(tables_metadata: list[dict]) -> list[dict]:
    """Group tables by naming convention when AI returns no results."""
    from app.api.scan_route import _infer_entity_name

    groups: dict[str, list[str]] = {}
    for t in tables_metadata:
        entity_name = _infer_entity_name(t["schema"], t["table_name"])
        groups.setdefault(entity_name, [])
        groups[entity_name].append(t["full_name"])

    return [
        {
            "entity_name": name,
            "description": f"Auto-grouped entity from naming convention",
            "tables": tbls,
            "confidence_score": 0.5,
        }
        for name, tbls in groups.items()
    ]


def recover_stuck_scans(db: Session) -> int:
    """Mark any 'scanning' scans as failed — called on startup to recover from server restarts."""
    stuck = db.query(CatalogScan).filter(CatalogScan.status == "scanning").all()
    for scan in stuck:
        scan.status = "failed"
        scan.status_message = "Server restarted during scan. Please retry."
        logger.warning(f"[MindScan {scan.id}] Marked as failed (stuck after restart)")
    if stuck:
        db.commit()
    return len(stuck)


def get_scan_status(scan_id: int, db: Session) -> dict:
    """Get current scan status and progress."""
    scan = db.query(CatalogScan).filter(CatalogScan.id == scan_id).first()
    if not scan:
        return None
    return scan.to_json()


def get_scan_proposals(scan_id: int, db: Session) -> list[dict]:
    """Get all proposals for a scan with nested glossary entries."""
    proposals = (
        db.query(ScanProposal)
        .filter(ScanProposal.scan_id == scan_id)
        .order_by(ScanProposal.confidence_score.desc())
        .all()
    )
    return [p.to_json() for p in proposals]


def accept_proposal(
    scan_id: int,
    proposal_id: int,
    edits: dict | None,
    reviewed_by: str,
    db: Session,
) -> dict:
    """Accept a scan proposal — persists entity + materializes glossary entries."""
    proposal = (
        db.query(ScanProposal)
        .filter(ScanProposal.id == proposal_id, ScanProposal.scan_id == scan_id)
        .first()
    )
    if not proposal:
        return None

    # Apply edits if provided
    if edits:
        if edits.get("name"):
            proposal.proposed_name = edits["name"]
        if edits.get("description"):
            proposal.proposed_description = edits["description"]

    # Update entity
    entity = db.query(DetectedEntity).filter(DetectedEntity.id == proposal.entity_id).first()
    if entity:
        entity.name = proposal.proposed_name
        entity.description = proposal.proposed_description
        entity.status = "approved"
        entity.updated_at = datetime.now(timezone.utc)

    # Update proposal
    proposal.status = "accepted"
    proposal.reviewed_by = reviewed_by
    proposal.reviewed_at = datetime.now(timezone.utc)

    # Materialize glossary entries into GlossaryMetric / GlossaryDimension
    for entry in proposal.glossary_entries:
        if entry.status == "rejected":
            continue
        entry.status = "accepted"
        entry.entity_id = entity.id if entity else proposal.entity_id

        if entry.kind == "metric" and entity:
            metric = GlossaryMetric(
                entity_id=entity.id,
                name=entry.name,
                metric_type="metric",
                description=entry.description,
                formula=entry.formula,
                backing_table=entry.source_table,
                confidence_score=entry.confidence_score,
                status="proposed",
            )
            db.add(metric)

        elif entry.kind == "dimension" and entity:
            dimension = GlossaryDimension(
                entity_id=entity.id,
                name=entry.name,
                description=entry.description,
                source_column=entry.source_column,
                source_table=entry.source_table,
                confidence_score=entry.confidence_score,
                status="proposed",
            )
            db.add(dimension)

    log_activity(
        db, action="proposal.accept", module="mindscan", actor=reviewed_by,
        entity_type="proposal", entity_id=str(proposal.id),
        detail=f"Accepted entity proposal: {proposal.proposed_name}",
        extra_data={"entity_id": proposal.entity_id, "glossary_count": len(proposal.glossary_entries)},
        source="manual",
    )

    db.commit()
    db.refresh(proposal)
    return proposal.to_json()


def reject_proposal(
    scan_id: int,
    proposal_id: int,
    notes: str | None,
    reviewed_by: str,
    db: Session,
) -> dict:
    """Reject a scan proposal."""
    proposal = (
        db.query(ScanProposal)
        .filter(ScanProposal.id == proposal_id, ScanProposal.scan_id == scan_id)
        .first()
    )
    if not proposal:
        return None

    proposal.status = "rejected"
    proposal.review_notes = notes
    proposal.reviewed_by = reviewed_by
    proposal.reviewed_at = datetime.now(timezone.utc)

    # Reject the entity too
    entity = db.query(DetectedEntity).filter(DetectedEntity.id == proposal.entity_id).first()
    if entity:
        entity.status = "rejected"
        entity.updated_at = datetime.now(timezone.utc)

    # Reject all glossary entries
    for entry in proposal.glossary_entries:
        entry.status = "rejected"

    log_activity(
        db, action="proposal.reject", module="mindscan", actor=reviewed_by,
        entity_type="proposal", entity_id=str(proposal.id),
        detail=f"Rejected entity proposal: {proposal.proposed_name}",
        extra_data={"notes": notes},
        source="manual",
    )

    db.commit()
    db.refresh(proposal)
    return proposal.to_json()
