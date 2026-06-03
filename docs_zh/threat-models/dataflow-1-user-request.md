# Dataflow 1: User Request → Auth → Tenant Guard → Route → Service → Repository

> Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §32.2.
> Companion file: docs_zh/threat-models/dataflow-{2..10}-*.md.

## Trust boundaries

```text
[user / anonymous]   -- (public internet) -->   [edge / ingress]
                                                  |
                                                  v
[untrusted request]  -- (auth boundary) -->    [authenticated principal]
                                                  |
                                                  v
[tenant boundary]   -- (tenant guard) -->      [tenant-scoped context]
                                                  |
                                                  v
[service layer]     -- (input validation) -->   [domain service]
                                                  |
                                                  v
[repository layer]  -- (query whitelist) -->    [durable store]
```

## Threats

| ID | Threat | Boundary | Failure mode | Required gate |
|---|---|---|---|---|
| THR-1.1 | Unauthenticated caller reaches a P0 route | auth | cross-tenant data leak | `audit:tenant-isolation`, `audit:auth-role-mapping` |
| THR-1.2 | Tenant A's `tenantId` is accepted on tenant B's request | tenant | data integrity | `audit:tenant-isolation`, `tests/invariants/deny-by-default.test.ts` |
| THR-1.3 | Route bypasses input validation and reaches repository | service | injection / data corruption | `audit:fire-and-forget` (silent drops) + `audit:determinism` (audit trail) |
| THR-1.4 | Repository runs unscoped query | repository | cross-tenant leak | `audit:tenant-isolation` (rule: `tenant_isolation.repo_missing_tenant`) |

## Side-effect boundary

This flow is **read-mostly** for GET requests. For POST/PUT/DELETE the
side-effect boundary enters at the service layer and produces a
**receipt** (audit:receipt-verification).

## Evidence boundary

Every state change must emit an `EventEnvelope` to the durable outbox
(audit:event-outbox) within the same transaction as the truth mutation.

## Required gates

```text
audit:tenant-isolation          # §9.1
audit:secret-sinks              # §9.2  (response payload may echo secret)
audit:contracts-sync            # §8    (route → schema alignment)
audit:fire-and-forget           # §20.6.2
audit:determinism               # §20.6.2 (request id stability)
test:invariants                 # §44.7
test:redteam:p0                 # §12.3
```

## Status

- audit:tenant-isolation ✅
- audit:secret-sinks ✅
- audit:contracts-sync ✅
- audit:fire-and-forget ✅
- audit:determinism ✅
- audit:auth-role-mapping ✅
- test:invariants ✅ (28 tests)
- test:redteam:p0 ✅
