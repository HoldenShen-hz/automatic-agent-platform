# Dataflow 6: Secret Provider → Runtime Config → Logger/Event/Span sinks

> Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §32.2.

## Trust boundaries

```text
[secret store]  --(SecretProvider)-->   [runtime config]
                                              |
                                              v
[logger/event/span/metric]  --(consume)-->   [observability sink]
```

## Threats

| ID | Threat | Boundary | Failure mode | Required gate |
|---|---|---|---|---|
| THR-6.1 | Secret identifier reaches `console.log` / `console.error` | sink | credential leak in stdout | `audit:secret-sinks` (rule: `secret_sink.console`) |
| THR-6.2 | Secret identifier reaches `logger.info/warn/error` | sink | credential leak in log aggregation | `audit:secret-sinks` (rule: `secret_sink.logger`) |
| THR-6.3 | Secret embedded in `throw new Error` template | sink | credential leak in stack traces | `audit:secret-sinks` (rule: `secret_sink.interpolation`) |
| THR-6.4 | Secret in span attribute or metric label | sink | credential leak in traces/metrics | `audit:secret-sinks` (rule: `secret_sink.span_attribute`, `metric_label`) |
| THR-6.5 | Secret in event publish payload | event | credential leak to subscribers | `audit:secret-sinks` (rule: `secret_sink.event_publish`) |
| THR-6.6 | Secret in `audit.record({ metadata })` | audit | credential leak in audit | `audit:secret-sinks` (rule: `secret_sink.audit_record`) |

## Side-effect boundary

Logging is a side-effect that is often assumed to be safe. The audit
treats it as a sink and requires redaction at the boundary.

## Evidence boundary

Secret access events are themselves audit-relevant. They are recorded
as `secret.access` events with the secret's reference id (NOT the
secret value) anchored in the audit chain.

## Required gates

```text
audit:secret-sinks              # §9.2
audit:audit-chain               # §11.1
audit:determinism               # (no Date.now in secret rotation logic)
```

## Status

- audit:secret-sinks ✅
- audit:audit-chain ✅
- audit:determinism ✅
