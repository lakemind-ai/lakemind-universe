from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.utils.database import Base
from datetime import datetime, timezone


class ChatSession(Base):
    """A conversation session between a user and LakeMind AI, scoped to an entity."""
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(Integer, ForeignKey("detected_entities.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=True)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

    def to_json(self):
        return {
            "id": self.id,
            "entity_id": self.entity_id,
            "title": self.title,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "messages": [m.to_json() for m in self.messages] if self.messages else [],
        }


class ChatMessage(Base):
    """A single message in a chat session."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    proposals = Column(Text, nullable=True)  # JSON array of proposals from AI
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("ChatSession", back_populates="messages")

    def to_json(self):
        import json as _json
        return {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "proposals": _json.loads(self.proposals) if self.proposals else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
