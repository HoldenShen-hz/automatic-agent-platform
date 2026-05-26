# ADR-113 Session Tenant Resolution And Principal Scope

## Status
Accepted

## Background
HTTP user sessions, service principal, and tenant isolation have been converged to unified scope judgment in implementation, but there was previously no authoritative document explaining how tenant is parsed and propagated.

## Decision
- User session object must directly carry `tenantId`, as input for downstream `TenantScopeFilter`.
- Service principal does not inherit arbitrary tenant permissions by default; when tenant context is missing,按fail-closed处理, then combined with namespace / platform permissions for additional judgment.
- Session tenant switching must explicitly create or refresh new authentication context,不允许在同一token内隐式漂移.

## Result
- Tenant boundary resolution path changes from "implicit guessing" to "session field + scope filter".
- Issues about missing authoritative explanation for session tenant resolution in review归零.

## Related Implementation
- `src/platform/five-plane-interface/api/session-management.ts`
- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-control-plane/incident-control/tenant-scope-filter.ts`

