from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.utils.app_db import get_db
from app.services import datalens_service

import logging

logger = logging.getLogger(__name__)

datalens_router = APIRouter(tags=["DataLens API"], prefix="/datalens")


def _extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else ""
    if not token:
        raise HTTPException(status_code=401, detail="No authorization token provided")
    return token


class StartConversationRequest(BaseModel):
    space_id: str
    question: str


class SendMessageRequest(BaseModel):
    space_id: str
    conversation_id: str
    message: str


class QueryResultRequest(BaseModel):
    space_id: str
    conversation_id: str
    message_id: str


@datalens_router.post("/ask")
def ask_question(payload: StartConversationRequest, request: Request):
    """Start a new DataLens conversation with a question."""
    token = _extract_token(request)
    data = datalens_service.start_conversation(payload.space_id, payload.question, token)
    if "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    return {"status": "ok", "data": data}


@datalens_router.post("/follow-up")
def follow_up(payload: SendMessageRequest, request: Request):
    """Send a follow-up message in an existing conversation."""
    token = _extract_token(request)
    data = datalens_service.send_message(payload.space_id, payload.conversation_id, payload.message, token)
    if "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    return {"status": "ok", "data": data}


@datalens_router.post("/query-result")
def query_result(payload: QueryResultRequest, request: Request):
    """Get the SQL query result for a message."""
    token = _extract_token(request)
    data = datalens_service.get_query_result(payload.space_id, payload.conversation_id, payload.message_id, token)
    if "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    return {"status": "ok", "data": data}


class StatementResultRequest(BaseModel):
    statement_id: str


@datalens_router.post("/statement-result")
def statement_result(payload: StatementResultRequest, request: Request):
    """Fetch SQL statement results (columns + rows) from Databricks."""
    token = _extract_token(request)
    data = datalens_service.get_statement_result(payload.statement_id, token)
    if "error" in data:
        raise HTTPException(status_code=502, detail=data["error"])
    return {"status": "ok", "data": data}
