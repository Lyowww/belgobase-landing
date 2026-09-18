"""BelgoBase web authentication backend.

This package is intentionally independent from the Next.js deployment.  The
VPS owns authentication state and only returns opaque browser sessions.
"""

from .web_auth import (
    AuthContext,
    AuthError,
    SessionGrant,
    WebAuthConfig,
    WebAuthService,
)
from .http_adapter import HTTPResponse, WebAuthHTTPAdapter
from .workspace_integration import (
    make_workspace_bridge_handler,
    workspace_auth_context,
    workspace_scope_resolver,
)

__all__ = [
    "AuthContext",
    "AuthError",
    "SessionGrant",
    "WebAuthConfig",
    "WebAuthService",
    "HTTPResponse",
    "WebAuthHTTPAdapter",
    "make_workspace_bridge_handler",
    "workspace_auth_context",
    "workspace_scope_resolver",
]
