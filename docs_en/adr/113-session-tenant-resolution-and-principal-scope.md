# ADR-113 Session Tenant Resolution And Principal Scope

- Status: Accepted

## Background

HTTP user session, service principal, and tenant isolation have been unified to a single scope judgment in implementation, but previously there was no authoritative document explaining how tenant is resolved and propagated.

## Decision

- User session object must directly carry `tenantId` as input to downstream `TenantScopeFilter`.
- Service principal does not default to inheriting any tenant permission; when tenant context is missing, handle as fail-closed, then combine with namespace / platform permission for additional judgment.
- Session tenant switching must explicitly create or refresh new authentication context; implicit drift within the same token is not allowed.

## Results

- Tenant boundary resolution path changes from "implicit guessing" to "session field + scope filter".
- Issues in review regarding lack of authoritative description for session tenant resolution become zero.

## Related Implementation

- `src/platform/five-plane-interface/api/session-management.ts`
- `src/platform/five-plane-interface/api/http-api-server.ts`
- `src/platform/five-plane-control-plane/incident-control/tenant-scope-filter.ts`