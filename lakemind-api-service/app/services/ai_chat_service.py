"""
AI Chat Service — scoped conversational AI for entity glossary creation and refinement.
Takes entity context + user message → returns structured metric/dimension proposals.
"""
import json
import logging

from sqlalchemy.orm import Session

from app.models.scan import DetectedEntity, DetectedTable, DetectedColumn
from app.models.entity import GlossaryMetric, GlossaryDimension
from app.services.ai_service import _call_model, _parse_json_response

logger = logging.getLogger(__name__)


def _build_entity_context(entity_id: int, db: Session) -> dict:
    """Build full context for an entity — tables, columns, existing metrics/dimensions."""
    entity = db.query(DetectedEntity).filter(DetectedEntity.id == entity_id).first()
    if not entity:
        return {}

    tables = db.query(DetectedTable).filter(DetectedTable.entity_id == entity_id).all()
    table_context = []
    for table in tables:
        columns = db.query(DetectedColumn).filter(DetectedColumn.table_id == table.id).all()
        table_context.append({
            "table": f"{table.catalog}.{table.schema_name}.{table.table_name}",
            "columns": [
                {"name": c.column_name, "type": c.data_type, "description": c.business_description or ""}
                for c in columns
            ],
        })

    existing_metrics = [
        {"name": m.name, "formula": m.formula, "description": m.description}
        for m in db.query(GlossaryMetric).filter(GlossaryMetric.entity_id == entity_id).all()
    ]
    existing_dimensions = [
        {"name": d.name, "column": d.source_column, "table": d.source_table, "description": d.description}
        for d in db.query(GlossaryDimension).filter(GlossaryDimension.entity_id == entity_id).all()
    ]

    return {
        "entity_name": entity.name,
        "entity_description": entity.description or "",
        "tables": table_context,
        "existing_metrics": existing_metrics,
        "existing_dimensions": existing_dimensions,
    }


def chat(
    entity_id: int,
    message: str,
    conversation_history: list[dict],
    warehouse_id: str,
    model_endpoint: str,
    db: Session,
) -> dict:
    """
    Process a chat message in the context of an entity.
    Returns AI response text + any structured proposals (metrics/dimensions).
    """
    context = _build_entity_context(entity_id, db)
    if not context:
        return {"response": "Entity not found.", "proposals": []}

    # Build conversation prompt
    history_text = ""
    for msg in conversation_history[-6:]:  # Last 6 messages for context
        role = "User" if msg.get("role") == "user" else "Assistant"
        history_text += f"{role}: {msg.get('content', '')}\n"

    prompt = f"""You are LakeMind AI — a semantic layer assistant helping define business metrics and dimensions for Databricks Genie.

Entity: {context['entity_name']}
Description: {context['entity_description']}

Available tables and columns:
{json.dumps(context['tables'], indent=2)}

Existing metrics: {json.dumps(context['existing_metrics'])}
Existing dimensions: {json.dumps(context['existing_dimensions'])}

Conversation so far:
{history_text}

User: {message}

Instructions:
- Help the user define metrics (entity-level aggregations) and dimensions (column-level categorical attributes)
- Use actual column names from the available tables
- For metrics, provide SQL aggregation formulas
- For dimensions, specify the source column and table
- Be conversational and helpful
- If the user's request results in a concrete metric or dimension, include it in the "proposals" array

Respond with JSON only, no markdown:
{{
  "response": "Your conversational reply to the user",
  "proposals": [
    {{
      "type": "metric or dimension",
      "name": "Business name",
      "description": "One-line description",
      "formula": "SQL expression (metrics only, null for dimensions)",
      "source_column": "column_name (dimensions only, null for metrics)",
      "source_table": "full.table.name (dimensions only, null for metrics)",
      "confidence": 0.0-1.0
    }}
  ]
}}

If no concrete proposals arise from this message, return an empty proposals array."""

    try:
        raw = _call_model(prompt, model_endpoint, warehouse_id)
        parsed = _parse_json_response(raw)

        response_text = parsed.get("response", raw if not parsed else "I couldn't process that. Could you rephrase?")
        proposals = parsed.get("proposals", [])

        return {
            "response": response_text,
            "proposals": proposals,
        }
    except Exception as e:
        logger.error(f"AI chat failed for entity {entity_id}: {e}")
        return {
            "response": f"Sorry, I encountered an error: {str(e)[:200]}",
            "proposals": [],
        }
