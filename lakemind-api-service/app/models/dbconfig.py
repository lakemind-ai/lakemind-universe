from sqlalchemy import Column, String, Text, DateTime, SMALLINT
from app.utils.database import Base
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone


class DBConfigProperties(Base):
    __tablename__ = "db_config_properties"

    config_key = Column(String(255), primary_key=True, nullable=False)
    config_value = Column(Text, nullable=False)
    config_value_type = Column(String(50), nullable=False)
    config_label = Column(String(255), nullable=False)
    config_desc = Column(Text, nullable=False)
    extended_values = Column(Text, nullable=True)
    config_category = Column(String(255), nullable=False)
    config_show = Column(SMALLINT, default=1, nullable=False)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def __init__(
        self,
        config_key,
        config_value,
        config_value_type,
        config_label,
        config_desc,
        config_category,
        extended_values=None,
        config_show=1,
        updated_by="system",
        updated_at=None,
    ):
        self.config_key = config_key
        self.config_value = config_value
        self.config_value_type = config_value_type
        self.config_label = config_label
        self.config_desc = config_desc
        self.extended_values = extended_values
        self.config_category = config_category
        self.config_show = config_show
        self.updated_at = updated_at if updated_at else datetime.now(timezone.utc)
        self.updated_by = updated_by

    def to_json(self):
        return dict(
            config_key=self.config_key,
            config_value=self.config_value,
            config_value_type=self.config_value_type,
            config_label=self.config_label,
            config_desc=self.config_desc,
            extended_values=self.extended_values,
            config_category=self.config_category,
            config_show=self.config_show,
            updated_by=self.updated_by,
            updated_at=(
                self.updated_at.replace(tzinfo=timezone.utc).isoformat()
                if self.updated_at
                else None
            ),
        )


class DBConfigPropertiesResponse(BaseModel):
    config_key: str
    config_value: str
    config_label: str
    config_desc: str
    extended_values: Optional[str] = None
    config_category: str
    config_show: int
    updated_by: Optional[str] = None
    updated_at: str
    config_value_type: str

    class Config:
        orm_mode = True


class DBConfigPropertiesUpdate(BaseModel):
    config_key: str
    config_value: str
    extended_values: Optional[str] = None
