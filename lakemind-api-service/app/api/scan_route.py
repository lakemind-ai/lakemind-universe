import json
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.utils.app_db import get_db
from app.models.scan import CatalogScan, ScanProposal, DetectedEntity, DetectedTable, DetectedColumn
from app.services import scan_service

import logging
logger = logging.getLogger(__name__)

scan_router = APIRouter(tags=["Scan API"], prefix="/scan")


# ── MindScan Schemas ─────────────────────────────────────────────────────────

class MindScanRequest(BaseModel):
    catalog: str
    schema_names: list[str]
    warehouse_id: str
    model_endpoint: str


class ProposalAcceptRequest(BaseModel):
    edits: Optional[dict] = None


class ProposalRejectRequest(BaseModel):
    notes: Optional[str] = None


# ── MindScan Endpoints ───────────────────────────────────────────────────────

@scan_router.post("/mindscan/start")
def start_mindscan(payload: MindScanRequest, db: Session = Depends(get_db)):
    """Start a MindScan: AI-powered schema analysis with entity grouping and glossary proposals."""
    try:
        result = scan_service.start_scan(
            catalog=payload.catalog,
            schemas=payload.schema_names,
            warehouse_id=payload.warehouse_id,
            model_endpoint=payload.model_endpoint,
            created_by="user",
            db=db,
        )
        return {"status": "ok", "data": result}
    except Exception as e:
        logger.error(f"MindScan start failed: {e}")
        raise HTTPException(status_code=500, detail=f"MindScan failed: {str(e)}")


@scan_router.get("/mindscan/{scan_id}/status")
def get_mindscan_status(scan_id: int, db: Session = Depends(get_db)):
    """Get current MindScan status and progress."""
    result = scan_service.get_scan_status(scan_id, db)
    if not result:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {"status": "ok", "data": result}


@scan_router.get("/mindscan/{scan_id}/proposals")
def get_mindscan_proposals(scan_id: int, db: Session = Depends(get_db)):
    """Get all AI proposals for a MindScan with nested glossary entries."""
    proposals = scan_service.get_scan_proposals(scan_id, db)
    return {"status": "ok", "data": proposals}


@scan_router.post("/mindscan/{scan_id}/proposals/{proposal_id}/accept")
def accept_mindscan_proposal(
    scan_id: int,
    proposal_id: int,
    payload: ProposalAcceptRequest = ProposalAcceptRequest(),
    db: Session = Depends(get_db),
):
    """Accept a MindScan proposal — persists entity and materializes glossary entries."""
    result = scan_service.accept_proposal(
        scan_id=scan_id,
        proposal_id=proposal_id,
        edits=payload.edits,
        reviewed_by="user",
        db=db,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return {"status": "ok", "data": result}


@scan_router.post("/mindscan/{scan_id}/proposals/{proposal_id}/reject")
def reject_mindscan_proposal(
    scan_id: int,
    proposal_id: int,
    payload: ProposalRejectRequest = ProposalRejectRequest(),
    db: Session = Depends(get_db),
):
    """Reject a MindScan proposal."""
    result = scan_service.reject_proposal(
        scan_id=scan_id,
        proposal_id=proposal_id,
        notes=payload.notes,
        reviewed_by="user",
        db=db,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return {"status": "ok", "data": result}

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
if DATABRICKS_HOST and not DATABRICKS_HOST.startswith(("http://", "https://")):
    DATABRICKS_HOST = f"https://{DATABRICKS_HOST}"


# ── Scan Triggers ────────────────────────────────────────────────────────────

@scan_router.post("/catalogs/{catalog}/scan")
def trigger_catalog_scan(catalog: str, db: Session = Depends(get_db)):
    """
    Trigger a full scan of a Unity Catalog catalog.
    Reads all schemas, tables, and columns via Databricks SQL connector.
    Groups tables into entities using naming conventions and AI heuristics.
    """
    scan = CatalogScan(
        catalog_name=catalog,
        status="scanning",
        created_by="user",
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    try:
        from databricks import sql as dbsql

        http_path = os.getenv("DATABRICKS_HTTP_PATH", "")
        token = os.getenv("DATABRICKS_TOKEN", "")
        host = DATABRICKS_HOST.replace("https://", "").replace("http://", "")

        schema_count = 0
        table_count = 0
        column_count = 0

        with dbsql.connect(
            server_hostname=host,
            http_path=http_path,
            access_token=token,
        ) as conn:
            with conn.cursor() as cursor:
                # Get all schemas
                cursor.execute(f"SHOW SCHEMAS IN `{catalog}`")
                schemas = [row[0] for row in cursor.fetchall()]
                schema_count = len(schemas)

                for schema_name in schemas:
                    if schema_name in ("information_schema", "default"):
                        continue

                    # Get all tables in this schema
                    try:
                        cursor.execute(f"SHOW TABLES IN `{catalog}`.`{schema_name}`")
                        tables = cursor.fetchall()
                    except Exception as e:
                        logger.warning(f"Skipping schema {schema_name}: {e}")
                        continue

                    for table_row in tables:
                        tbl_name = table_row[1] if len(table_row) > 1 else table_row[0]
                        table_count += 1

                        # Detect entity from table naming convention
                        entity_name = _infer_entity_name(schema_name, tbl_name)

                        # Find or create entity for this scan
                        entity = db.query(DetectedEntity).filter(
                            DetectedEntity.scan_id == scan.id,
                            DetectedEntity.name == entity_name,
                        ).first()
                        if not entity:
                            entity = DetectedEntity(
                                scan_id=scan.id,
                                name=entity_name,
                                description=f"Auto-detected entity from {schema_name}",
                                entity_type="ai_derived",
                                source_hint=f"from schema {schema_name}",
                                confidence_score=0.7,
                                status="pending",
                                pii_flag=False,
                            )
                            db.add(entity)
                            db.flush()

                        # Create detected table
                        detected_table = DetectedTable(
                            entity_id=entity.id,
                            catalog=catalog,
                            schema_name=schema_name,
                            table_name=tbl_name,
                            description="",
                            column_count=0,
                            row_count=0,
                            status="detected",
                        )
                        db.add(detected_table)
                        db.flush()

                        # Get columns for this table
                        try:
                            full_table = f"`{catalog}`.`{schema_name}`.`{tbl_name}`"
                            cursor.execute(f"DESCRIBE {full_table}")
                            columns = cursor.fetchall()

                            col_count_for_table = 0
                            for col in columns:
                                col_name = col[0]
                                col_type = col[1] if len(col) > 1 else "string"
                                if col_name.startswith("#"):
                                    continue

                                col_count_for_table += 1
                                column_count += 1

                                detected_col = DetectedColumn(
                                    table_id=detected_table.id,
                                    column_name=col_name,
                                    data_type=col_type,
                                    null_rate=None,
                                    distinct_count=None,
                                    sample_values=None,
                                    business_name=None,
                                    business_description=None,
                                    confidence_score=None,
                                    status="ok",
                                )
                                db.add(detected_col)

                            detected_table.column_count = col_count_for_table

                        except Exception as e:
                            logger.warning(f"Column scan failed for {tbl_name}: {e}")

        # Update scan summary
        entity_count = db.query(DetectedEntity).filter(
            DetectedEntity.scan_id == scan.id
        ).count()

        scan.schema_count = schema_count
        scan.table_count = table_count
        scan.column_count = column_count
        scan.entity_count = entity_count
        scan.status = "complete"
        scan.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(scan)

        return {"status": "ok", "data": scan.to_json()}

    except Exception as e:
        scan.status = "failed"
        db.commit()
        logger.error(f"Catalog scan failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")


def _infer_entity_name(schema_name: str, table_name: str) -> str:
    """
    Infer entity name from table naming conventions.
    E.g., 'dim_customer' -> 'customer', 'fact_orders' -> 'orders',
    'stg_payments' -> 'payments'.
    """
    prefixes = ("dim_", "fact_", "stg_", "raw_", "silver_", "gold_", "bronze_")
    name = table_name.lower()
    for prefix in prefixes:
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    # Remove common suffixes
    suffixes = ("_history", "_snapshot", "_latest", "_v2", "_v1")
    for suffix in suffixes:
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    return name


# ── Scan Listings ────────────────────────────────────────────────────────────

@scan_router.get("/scans")
def list_scans(db: Session = Depends(get_db)):
    scans = db.query(CatalogScan).order_by(CatalogScan.created_at.desc()).all()
    return {"status": "ok", "data": [s.to_json() for s in scans]}


@scan_router.get("/scans/{scan_id}")
def get_scan(scan_id: int, db: Session = Depends(get_db)):
    scan = db.query(CatalogScan).filter(CatalogScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    data = scan.to_json()
    entities = db.query(DetectedEntity).filter(DetectedEntity.scan_id == scan_id).all()
    data["entities"] = [e.to_json() for e in entities]
    return {"status": "ok", "data": data}


@scan_router.post("/scans/{scan_id}/rescan")
def rescan_catalog(scan_id: int, db: Session = Depends(get_db)):
    """Re-trigger a scan for the same catalog."""
    scan = db.query(CatalogScan).filter(CatalogScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    # Delegate to trigger_catalog_scan with the same catalog name
    return trigger_catalog_scan(catalog=scan.catalog_name, db=db)


@scan_router.get("/scans/{scan_id}/entities")
def get_scan_entities(scan_id: int, db: Session = Depends(get_db)):
    """Get all detected entities for a scan with their tables and columns."""
    scan = db.query(CatalogScan).filter(CatalogScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    entities = db.query(DetectedEntity).filter(DetectedEntity.scan_id == scan_id).all()
    result = []
    for entity in entities:
        entity_data = entity.to_json()
        tables = db.query(DetectedTable).filter(DetectedTable.entity_id == entity.id).all()
        entity_data["tables"] = []
        for table in tables:
            table_data = table.to_json()
            columns = db.query(DetectedColumn).filter(DetectedColumn.table_id == table.id).all()
            table_data["columns"] = [c.to_json() for c in columns]
            entity_data["tables"].append(table_data)
        result.append(entity_data)

    return {"status": "ok", "data": result}
