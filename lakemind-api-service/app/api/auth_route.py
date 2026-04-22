import os
import jwt
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

auth_router = APIRouter(tags=["Authentication API"], prefix="/auth")

DATABRICKS_HOST = os.environ.get("DATABRICKS_HOST", "")
if DATABRICKS_HOST and not DATABRICKS_HOST.startswith(("http://", "https://")):
    DATABRICKS_HOST = f"https://{DATABRICKS_HOST}"

DATABRICKS_OIDC_CLIENT_ID = os.environ.get("DATABRICKS_OIDC_CLIENT_ID", "")
DATABRICKS_OIDC_CLIENT_SECRET = os.environ.get("DATABRICKS_OIDC_CLIENT_SECRET", "")


class TokenRequest(BaseModel):
    code: str
    state: Optional[str] = None


class M2MTokenRequest(BaseModel):
    client_id: str
    client_secret: str


@auth_router.get("/get-oidc-url")
def get_oidc_url():
    """Returns the Databricks OIDC authorization URL for login."""
    import urllib.parse
    redirect_uri = "http://localhost:3001/auth/callback"
    params = {
        "response_type": "code",
        "client_id": DATABRICKS_OIDC_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": "openid email profile offline_access",
        "state": "lakemind_login",
    }
    auth_url = f"{DATABRICKS_HOST}/oidc/v1/authorize?{urllib.parse.urlencode(params)}"
    return {"status": "ok", "data": {"url": auth_url}}


@auth_router.post("/generate-auth-token")
async def generate_auth_token(request: TokenRequest):
    """Exchange an authorization code for an access token."""
    import httpx
    token_url = f"{DATABRICKS_HOST}/oidc/v1/token"
    data = {
        "grant_type": "authorization_code",
        "code": request.code,
        "client_id": DATABRICKS_OIDC_CLIENT_ID,
        "client_secret": DATABRICKS_OIDC_CLIENT_SECRET,
        "redirect_uri": "http://localhost:3001/auth/callback",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(token_url, data=data)
    if resp.status_code != 200:
        return {"status": "error", "message": "Token exchange failed"}
    token_data = resp.json()
    return {"status": "ok", "data": token_data}


@auth_router.post("/generate-auth-token-m2m")
async def generate_auth_token_m2m(request: M2MTokenRequest):
    """Generate an M2M token using client credentials."""
    import httpx
    token_url = f"{DATABRICKS_HOST}/oidc/v1/token"
    data = {
        "grant_type": "client_credentials",
        "client_id": request.client_id,
        "client_secret": request.client_secret,
        "scope": "all-apis",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(token_url, data=data)
    if resp.status_code != 200:
        return {"status": "error", "message": "M2M token generation failed"}
    return {"status": "ok", "data": resp.json()}
