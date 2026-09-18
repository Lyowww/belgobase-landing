from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from .web_auth import AuthContext, AuthError


SCOPE_DATA_READ = "data.read"
SCOPE_DATA_EXPORT = "data.export"
SCOPE_XBRL_READ = "xbrl.read"
SCOPE_XBRL_EXPORT = "xbrl.export"
ALL_CUSTOMER_SCOPES = frozenset(
    {SCOPE_DATA_READ, SCOPE_DATA_EXPORT, SCOPE_XBRL_READ, SCOPE_XBRL_EXPORT}
)

# Keep this table byte-for-byte equivalent in meaning to
# belgobase_authorization_45a.PLAN_SCOPE_CEILINGS.  The integration adapter may
# inject that module's effective_scopes function instead of using this copy.
PLAN_SCOPE_CEILINGS: dict[str, frozenset[str]] = {
    "full": ALL_CUSTOMER_SCOPES,
    "internal-full": ALL_CUSTOMER_SCOPES,
    "read_only": frozenset({SCOPE_DATA_READ, SCOPE_XBRL_READ}),
    "data_only": frozenset({SCOPE_DATA_READ, SCOPE_DATA_EXPORT}),
    "xbrl_only": frozenset({SCOPE_XBRL_READ, SCOPE_XBRL_EXPORT}),
}


def rights_scopes(rights: dict[str, Any] | None) -> frozenset[str]:
    values = rights if isinstance(rights, dict) else {}
    scopes: set[str] = set()
    if str(values.get("data_access") or "").strip().lower() == "all_current":
        scopes.add(SCOPE_DATA_READ)
    if values.get("exports") is True and SCOPE_DATA_READ in scopes:
        scopes.add(SCOPE_DATA_EXPORT)
    if values.get("xbrl") is True:
        scopes.add(SCOPE_XBRL_READ)
    if values.get("exports") is True and SCOPE_XBRL_READ in scopes:
        scopes.add(SCOPE_XBRL_EXPORT)
    explicit = values.get("scopes")
    if explicit is not None:
        if not isinstance(explicit, list):
            return frozenset()
        scopes.intersection_update(
            str(value).strip() for value in explicit if str(value).strip()
        )
    return frozenset(scopes)


def effective_scopes(context: AuthContext | dict[str, Any]) -> frozenset[str]:
    values = context.as_dict() if isinstance(context, AuthContext) else context
    plan = str(values.get("plan") or "").strip().lower()
    return frozenset(
        PLAN_SCOPE_CEILINGS.get(plan, frozenset()).intersection(
            rights_scopes(values.get("rights"))
        )
    )


def require_scopes(
    context: AuthContext | dict[str, Any], required: Iterable[str]
) -> frozenset[str]:
    values = context.as_dict() if isinstance(context, AuthContext) else context
    plan = str(values.get("plan") or "").strip().lower()
    scopes = effective_scopes(values)
    needed = frozenset(str(value) for value in required)
    if plan not in PLAN_SCOPE_CEILINGS or not needed.issubset(scopes):
        raise AuthError("authorization_denied", 403)
    return scopes

