# Dataflow 7: WebSocket Subscribe → Broadcast → Client Cache

> Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §32.2.

## Trust boundaries

```text
[client]    --(WS upgrade)-->   [auth check]
                                    |
                                    v
[server]    --(tenant scope)->  [subscription]
                                    |
                                    v
[broadcast] --(filter)-->       [fan-out]
                                    |
                                    v
[client cache]  --(UI)-->       [rendered state]
```

## Threats

| ID | Threat | Boundary | Failure mode | Required gate |
|---|---|---|---|---|
| THR-7.1 | Broadcast emits to all clients regardless of tenant | fan-out | cross-tenant leak | `audit:tenant-isolation` (rule: `tenant_isolation.broadcast_unscoped`) |
| THR-7.2 | WS upgrade accepted without origin check | auth | CSRF / cross-origin leak | `audit:ui-token-storage` (origin check) |
| THR-7.3 | WS frame handler throws and is not caught | protocol | connection drop | `audit:ui-token-storage` (malformed frame) |
| THR-7.4 | Client caches a token and the server never invalidates | cache | stale credentials | `audit:ui-token-storage` (token rotation) |

## Side-effect boundary

WebSocket broadcasts do not produce durable state, but they do produce
observability events (frame log, broadcast log) which must be redaction-
clean (audit:secret-sinks).

## Evidence boundary

The broadcast log itself is part of the audit chain.

## Required gates

```text
audit:tenant-isolation          # §9.1
audit:ui-token-storage          # §13.1
audit:secret-sinks              # §9.2
```

## Status

- audit:tenant-isolation OK
- audit:ui-token-storage OK
- audit:secret-sinks OK
