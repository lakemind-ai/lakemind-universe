import json
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.utils.app_db import get_db
from app.models.scan import DetectedEntity, DetectedTable, DetectedColumn
from app.models.entity import GlossaryMetric, GlossaryDimension, GenieInstruction

import logging
logger = logging.getLogger(__name__)

entity_router = APIRouter(tags=["Entity API"], prefix="/entity")

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
if DATABRICKS_HOST and not DATABRICKS_HOST.startswith(("http://", "https://")):
    DATABRICKS_HOST = f"https://{DATABRICKS_HOST}"


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class EntityUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class MetricCreate(BaseModel):
    name: str
    metric_type: Optional[str] = "metric"
    description: Optional[str] = None
    formula: Optional[str] = None
    backing_table: Optional[str] = None


class MetricUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    formula: Optional[str] = None
    confidence_score: Optional[float] = None
    status: Optional[str] = None


class DimensionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    source_column: Optional[str] = None
    source_table: Optional[str] = None


class DimensionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    source_column: Optional[str] = None
    source_table: Optional[str] = None
    confidence_score: Optional[float] = None
    status: Optional[str] = None


# ── Entities ─────────────────────────────────────────────────────────────────

@entity_router.get("/entities")
def list_entities(db: Session = Depends(get_db)):
    entities = db.query(DetectedEntity).order_by(DetectedEntity.created_at.desc()).all()
    return {"status": "ok", "data": [e.to_json() for e in entities]}


@entity_router.get("/entities/{entity_id}")
def get_entity(entity_id: int, db: Session = Depends(get_db)):
    entity = db.query(DetectedEntity).filter(DetectedEntity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    data = entity.to_json()

    # Include tables and columns
    tables = db.query(DetectedTable).filter(DetectedTable.entity_id == entity_id).all()
    data["tables"] = []
    for table in tables:
        table_data = table.to_json()
        columns = db.query(DetectedColumn).filter(DetectedColumn.table_id == table.id).all()
        table_data["columns"] = [c.to_json() for c in columns]
        data["tables"].append(table_data)

    # Include metrics and dimensions
    data["metrics"] = [
        m.to_json() for m in
        db.query(GlossaryMetric).filter(GlossaryMetric.entity_id == entity_id).all()
    ]
    data["dimensions"] = [
        d.to_json() for d in
        db.query(GlossaryDimension).filter(GlossaryDimension.entity_id == entity_id).all()
    ]

    return {"status": "ok", "data": data}


@entity_router.patch("/entities/{entity_id}")
def update_entity(entity_id: int, payload: EntityUpdate, db: Session = Depends(get_db)):
    entity = db.query(DetectedEntity).filter(DetectedEntity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    if payload.name is not None:
        entity.name = payload.name
    if payload.description is not None:
        entity.description = payload.description
    if payload.status is not None:
        entity.status = payload.status
    entity.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(entity)
    return {"status": "ok", "data": entity.to_json()}


@entity_router.post("/entities/{entity_id}/approve")
def approve_entity(entity_id: int, db: Session = Depends(get_db)):
    entity = db.query(DetectedEntity).filter(DetectedEntity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    entity.status = "approved"
    entity.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(entity)
    return {"status": "ok", "message": "Entity approved", "data": entity.to_json()}


# ── Metrics ──────────────────────────────────────────────────────────────────

@entity_router.get("/entities/{entity_id}/metrics")
def get_entity_metrics(entity_id: int, db: Session = Depends(get_db)):
    metrics = db.query(GlossaryMetric).filter(GlossaryMetric.entity_id == entity_id).all()
    return {"status": "ok", "data": [m.to_json() for m in metrics]}


@entity_router.post("/entities/{entity_id}/metrics")
def create_metric(entity_id: int, payload: MetricCreate, db: Session = Depends(get_db)):
    entity = db.query(DetectedEntity).filter(DetectedEntity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    metric = GlossaryMetric(
        entity_id=entity_id,
        name=payload.name,
        metric_type=payload.metric_type or "metric",
        description=payload.description,
        formula=payload.formula,
        backing_table=payload.backing_table,
        confidence_score=1.0,
        status="proposed",
    )
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return {"status": "ok", "data": metric.to_json()}


@entity_router.patch("/metrics/{metric_id}")
def update_metric(metric_id: int, payload: MetricUpdate, db: Session = Depends(get_db)):
    metric = db.query(GlossaryMetric).filter(GlossaryMetric.id == metric_id).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    if payload.name is not None:
        metric.name = payload.name
    if payload.description is not None:
        metric.description = payload.description
    if payload.formula is not None:
        metric.formula = payload.formula
    if payload.confidence_score is not None:
        metric.confidence_score = payload.confidence_score
    if payload.status is not None:
        metric.status = payload.status
    metric.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(metric)
    return {"status": "ok", "data": metric.to_json()}


@entity_router.post("/metrics/{metric_id}/approve")
def approve_metric(metric_id: int, db: Session = Depends(get_db)):
    metric = db.query(GlossaryMetric).filter(GlossaryMetric.id == metric_id).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    metric.status = "approved"
    metric.approved_by = "steward"
    metric.approved_at = datetime.now(timezone.utc)
    metric.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(metric)
    return {"status": "ok", "message": "Metric approved", "data": metric.to_json()}


# ── Dimensions ───────────────────────────────────────────────────────────────

@entity_router.get("/entities/{entity_id}/dimensions")
def get_entity_dimensions(entity_id: int, db: Session = Depends(get_db)):
    dimensions = db.query(GlossaryDimension).filter(GlossaryDimension.entity_id == entity_id).all()
    return {"status": "ok", "data": [d.to_json() for d in dimensions]}


@entity_router.post("/entities/{entity_id}/dimensions")
def create_dimension(entity_id: int, payload: DimensionCreate, db: Session = Depends(get_db)):
    entity = db.query(DetectedEntity).filter(DetectedEntity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    dimension = GlossaryDimension(
        entity_id=entity_id,
        name=payload.name,
        description=payload.description,
        source_column=payload.source_column,
        source_table=payload.source_table,
        confidence_score=1.0,
        status="proposed",
    )
    db.add(dimension)
    db.commit()
    db.refresh(dimension)
    return {"status": "ok", "data": dimension.to_json()}


@entity_router.patch("/dimensions/{dimension_id}")
def update_dimension(dimension_id: int, payload: DimensionUpdate, db: Session = Depends(get_db)):
    dimension = db.query(GlossaryDimension).filter(GlossaryDimension.id == dimension_id).first()
    if not dimension:
        raise HTTPException(status_code=404, detail="Dimension not found")

    if payload.name is not None:
        dimension.name = payload.name
    if payload.description is not None:
        dimension.description = payload.description
    if payload.source_column is not None:
        dimension.source_column = payload.source_column
    if payload.source_table is not None:
        dimension.source_table = payload.source_table
    if payload.confidence_score is not None:
        dimension.confidence_score = payload.confidence_score
    if payload.status is not None:
        dimension.status = payload.status
    dimension.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(dimension)
    return {"status": "ok", "data": dimension.to_json()}


# ── Definitions (GlossaryEntry) ──────────────────────────────────────────────

@entity_router.get("/entities/{entity_id}/definitions")
def get_entity_definitions(entity_id: int, db: Session = Depends(get_db)):
    from app.models.glossary import GlossaryEntry
    entries = db.query(GlossaryEntry).filter(
        GlossaryEntry.entity_id == entity_id,
    ).all()
    return {"status": "ok", "data": [e.to_json() for e in entries]}


# ── AI Propose ───────────────────────────────────────────────────────────────

@entity_router.post("/entities/{entity_id}/ai-propose")
def ai_propose_glossary_items(entity_id: int, db: Session = Depends(get_db)):
    """
    AI proposes metrics and dimensions for an entity using ai_query.
    Reads entity tables/columns and generates semantic suggestions.
    """
    entity = db.query(DetectedEntity).filter(DetectedEntity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    # Gather entity context
    tables = db.query(DetectedTable).filter(DetectedTable.entity_id == entity_id).all()
    table_context = []
    for table in tables:
        columns = db.query(DetectedColumn).filter(DetectedColumn.table_id == table.id).all()
        table_context.append({
            "table": f"{table.catalog}.{table.schema_name}.{table.table_name}",
            "columns": [{"name": c.column_name, "type": c.data_type} for c in columns],
        })

    # Existing metrics/dimensions to avoid duplicates
    existing_metrics = [
        m.name for m in
        db.query(GlossaryMetric).filter(GlossaryMetric.entity_id == entity_id).all()
    ]
    existing_dims = [
        d.name for d in
        db.query(GlossaryDimension).filter(GlossaryDimension.entity_id == entity_id).all()
    ]

    prompt = f"""You are a semantic layer expert helping define business metrics and dimensions.

Entity: {entity.name}
Description: {entity.description or "N/A"}

Tables and columns in this entity:
{json.dumps(table_context, indent=2)}

Already defined metrics: {json.dumps(existing_metrics)}
Already defined dimensions: {json.dumps(existing_dims)}

Propose NEW metrics and dimensions that a business analyst would need.
For metrics, suggest aggregation formulas using the actual column names.
For dimensions, identify categorical or grouping columns.

Respond ONLY with JSON, no markdown:
{{
  "metrics": [
    {{
      "name": "string (snake_case)",
      "metric_type": "metric or kpi",
      "description": "one sentence",
      "formula": "SQL expression e.g. SUM(column_name)",
      "backing_table": "full table name",
      "confidence_score": 0.0-1.0
    }}
  ],
  "dimensions": [
    {{
      "name": "string (snake_case)",
      "description": "one sentence",
      "source_column": "column_name",
      "source_table": "full table name",
      "cardinality": "low|medium|high",
      "confidence_score": 0.0-1.0
    }}
  ]
}}"""

    try:
        from databricks import sql as dbsql
        http_path = os.getenv("DATABRICKS_HTTP_PATH", "")
        token = os.getenv("DATABRICKS_TOKEN", "")
        host = DATABRICKS_HOST.replace("https://", "").replace("http://", "")

        with dbsql.connect(server_hostname=host, http_path=http_path, access_token=token) as conn:
            with conn.cursor() as cursor:
                safe_prompt = prompt.replace("'", "\\'")
                model = os.getenv("LAKEMIND_AI_MODEL", "databricks-meta-llama-3-1-70b-instruct")
                cursor.execute(
                    f"SELECT ai_query('{model}', '{safe_prompt}') as result"
                )
                result = cursor.fetchone()
                raw = result[0] if result else "{}"

        # Parse LLM response
        try:
            suggestions = json.loads(raw)
        except Exception:
            import re
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            suggestions = json.loads(match.group()) if match else {"metrics": [], "dimensions": []}

        # Persist proposed metrics
        new_metrics = []
        for m in suggestions.get("metrics", []):
            if m.get("name") in existing_metrics:
                continue
            metric = GlossaryMetric(
                entity_id=entity_id,
                name=m.get("name"),
                metric_type=m.get("metric_type", "metric"),
                description=m.get("description"),
                formula=m.get("formula"),
                backing_table=m.get("backing_table"),
                confidence_score=m.get("confidence_score", 0.7),
                status="proposed",
            )
            db.add(metric)
            new_metrics.append(m.get("name"))

        # Persist proposed dimensions
        new_dims = []
        for d in suggestions.get("dimensions", []):
            if d.get("name") in existing_dims:
                continue
            dimension = GlossaryDimension(
                entity_id=entity_id,
                name=d.get("name"),
                description=d.get("description"),
                source_column=d.get("source_column"),
                source_table=d.get("source_table"),
                cardinality=d.get("cardinality"),
                confidence_score=d.get("confidence_score", 0.7),
                status="proposed",
            )
            db.add(dimension)
            new_dims.append(d.get("name"))

        db.commit()

        return {
            "status": "ok",
            "data": {
                "new_metrics": new_metrics,
                "new_dimensions": new_dims,
                "total_proposed": len(new_metrics) + len(new_dims),
            }
        }

    except Exception as e:
        logger.error(f"AI propose failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI propose failed: {str(e)}")


# ── AI Chat ─────────────────────────────────────────────────────────────────

class AiChatRequest(BaseModel):
    message: str
    warehouse_id: str
    model_endpoint: str
    session_id: Optional[int] = None


@entity_router.post("/entities/{entity_id}/ai-chat")
def ai_chat(entity_id: int, payload: AiChatRequest, db: Session = Depends(get_db)):
    """Scoped AI chat for an entity — propose metrics, dimensions, and glossary via conversation."""
    from app.services import chat_service

    entity = db.query(DetectedEntity).filter(DetectedEntity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    result = chat_service.send_message(
        entity_id=entity_id,
        message=payload.message,
        session_id=payload.session_id,
        warehouse_id=payload.warehouse_id,
        model_endpoint=payload.model_endpoint,
        created_by="user",
        db=db,
    )
    return {"status": "ok", "data": result}


@entity_router.get("/entities/{entity_id}/chat-sessions")
def list_chat_sessions(entity_id: int, db: Session = Depends(get_db)):
    """List all chat sessions for an entity."""
    from app.services import chat_service

    return {"status": "ok", "data": chat_service.list_sessions(entity_id, db)}


@entity_router.get("/entities/{entity_id}/chat-sessions/{session_id}")
def get_chat_session(entity_id: int, session_id: int, db: Session = Depends(get_db)):
    """Get a chat session with all messages."""
    from app.services import chat_service

    data = chat_service.get_session(entity_id, session_id, db)
    if not data:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "ok", "data": data}


# ── AI Refine (Legacy) ──────────────────────────────────────────────────────

class RefineRequest(BaseModel):
    message: str


@entity_router.post("/metrics/{metric_id}/ai-refine")
def ai_refine_metric(metric_id: int, payload: RefineRequest, db: Session = Depends(get_db)):
    """
    AI-powered scoped refinement of a metric.
    User sends a natural language instruction and AI updates the metric formula/description.
    """
    metric = db.query(GlossaryMetric).filter(GlossaryMetric.id == metric_id).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    # Get entity context
    entity = db.query(DetectedEntity).filter(DetectedEntity.id == metric.entity_id).first()
    tables = db.query(DetectedTable).filter(DetectedTable.entity_id == metric.entity_id).all()
    table_context = []
    for table in tables:
        columns = db.query(DetectedColumn).filter(DetectedColumn.table_id == table.id).all()
        table_context.append({
            "table": f"{table.catalog}.{table.schema_name}.{table.table_name}",
            "columns": [{"name": c.column_name, "type": c.data_type} for c in columns],
        })

    prompt = f"""You are refining a business metric definition for a semantic layer.

Entity: {entity.name if entity else "unknown"}
Current metric:
- Name: {metric.name}
- Description: {metric.description or "N/A"}
- Formula: {metric.formula or "N/A"}
- Backing table: {metric.backing_table or "N/A"}

Available tables and columns:
{json.dumps(table_context, indent=2)}

User instruction: {payload.message}

Return the updated metric as JSON only, no markdown:
{{
  "name": "string",
  "description": "string",
  "formula": "SQL expression",
  "backing_table": "full table name",
  "confidence_score": 0.0-1.0
}}"""

    try:
        from databricks import sql as dbsql
        http_path = os.getenv("DATABRICKS_HTTP_PATH", "")
        token = os.getenv("DATABRICKS_TOKEN", "")
        host = DATABRICKS_HOST.replace("https://", "").replace("http://", "")

        with dbsql.connect(server_hostname=host, http_path=http_path, access_token=token) as conn:
            with conn.cursor() as cursor:
                safe_prompt = prompt.replace("'", "\\'")
                model = os.getenv("LAKEMIND_AI_MODEL", "databricks-meta-llama-3-1-70b-instruct")
                cursor.execute(
                    f"SELECT ai_query('{model}', '{safe_prompt}') as result"
                )
                result = cursor.fetchone()
                raw = result[0] if result else "{}"

        try:
            updated = json.loads(raw)
        except Exception:
            import re
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            updated = json.loads(match.group()) if match else {}

        # Apply updates
        if updated.get("name"):
            metric.name = updated["name"]
        if updated.get("description"):
            metric.description = updated["description"]
        if updated.get("formula"):
            metric.formula = updated["formula"]
        if updated.get("backing_table"):
            metric.backing_table = updated["backing_table"]
        if updated.get("confidence_score"):
            metric.confidence_score = updated["confidence_score"]
        metric.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(metric)

        return {"status": "ok", "data": metric.to_json()}

    except Exception as e:
        logger.error(f"AI refine failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI refine failed: {str(e)}")
