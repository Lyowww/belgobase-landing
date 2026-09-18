from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .authorization import (
    SCOPE_DATA_EXPORT,
    SCOPE_DATA_READ,
    SCOPE_XBRL_EXPORT,
    SCOPE_XBRL_READ,
)
from .web_auth import AuthError


_DATA_READ = frozenset({SCOPE_DATA_READ})
_DATA_EXPORT = frozenset({SCOPE_DATA_READ, SCOPE_DATA_EXPORT})
_XBRL_READ = frozenset({SCOPE_XBRL_READ})
_XBRL_DATA_READ = frozenset({SCOPE_DATA_READ, SCOPE_XBRL_READ})
_XBRL_EXPORT = frozenset(
    {SCOPE_DATA_READ, SCOPE_DATA_EXPORT, SCOPE_XBRL_READ, SCOPE_XBRL_EXPORT}
)
_AUTHENTICATED = frozenset()

_STATIC_POLICIES: dict[str, frozenset[str]] = {
    "bootstrap": _DATA_READ,
    "company": _DATA_READ,
    "operation_status": _DATA_READ,
    "cancel_operation": _DATA_READ,
    "workspace_save": _DATA_READ,
    "search_history": _DATA_READ,
    "relaxation_suggestions": _DATA_READ,
    "compare_companies": _DATA_READ,
    "similar_company": _DATA_READ,
    "ai_usage": _DATA_READ,
    "ai_wallet": _DATA_READ,
    "set_language": _DATA_READ,
    "set_ai_limit": _DATA_READ,
    "export_columns": _DATA_EXPORT,
    "xbrl_catalog": _XBRL_READ,
    "account_action": _AUTHENTICATED,
}


def _has_xbrl_filters(payload: dict[str, Any]) -> bool:
    filters = payload.get("filters")
    return isinstance(filters, dict) and bool(filters.get("xbrl_metric_filters"))


def workspace_scope_resolver(method: str, payload: dict[str, Any]) -> frozenset[str]:
    """Map every browser bridge method to the existing operation scopes."""

    if method == "search" or method == "ai":
        return _XBRL_DATA_READ if _has_xbrl_filters(payload) else _DATA_READ
    if method in {"filters_apply", "similar_apply"}:
        return _XBRL_DATA_READ if _has_xbrl_filters(payload) else _DATA_READ
    if method in {"export_results", "export_selection"}:
        return _XBRL_EXPORT if _has_xbrl_filters(payload) else _DATA_EXPORT
    if method == "workspace_data":
        return _XBRL_READ if payload.get("section") == "xbrl" else _DATA_READ
    required = _STATIC_POLICIES.get(method)
    if required is None:
        raise AuthError("bridge_method_not_allowed", 404)
    return required


def workspace_auth_context(auth: dict[str, Any]) -> Any:
    from .web_workspace import AuthContext as WorkspaceAuthContext

    return WorkspaceAuthContext(
        license_id=str(auth["license_id"]),
        user_id=str(auth["user_id"]),
        display_name=str(auth.get("email") or "BelgoBase"),
        customer_id=str(auth["customer_id"]),
        browser_id=str(auth["browser_id"]),
        plan=str(auth["plan"]),
        rights=dict(auth["rights"]),
        effective_scopes=frozenset(auth.get("effective_scopes") or ()),
        principal_id=str(auth["principal_id"]),
        quota_subject_id=str(auth["quota_subject_id"]),
        email=str(auth["email"]),
    )


def make_workspace_bridge_handler(workspace_service: Any) -> Callable[[str, dict[str, Any], dict[str, Any]], dict[str, Any]]:
    """Adapt trusted web-auth context to ``WorkspaceService.execute``.

    The import is local so the authentication package remains independently
    testable.  Runtime construction fails immediately if the workspace adapter
    is absent or has no callable ``execute`` method.
    """

    execute = getattr(workspace_service, "execute", None)
    if not callable(execute):
        raise TypeError("workspace service must expose execute")
    def handle(method: str, payload: dict[str, Any], auth: dict[str, Any]) -> dict[str, Any]:
        context = workspace_auth_context(auth)
        result = execute(method, payload, context)
        if not isinstance(result, dict):
            raise AuthError("bridge_response_invalid", 500)
        return result

    return handle
