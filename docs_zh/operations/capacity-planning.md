# Capacity Planning

## Baseline

| Scenario | Pod CPU | Pod Memory | Notes |
| --- | --- | --- | --- |
| Idle API | ~0.15 vCPU | ~120 MiB | No active tasks |
| Moderate concurrency | ~0.6 vCPU | ~320 MiB | 50 concurrent API requests |
| Heavy execution | ~1.5 vCPU | ~700 MiB | Task execution + queue + websocket load |

## Sizing Guidance
- Small footprint: `2` pods, `1 vCPU`, `512 MiB`, single PostgreSQL instance, shared Redis.
- Medium footprint: `4-6` pods, `2 vCPU`, `1 GiB`, PostgreSQL with higher connection ceiling, dedicated Redis.
- Large footprint: `8+` pods, `4 vCPU`, `2 GiB`, multi-AZ PostgreSQL and dedicated queue/cache tiers.

## Formulas
- API pod count: `ceil(target_qps / 200) + 1` safety replica.
- PostgreSQL pool budget: `pod_count * pool_max <= database_connection_budget * 0.7`.
- Redis memory budget: `active_keys * average_value_size * 1.5`.

## Validation Loop
1. Run `tests/integration/ops-maturity/capacity-planning-integration.test.ts` as the reproducible baseline (see `tests/unit/ops-maturity/capacity-planning-service.test.ts` for unit tests).
2. Increase concurrency in controlled steps and record CPU, memory, queue depth, and DB waiters.
3. Update this document when a new release changes pod efficiency or query behavior.
