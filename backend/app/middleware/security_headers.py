"""Middleware injection des headers de sécurité HTTP (S3-06 / M-002).

Reference : docs/dette-technique-sprint-2.md (M-002).
Choix justifié dans le rapport audit_securite : API JSON-only → CSP et
X-Frame-Options non pertinents, focus sur HSTS / nosniff / referrer.

Headers injectés :
    - X-Content-Type-Options: nosniff              (toujours)
    - Referrer-Policy: strict-origin-when-cross-origin  (toujours)
    - Strict-Transport-Security: max-age=31536000; includeSubDomains
        (conditionnel : skip si ENVIRONMENT == "dev" car localhost tourne en HTTP)

Headers volontairement omis (API JSON-only, sans navigateur) :
    - CSP, X-Frame-Options, X-XSS-Protection, Permissions-Policy
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injecte les headers de sécurité sur toutes les réponses HTTP.

    HSTS conditionné sur ENVIRONMENT != 'dev' pour ne pas polluer le dev local
    qui tourne sur HTTP localhost — HSTS sur HTTP n'a aucun effet et pollue
    les logs navigateur si le frontend est testé localement.
    """

    def __init__(self, app, environment: str = "prod") -> None:
        super().__init__(app)
        self._environment = environment

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if self._environment != "dev":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response
