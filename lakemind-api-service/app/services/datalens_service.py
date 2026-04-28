"""
DataLens Service — natural language data exploration powered by Genie.
Wraps the Databricks Genie conversation API using the user's token.
"""
import logging

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.dashboards import GenieMessage

logger = logging.getLogger(__name__)

DATABRICKS_HOST = __import__("os").getenv("DATABRICKS_HOST", "")


def _get_host() -> str:
    host = DATABRICKS_HOST
    if not host.startswith(("http://", "https://")):
        host = f"https://{host}"
    return host.rstrip("/")


def _get_client(token: str) -> WorkspaceClient:
    return WorkspaceClient(host=_get_host(), token=token)


def _serialize_message(msg: GenieMessage) -> dict:
    """Convert a GenieMessage to a JSON-serializable dict."""
    attachments = []
    if msg.attachments:
        for att in msg.attachments:
            a: dict = {"id": att.attachment_id}
            if att.text:
                a["type"] = "text"
                a["content"] = att.text.content if att.text.content else ""
            if att.query:
                a["type"] = "query"
                a["title"] = att.query.title or ""
                a["description"] = att.query.description or ""
                a["sql"] = att.query.query or ""
                a["statement_id"] = att.query.statement_id or ""
                if att.query.thoughts:
                    a["thoughts"] = [
                        {
                            "content": t.content or "",
                            "thought_type": t.thought_type.value if t.thought_type else "",
                        }
                        for t in att.query.thoughts
                    ]
                if att.query.query_result_metadata:
                    a["row_count"] = att.query.query_result_metadata.row_count
            if att.suggested_questions:
                a["type"] = "suggested_questions"
                a["questions"] = [q for q in (att.suggested_questions.questions or [])]
            attachments.append(a)

    return {
        "message_id": msg.message_id or msg.id,
        "conversation_id": msg.conversation_id,
        "space_id": msg.space_id,
        "content": msg.content or "",
        "status": msg.status.value if msg.status else None,
        "attachments": attachments,
        "created_at": msg.created_timestamp,
    }


def start_conversation(space_id: str, question: str, token: str) -> dict:
    """Start a new Genie conversation with an initial question. Waits for completion."""
    try:
        client = _get_client(token)
        msg = client.genie.start_conversation_and_wait(space_id, question)
        return _serialize_message(msg)
    except Exception as e:
        logger.error(f"Failed to start Genie conversation: {e}")
        return {"error": str(e)}


def send_message(space_id: str, conversation_id: str, message: str, token: str) -> dict:
    """Send a follow-up message in an existing conversation. Waits for completion."""
    try:
        client = _get_client(token)
        msg = client.genie.create_message_and_wait(space_id, conversation_id, message)
        return _serialize_message(msg)
    except Exception as e:
        logger.error(f"Failed to send Genie message: {e}")
        return {"error": str(e)}


def get_query_result(space_id: str, conversation_id: str, message_id: str, token: str) -> dict:
    """Get the SQL query result for a message attachment."""
    try:
        client = _get_client(token)
        result = client.genie.get_message_query_result(space_id, conversation_id, message_id)
        data = result.as_dict() if result else {}
        return data
    except Exception as e:
        logger.error(f"Failed to get query result: {e}")
        return {"error": str(e)}


def get_statement_result(statement_id: str, token: str) -> dict:
    """Fetch SQL statement results via the Databricks SQL Statement API."""
    import requests as req

    host = _get_host()
    try:
        resp = req.get(
            f"{host}/api/2.0/sql/statements/{statement_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        if resp.status_code != 200:
            return {"error": f"Statement API error: {resp.status_code}"}

        data = resp.json()
        columns = []
        rows = []

        manifest = data.get("manifest", {})
        schema = manifest.get("schema", {})
        for col in schema.get("columns", []):
            columns.append({
                "name": col.get("name", ""),
                "type": col.get("type_name", ""),
            })

        result = data.get("result", {})
        rows = result.get("data_array", [])

        return {"columns": columns, "rows": rows}
    except Exception as e:
        logger.error(f"Failed to get statement result: {e}")
        return {"error": str(e)}
