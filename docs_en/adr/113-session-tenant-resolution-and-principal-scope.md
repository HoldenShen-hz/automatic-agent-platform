# ADR-113 Session Tenant Resolution And Principal Scope

- Status: Accepted

## Background
HTTP user sessions, service principal, and tenant isolation have been converged to unified scope judgment in implementation, but there was previously no authoritative document explaining how tenant is parsed and propagated.

## Decision
- User session object must directly carry `tenantId`, as input for downstream `TenantScopeFilter`.
- Service principal does not inherit arbitrary tenant permissions by default; when tenant context is missing it must fail closed first, then combine namespace / platform permissions for additional judgment.
- Session tenant switching must explicitly create or refresh a new authentication context and cannot drift implicitly inside the same token.

## Result
- Tenant boundary resolution path changes from "implicit guessing" to "session field + scope filter".
- Review findings about missing authoritative session-tenant resolution documentation are cleared.

## Related Implementation
- `src/platform/five-plane-interface/api/session-management.ts`
- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-control-plane/incident-control/tenant-scope-filter.ts`
