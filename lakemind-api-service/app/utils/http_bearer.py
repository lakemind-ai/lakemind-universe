from typing import Optional
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import HTTPException, Request, status


def _log(level: str, message: str):
    print(f"[HTTP_BEARER] [{level}] {message}", flush=True)


class HTTPBearer401(HTTPBearer):
    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        _log("INFO", f"Checking Bearer token for {request.method} {request.url.path}")

        lakemind_token = request.headers.get("x-lakemind-token")
        forwarded_token = request.headers.get("x-forwarded-access-token")
        auth_header = request.headers.get("Authorization")

        if lakemind_token:
            _log("INFO", f"X-LakeMind-Token found, length: {len(lakemind_token)}")
            return HTTPAuthorizationCredentials(scheme="Bearer", credentials=lakemind_token)
        elif forwarded_token:
            _log("INFO", f"x-forwarded-access-token found, length: {len(forwarded_token)}")
            return HTTPAuthorizationCredentials(scheme="Bearer", credentials=forwarded_token)
        elif auth_header:
            _log("INFO", f"Authorization header found: {auth_header[:30]}...")

        try:
            result = await super().__call__(request)
            if result:
                _log("INFO", f"Bearer token extracted. Scheme: {result.scheme}")
            return result
        except HTTPException as exc:
            _log("ERROR", f"HTTPException: status={exc.status_code}, detail={exc.detail}")
            if exc.status_code == status.HTTP_403_FORBIDDEN:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated — Bearer token missing or invalid",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            raise
