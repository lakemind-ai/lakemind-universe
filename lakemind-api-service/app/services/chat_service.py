"""
Chat Service — manages AI chat sessions, message persistence, and conversation flow.
"""
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.chat import ChatSession, ChatMessage
from app.services.ai_chat_service import chat as ai_chat

logger = logging.getLogger(__name__)


def get_or_create_session(
    entity_id: int,
    session_id: int | None,
    initial_title: str,
    created_by: str,
    db: Session,
) -> ChatSession:
    """Get an existing session or create a new one."""
    if session_id:
        session = db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.entity_id == entity_id,
        ).first()
        if session:
            return session

    session = ChatSession(
        entity_id=entity_id,
        title=initial_title[:100],
        created_by=created_by,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_conversation_history(session: ChatSession) -> list[dict]:
    """Build conversation history from persisted messages."""
    return [
        {"role": m.role, "content": m.content}
        for m in session.messages
    ]


def send_message(
    entity_id: int,
    message: str,
    session_id: int | None,
    warehouse_id: str,
    model_endpoint: str,
    created_by: str,
    db: Session,
) -> dict:
    """
    Process a user message: persist it, call AI, persist response, return result.
    """
    # Get or create session
    session = get_or_create_session(
        entity_id=entity_id,
        session_id=session_id,
        initial_title=message,
        created_by=created_by,
        db=db,
    )

    # Build conversation history from existing messages
    conversation_history = get_conversation_history(session)

    # Persist user message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=message,
    )
    db.add(user_msg)
    db.commit()

    # Call AI service
    result = ai_chat(
        entity_id=entity_id,
        message=message,
        conversation_history=conversation_history,
        warehouse_id=warehouse_id,
        model_endpoint=model_endpoint,
        db=db,
    )

    # Persist assistant response
    proposals = result.get("proposals", [])
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=result.get("response", ""),
        proposals=json.dumps(proposals) if proposals else None,
    )
    db.add(assistant_msg)
    session.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "session_id": session.id,
        "response": result.get("response", ""),
        "proposals": proposals,
    }


def list_sessions(entity_id: int, db: Session) -> list[dict]:
    """List all chat sessions for an entity."""
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.entity_id == entity_id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "title": s.title,
            "message_count": len(s.messages),
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in sessions
    ]


def get_session(entity_id: int, session_id: int, db: Session) -> dict | None:
    """Get a session with all messages."""
    session = db.query(ChatSession).filter(
        ChatSession.id == session_id,
        ChatSession.entity_id == entity_id,
    ).first()
    if not session:
        return None
    return session.to_json()
