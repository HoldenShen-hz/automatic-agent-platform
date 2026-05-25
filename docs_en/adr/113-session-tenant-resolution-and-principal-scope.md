# ADR-113 Session Tenant Resolution And Principal Scope

## Status
Accepted

## Decision
- User sessions must carry `tenantId`.
- Service principals fail closed when tenant scope is absent.
- Tenant switching requires an explicit refreshed auth context.

