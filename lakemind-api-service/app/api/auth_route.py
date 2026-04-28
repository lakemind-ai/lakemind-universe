import os
import jwt
import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.utils.app_db import get_db
from app.utils.auth_utils import generate_code_verifier_challenge
from app.models.oidc_request import OIDCRequest

import logging

logger = logging.getLogger(__name__)

auth_router = APIRouter(tags=["Authentication API"], prefix="/auth")

# Environment
DATABRICKS_HOST = os.environ.get("DATABRICKS_HOST", "")
if DATABRICKS_HOST and not DATABRICKS_HOST.startswith(("http://", "https://")):
    DATABRICKS_HOST = f"https://{DATABRICKS_HOST}"

DATABRICKS_APP_URL = os.environ.get("DATABRICKS_APP_URL", "")
PORTAL_URL = os.environ.get(
    "REDIRECT_URI", DATABRICKS_APP_URL or "http://localhost:3003"
)
DATABRICKS_OIDC_CLIENT_ID = os.environ.get("DATABRICKS_OIDC_CLIENT_ID", "")
DATABRICKS_OIDC_CLIENT_SECRET = os.environ.get("DATABRICKS_OIDC_CLIENT_SECRET", "")

# Auth provider: "databricks" (default) or "azuread"
AUTH_PROVIDER = os.environ.get("AUTH_PROVIDER", "databricks")
AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID", "")
AZURE_AD_CLIENT_ID = os.environ.get("AZURE_AD_CLIENT_ID", "")
AZURE_AD_CLIENT_SECRET = os.environ.get("AZURE_AD_CLIENT_SECRET", "")
DATABRICKS_RESOURCE_ID = "2ff814a6-3304-4ab8-85cb-cd0e6f879c1d"


class TokenRequest(BaseModel):
    code: str
    state: Optional[str] = None
    redirect_uri: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class M2MTokenRequest(BaseModel):
    client_id: str
    client_secret: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = 3600
    refresh_token: str = ""
    scope: str = ""
    username: str = ""


def _get_token_url() -> str:
    if AUTH_PROVIDER == "azuread":
        return f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token"
    return f"{DATABRICKS_HOST}/oidc/v1/token"


def _get_client_credentials() -> tuple:
    if AUTH_PROVIDER == "azuread":
        return AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET
    return DATABRICKS_OIDC_CLIENT_ID, DATABRICKS_OIDC_CLIENT_SECRET


def _fetch_auth_token(data: dict) -> AuthTokenResponse:
    token_url = _get_token_url()
    response = requests.post(token_url, data=data)

    if response.status_code != 200:
        logger.error(f"Token request failed: {response.text}")
        raise HTTPException(status_code=response.status_code, detail=response.json())

    response_data = response.json()
    access_token = response_data["access_token"]

    username = ""
    try:
        claims = jwt.decode(access_token, options={"verify_signature": False})
        if AUTH_PROVIDER == "azuread":
            username = claims.get(
                "upn", claims.get("unique_name", claims.get("sub", ""))
            )
        else:
            username = claims.get("sub", "")
    except jwt.DecodeError:
        pass

    return AuthTokenResponse(
        access_token=access_token,
        token_type=response_data.get("token_type", "Bearer"),
        expires_in=response_data.get("expires_in", 3600),
        refresh_token=response_data.get("refresh_token", ""),
        scope=response_data.get("scope", ""),
        username=username,
    )


@auth_router.get("/get-oidc-url")
def get_oidc_url(
    redirect_uri: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Returns the OIDC authorization URL with PKCE challenge."""
    try:
        code_verifier, code_challenge = generate_code_verifier_challenge()

        oidc_request = OIDCRequest(
            code_verifier=code_verifier, code_challenge=code_challenge
        )
        db.add(oidc_request)
        db.commit()

        if not redirect_uri:
            redirect_uri = PORTAL_URL

        if AUTH_PROVIDER == "azuread":
            client_id = AZURE_AD_CLIENT_ID
            auth_url = (
                f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/authorize"
                f"?client_id={client_id}"
                f"&redirect_uri={redirect_uri}/auth/callback"
                f"&response_type=code"
                f"&state={oidc_request.id}"
                f"&code_challenge={code_challenge}"
                f"&code_challenge_method=S256"
                f"&scope={DATABRICKS_RESOURCE_ID}/user_impersonation+offline_access+openid+profile"
            )
        else:
            client_id = DATABRICKS_OIDC_CLIENT_ID
            auth_url = (
                f"{DATABRICKS_HOST}/oidc/v1/authorize"
                f"?client_id={client_id}"
                f"&redirect_uri={redirect_uri}/auth/callback"
                f"&response_type=code"
                f"&state={oidc_request.id}"
                f"&code_challenge={code_challenge}"
                f"&code_challenge_method=S256"
                f"&scope=all-apis+offline_access"
            )

        return {"status": "ok", "data": {"auth_url": auth_url}}

    except Exception as e:
        logger.exception(f"Error getting OIDC URL: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate OIDC URL")


@auth_router.post("/generate-auth-token")
def generate_auth_token(request: TokenRequest, db: Session = Depends(get_db)):
    """Exchange an authorization code for an access token with PKCE verification."""
    try:
        oidc_request = (
            db.query(OIDCRequest).filter(OIDCRequest.id == request.state).first()
        )
        if not oidc_request:
            raise HTTPException(status_code=400, detail="Invalid state")

        redirect_uri = request.redirect_uri or PORTAL_URL
        client_id, client_secret = _get_client_credentials()

        if AUTH_PROVIDER == "azuread":
            scope = f"{DATABRICKS_RESOURCE_ID}/user_impersonation offline_access openid profile"
        else:
            scope = "all-apis offline_access"

        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "authorization_code",
            "scope": scope,
            "redirect_uri": f"{redirect_uri}/auth/callback",
            "code_verifier": oidc_request.code_verifier,
            "code": request.code,
        }

        result = _fetch_auth_token(data)
        return {"status": "ok", "data": result.model_dump()}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error generating auth token: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create auth token: {e}")


@auth_router.post("/refresh-auth-token")
def refresh_auth_token(request: RefreshTokenRequest):
    """Refresh the auth token using the refresh token."""
    try:
        client_id, client_secret = _get_client_credentials()

        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": request.refresh_token,
        }

        result = _fetch_auth_token(data)
        return {"status": "ok", "data": result.model_dump()}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error refreshing auth token: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to refresh auth token: {e}"
        )


@auth_router.post("/generate-auth-token-m2m")
def generate_auth_token_m2m(request: M2MTokenRequest):
    """Generate an M2M token using client credentials."""
    try:
        if AUTH_PROVIDER == "azuread":
            scope = f"{DATABRICKS_RESOURCE_ID}/.default"
        else:
            scope = "all-apis"

        data = {
            "client_id": request.client_id,
            "client_secret": request.client_secret,
            "grant_type": "client_credentials",
            "scope": scope,
        }

        result = _fetch_auth_token(data)
        return {"status": "ok", "data": result.model_dump()}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error generating M2M auth token: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create M2M auth token: {e}"
        )
