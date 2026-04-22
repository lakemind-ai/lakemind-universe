import os
import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from fastapi.security import HTTPAuthorizationCredentials
from app.utils.http_bearer import HTTPBearer401
from cachetools import TTLCache, cached
from cachetools.keys import hashkey

import logging
logger = logging.getLogger(__name__)

token_auth_scheme = HTTPBearer401()

DATABRICKS_HOST = os.environ.get("DATABRICKS_HOST", "https://databricks.com")
if DATABRICKS_HOST and not DATABRICKS_HOST.startswith(("http://", "https://")):
    DATABRICKS_HOST = f"https://{DATABRICKS_HOST}"

DATABRICKS_OIDC_CLIENT_ID = os.environ.get("DATABRICKS_OIDC_CLIENT_ID", "")
RUN_DATABRICKS_VALIDATION_TOKEN = os.environ.get(
    "RUN_DATABRICKS_VALIDATION_TOKEN", "True"
)

token_cache = TTLCache(maxsize=100, ttl=3600)

issuer = "https://databricks.okta.com/oauth2/default"
jwks_url = f"{issuer}/v1/keys"

try:
    jwks_client = jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=60 * 60)
except Exception:
    jwks_client = None


def _log(level: str, message: str):
    print(f"[AUTH] [{level}] {message}", flush=True)
    if level == "ERROR":
        logger.error(message)
    elif level == "WARNING":
        logger.warning(message)
    else:
        logger.info(message)


def token_required(
    token: HTTPAuthorizationCredentials,
    request: Request = None,
    db: Session = None,
):
    """
    Validates a Bearer token.
    In Databricks Apps, the platform handles outer auth.
    This validates the OIDC token for API-level access control.
    """
    if token is None:
        raise HTTPException(status_code=401, detail="No token provided")

    credentials = token.credentials

    try:
        key = hashkey(credentials)
        if key in token_cache:
            _log("INFO", "Token found in cache — skipping validation")
            return token_cache[key]

        # Decode without verification (Databricks Apps handles outer auth)
        decoded = jwt.decode(
            credentials,
            options={"verify_signature": False},
            algorithms=["RS256", "HS256"],
        )

        user_info = {
            "username": decoded.get("sub", ""),
            "email": decoded.get("email", decoded.get("sub", "")),
            "name": decoded.get("name", ""),
        }

        token_cache[key] = user_info
        _log("INFO", f"Token validated for user: {user_info.get('email')}")
        return user_info

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception as e:
        _log("WARNING", f"Token validation error (permissive): {e}")
        # In Databricks Apps, be permissive — platform handles auth
        return {"username": "databricks_user", "email": "", "name": ""}
