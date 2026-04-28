"""
Chronicle Service — per-realm versioning, diff, and Genie publishing.
"""
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.realm import Realm, RealmEntity
from app.models.scan import DetectedEntity
from app.models.entity import GlossaryMetric, GlossaryDimension
from app.models.glossary import GlossaryVersion, VersionChange, AuditEntry
from app.services.audit_service import log_activity

logger = logging.getLogger(__name__)


def _build_glossary_snapshot(realm_id: int, db: Session) -> list[dict]:
    """Build a full glossary snapshot for a realm — all approved metrics and dimensions."""
    entity_ids = [
        re.entity_id for re in db.query(RealmEntity).filter(RealmEntity.realm_id == realm_id).all()
    ]
    if not entity_ids:
        return []

    snapshot = []

    for entity in db.query(DetectedEntity).filter(DetectedEntity.id.in_(entity_ids)).all():
        metrics = db.query(GlossaryMetric).filter(
            GlossaryMetric.entity_id == entity.id,
            GlossaryMetric.status != "rejected",
        ).all()
        dimensions = db.query(GlossaryDimension).filter(
            GlossaryDimension.entity_id == entity.id,
            GlossaryDimension.status != "rejected",
        ).all()

        for m in metrics:
            snapshot.append({
                "kind": "metric",
                "entity": entity.name,
                "name": m.name,
                "description": m.description or "",
                "formula": m.formula or "",
                "backing_table": m.backing_table or "",
            })
        for d in dimensions:
            snapshot.append({
                "kind": "dimension",
                "entity": entity.name,
                "name": d.name,
                "description": d.description or "",
                "source_column": d.source_column or "",
                "source_table": d.source_table or "",
            })

    # Include accepted glossary entries (definitions, plus any metrics/dimensions from MindScan)
    from app.models.glossary import GlossaryEntry
    gl_entries = db.query(GlossaryEntry).filter(
        GlossaryEntry.entity_id.in_(entity_ids),
        GlossaryEntry.status != "rejected",
    ).all()
    for g in gl_entries:
        entity = db.query(DetectedEntity).filter(DetectedEntity.id == g.entity_id).first()
        snapshot.append({
            "kind": g.kind,
            "entity": entity.name if entity else "",
            "name": g.name,
            "description": g.description or "",
            "formula": g.formula or "",
            "source_column": g.source_column or "",
            "source_table": g.source_table or "",
        })

    # Deduplicate by (kind, entity, name) — metrics/dimensions may exist in both
    # the dedicated tables and the unified GlossaryEntry table
    seen = set()
    deduped = []
    for item in snapshot:
        key = (item["kind"], item["entity"], item["name"])
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    return deduped


def _build_genie_instructions(realm: Realm, snapshot: list[dict], db: Session) -> str:
    """Build Genie-compatible instruction text from a glossary snapshot."""
    entity_ids = [re.entity_id for re in realm.entities]
    entities = db.query(DetectedEntity).filter(DetectedEntity.id.in_(entity_ids)).all()

    lines = []

    # Entity descriptions
    for e in entities:
        if e.description:
            lines.append(f"Entity: {e.name} — {e.description}")

    # Metrics
    metrics = [s for s in snapshot if s["kind"] == "metric"]
    if metrics:
        lines.append("")
        lines.append("Business Metrics:")
        for m in metrics:
            lines.append(f"  - {m['name']} = {m['formula']} ({m['description']})")

    # Dimensions
    dimensions = [s for s in snapshot if s["kind"] == "dimension"]
    if dimensions:
        lines.append("")
        lines.append("Dimensions for filtering/grouping:")
        for d in dimensions:
            col_ref = f"{d['source_table']}.{d['source_column']}" if d["source_table"] else d["source_column"]
            lines.append(f"  - {d['name']} (column: {col_ref}) — {d['description']}")

    # Table relationships
    lines.append("")
    lines.append("Table relationships:")
    lines.append("  - customer.c_custkey = orders.o_custkey")
    lines.append("  - orders.o_orderkey = lineitem.l_orderkey")
    lines.append("  - lineitem.l_partkey = part.p_partkey")
    lines.append("  - lineitem.l_suppkey = supplier.s_suppkey")
    lines.append("  - partsupp.ps_partkey = part.p_partkey AND partsupp.ps_suppkey = supplier.s_suppkey")
    lines.append("  - customer.c_nationkey = nation.n_nationkey")
    lines.append("  - supplier.s_nationkey = nation.n_nationkey")
    lines.append("  - nation.n_regionkey = region.r_regionkey")

    return "\n".join(lines)


def _compute_diff(old_snapshot: list[dict], new_snapshot: list[dict]) -> list[dict]:
    """Compute diff between two glossary snapshots."""
    old_map = {(s["kind"], s["entity"], s["name"]): s for s in old_snapshot}
    new_map = {(s["kind"], s["entity"], s["name"]): s for s in new_snapshot}

    changes = []

    # Added
    for key, item in new_map.items():
        if key not in old_map:
            changes.append({
                "change_type": "added",
                "kind": item["kind"],
                "entity": item["entity"],
                "name": item["name"],
                "new_value": json.dumps(item),
            })

    # Removed
    for key, item in old_map.items():
        if key not in new_map:
            changes.append({
                "change_type": "removed",
                "kind": item["kind"],
                "entity": item["entity"],
                "name": item["name"],
                "old_value": json.dumps(item),
            })

    # Modified
    for key in old_map:
        if key in new_map and old_map[key] != new_map[key]:
            changes.append({
                "change_type": "modified",
                "kind": old_map[key]["kind"],
                "entity": old_map[key]["entity"],
                "name": old_map[key]["name"],
                "old_value": json.dumps(old_map[key]),
                "new_value": json.dumps(new_map[key]),
            })

    return changes


def list_versions(realm_id: int, db: Session) -> list[dict]:
    """List all versions for a realm."""
    versions = db.query(GlossaryVersion).filter(
        GlossaryVersion.description.like(f"realm:{realm_id}:%")
    ).order_by(GlossaryVersion.version_number.desc()).all()

    # Also include versions linked via realm_id in changes_summary
    if not versions:
        versions = db.query(GlossaryVersion).order_by(
            GlossaryVersion.version_number.desc()
        ).all()
        versions = [v for v in versions if v.changes_summary and f'"realm_id": {realm_id}' in (v.changes_summary or "")]

    return [v.to_json() for v in versions]


def _get_last_published_snapshot(realm_id: int, db: Session) -> list[dict]:
    """Get the snapshot from the last published version for this realm."""
    published = db.query(GlossaryVersion).filter(
        GlossaryVersion.description.like(f"realm:{realm_id}:%"),
        GlossaryVersion.status == "published",
    ).order_by(GlossaryVersion.version_number.desc()).first()

    if not published or not published.changes_summary:
        return []

    try:
        return json.loads(published.changes_summary).get("snapshot", [])
    except json.JSONDecodeError:
        return []


def _get_existing_draft(realm_id: int, db: Session) -> GlossaryVersion | None:
    """Find an existing draft version for a realm (only one allowed at a time)."""
    return db.query(GlossaryVersion).filter(
        GlossaryVersion.description.like(f"realm:{realm_id}:%"),
        GlossaryVersion.status == "draft",
    ).first()


def _apply_snapshot_to_version(
    version: GlossaryVersion,
    realm: Realm,
    realm_id: int,
    snapshot: list[dict],
    diff: list[dict],
    actor: str,
    db: Session,
):
    """Update a version record with a new snapshot, diff, and genie instructions."""
    version.changes_summary = json.dumps({
        "realm_id": realm_id,
        "realm_name": realm.name,
        "snapshot": snapshot,
        "diff": diff,
        "genie_instructions": _build_genie_instructions(realm, snapshot, db),
    })
    version.entities_added = len([d for d in diff if d["change_type"] == "added"])
    version.entities_modified = len([d for d in diff if d["change_type"] == "modified"])
    version.entities_removed = len([d for d in diff if d["change_type"] == "removed"])

    # Replace change records
    db.query(VersionChange).filter(VersionChange.version_id == version.id).delete()
    for change in diff:
        db.add(VersionChange(
            version_id=version.id,
            change_type=change["change_type"],
            entity_name=change.get("entity", ""),
            item_name=change.get("name", ""),
            item_type=change.get("kind", ""),
            old_value=change.get("old_value"),
            new_value=change.get("new_value"),
            changed_by=actor,
        ))


def create_version(realm_id: int, actor: str, db: Session) -> dict:
    """
    Create a new draft version for a realm, or return the existing draft.
    Only one draft per realm is allowed (like a PR).
    Diffs against the last published version.
    """
    realm = db.query(Realm).filter(Realm.id == realm_id).first()
    if not realm:
        return None

    # Check for existing draft — return it instead of creating a duplicate
    existing = _get_existing_draft(realm_id, db)
    if existing:
        return existing.to_json()

    # Build snapshot and diff against last published version
    snapshot = _build_glossary_snapshot(realm_id, db)
    prev_snapshot = _get_last_published_snapshot(realm_id, db)
    diff = _compute_diff(prev_snapshot, snapshot)

    # Determine version number
    all_versions = list_versions(realm_id, db)
    latest_num = max([v.get("version_number", 0) for v in all_versions], default=0) if all_versions else 0
    new_num = latest_num + 1

    # Create version
    version = GlossaryVersion(
        version_number=new_num,
        status="draft",
        description=f"realm:{realm_id}:{realm.name}",
        created_by=actor,
    )
    db.add(version)
    db.flush()

    _apply_snapshot_to_version(version, realm, realm_id, snapshot, diff, actor, db)

    # Update realm
    realm.latest_version = new_num

    log_activity(
        db, action="chronicle.create_version", module="chronicle", actor=actor,
        entity_type="version", entity_id=str(version.id),
        detail=f"Created version v{new_num} for realm '{realm.name}' ({len(snapshot)} entries, {len(diff)} changes)",
        source="manual",
    )

    db.commit()
    db.refresh(version)
    return version.to_json()


def delete_version(version_id: int, db: Session) -> str | None:
    """
    Delete a draft version and its related records.
    Returns an error message string on failure, or None on success.
    """
    version = db.query(GlossaryVersion).filter(GlossaryVersion.id == version_id).first()
    if not version:
        return "not_found"
    if version.status == "published":
        return "cannot_delete_published"

    db.query(VersionChange).filter(VersionChange.version_id == version_id).delete()
    db.query(AuditEntry).filter(AuditEntry.version_id == version_id).delete()
    db.delete(version)
    db.commit()
    return None


def refresh_version(version_id: int, actor: str, db: Session) -> dict:
    """
    Refresh an existing draft version — re-snapshot the glossary and recompute diff
    against the last published version. Like refreshing a PR diff.
    """
    version = db.query(GlossaryVersion).filter(GlossaryVersion.id == version_id).first()
    if not version or version.status != "draft":
        return None

    # Parse realm_id from description
    try:
        realm_id = int(version.description.split(":")[1])
    except (IndexError, ValueError):
        return None

    realm = db.query(Realm).filter(Realm.id == realm_id).first()
    if not realm:
        return None

    # Re-snapshot and diff against last published
    snapshot = _build_glossary_snapshot(realm_id, db)
    prev_snapshot = _get_last_published_snapshot(realm_id, db)
    diff = _compute_diff(prev_snapshot, snapshot)

    _apply_snapshot_to_version(version, realm, realm_id, snapshot, diff, actor, db)

    log_activity(
        db, action="chronicle.refresh_version", module="chronicle", actor=actor,
        entity_type="version", entity_id=str(version.id),
        detail=f"Refreshed version v{version.version_number} for realm '{realm.name}' ({len(snapshot)} entries, {len(diff)} changes)",
        source="manual",
    )

    db.commit()
    db.refresh(version)
    return version.to_json()


def get_version(version_id: int, db: Session) -> dict | None:
    """Get a version with full details including diff and Genie instructions."""
    version = db.query(GlossaryVersion).filter(GlossaryVersion.id == version_id).first()
    if not version:
        return None

    data = version.to_json()

    # Parse changes_summary for structured data
    if version.changes_summary:
        try:
            summary = json.loads(version.changes_summary)
            data["realm_id"] = summary.get("realm_id")
            data["realm_name"] = summary.get("realm_name")
            data["snapshot"] = summary.get("snapshot", [])
            data["diff"] = summary.get("diff", [])
            data["genie_instructions"] = summary.get("genie_instructions", "")
        except json.JSONDecodeError:
            pass

    # Get change records
    changes = db.query(VersionChange).filter(VersionChange.version_id == version_id).all()
    data["changes"] = [c.to_json() for c in changes]

    # Get audit trail
    audits = db.query(AuditEntry).filter(AuditEntry.version_id == version_id).all()
    data["audit_trail"] = [a.to_json() for a in audits]

    return data


def publish_version(
    version_id: int,
    actor: str,
    db: Session,
) -> dict:
    """
    Publish a version — creates/updates a Genie space with the glossary instructions.
    Returns the published version data including Genie space info.
    """
    version = db.query(GlossaryVersion).filter(GlossaryVersion.id == version_id).first()
    if not version:
        return None

    # Parse the summary
    summary = {}
    if version.changes_summary:
        try:
            summary = json.loads(version.changes_summary)
        except json.JSONDecodeError:
            pass

    realm_id = summary.get("realm_id")
    realm = db.query(Realm).filter(Realm.id == realm_id).first() if realm_id else None

    genie_instructions = summary.get("genie_instructions", "")
    snapshot = summary.get("snapshot", [])

    # Get table identifiers from realm entities
    table_identifiers = []
    if realm:
        entity_ids = [re.entity_id for re in realm.entities]
        from app.models.scan import DetectedTable
        tables = db.query(DetectedTable).filter(
            DetectedTable.entity_id.in_(entity_ids)
        ).all()
        table_identifiers = list(set(
            f"{t.catalog}.{t.schema_name}.{t.table_name}" for t in tables
        ))

    # Update version status
    version.status = "published"
    version.published_by = actor
    version.published_at = datetime.now(timezone.utc)

    # Update realm status
    if realm:
        realm.status = "published"

    # Add audit entry
    audit = AuditEntry(
        version_id=version.id,
        action="published",
        actor=actor,
        detail=f"Published v{version.version_number} with {len(snapshot)} glossary entries",
        source="manual",
    )
    db.add(audit)

    log_activity(
        db, action="chronicle.publish", module="chronicle", actor=actor,
        entity_type="version", entity_id=str(version.id),
        detail=f"Published v{version.version_number} for realm '{realm.name if realm else 'unknown'}'",
        source="manual",
    )

    db.commit()
    db.refresh(version)

    result = version.to_json()
    result["genie_instructions"] = genie_instructions
    result["table_identifiers"] = table_identifiers
    result["realm_name"] = realm.name if realm else ""
    return result


def create_genie_from_version(
    version_id: int,
    warehouse_id: str,
    token: str,
    db: Session,
) -> dict | None:
    """
    Create a Databricks Genie space from a published version.
    Uses the user's token for Databricks API authorization.
    """
    from app.services.genie_service import create_genie_space

    version = db.query(GlossaryVersion).filter(GlossaryVersion.id == version_id).first()
    if not version or version.status != "published":
        return None

    summary = {}
    if version.changes_summary:
        try:
            summary = json.loads(version.changes_summary)
        except json.JSONDecodeError:
            pass

    realm_id = summary.get("realm_id")
    realm_name = summary.get("realm_name", "")
    instructions = summary.get("genie_instructions", "")
    snapshot = summary.get("snapshot", [])

    # Get table identifiers
    table_identifiers = []
    if realm_id:
        realm = db.query(Realm).filter(Realm.id == realm_id).first()
        if realm:
            entity_ids = [re.entity_id for re in realm.entities]
            tables = db.query(DetectedEntity).filter(DetectedEntity.id.in_(entity_ids)).all()
            from app.models.scan import DetectedTable
            db_tables = db.query(DetectedTable).filter(
                DetectedTable.entity_id.in_(entity_ids)
            ).all()
            table_identifiers = list(set(
                f"{t.catalog}.{t.schema_name}.{t.table_name}" for t in db_tables
            ))

    display_name = f"LakeMind — {realm_name} (v{version.version_number})"
    description = f"Powered by LakeMind glossary v{version.version_number} · {len(snapshot)} entries"

    result = create_genie_space(
        display_name=display_name,
        description=description,
        table_identifiers=table_identifiers,
        warehouse_id=warehouse_id,
        token=token,
        instructions=instructions,
    )

    if "error" not in result:
        # Persist Genie space ID on the realm
        realm = db.query(Realm).filter(Realm.id == realm_id).first()
        if realm:
            realm.genie_workspace_id = result.get("space_id")
            realm.genie_workspace_name = display_name

        log_activity(
            db, action="chronicle.create_genie", module="chronicle", actor="user",
            entity_type="version", entity_id=str(version.id),
            detail=f"Created Genie space '{display_name}' (space_id: {result.get('space_id')})",
            source="manual",
        )
        db.commit()

    return result
