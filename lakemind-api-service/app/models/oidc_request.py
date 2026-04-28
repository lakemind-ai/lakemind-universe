from sqlalchemy import Column, String, DateTime
from app.utils.database import Base
from datetime import datetime, timezone
import uuid


class OIDCRequest(Base):
    __tablename__ = "oidc_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code_verifier = Column(String(255), nullable=False)
    code_challenge = Column(String(255), nullable=False)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
