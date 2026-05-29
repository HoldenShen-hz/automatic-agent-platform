# Capacity Planning

## Baseline

| Scenario | Single Pod CPU | Single Pod Memory | Description |
| --- | --- | --- | --- |
| Idle API | ~0.15 vCPU | ~120 MiB | No active tasks |
| Medium concurrency | ~0.6 vCPU | ~320 MiB | ~50 concurrent API requests |
| High load execution | ~1.5 vCPU | ~700 MiB | task execution + queue + websocket overlay |

## Alignment with Helm Prod Baseline

- `deploy/helm/automatic-agent/values-prod.yaml` current prod baseline is `replicaCount: 3`, `requests.cpu: 500m`, `requests.memory: 512Mi`, `limits.cpu: 2`, `limits.memory: 1Gi`.
- Therefore, the minimum recommended production capacity is no longer written as 2 Pod / 1 vCPU / 512 MiB, but starts at 3 Pod and allows HPA to scale between `3-10` replicas.

## Size Recommendations

- Small-scale verification: `3` pods, `500m` request / `2` CPU limit, `512Mi` request / `1Gi` limit, shared PostgreSQL and Redis.
- Medium load: `4-6` pods, continuing with `2 CPU / 1Gi` single Pod upper limit, increase PostgreSQL connection budget and switch to standalone Redis.
- Large-scale load: `8+` pods, maintain `2 CPU / 1Gi` upper limit per Pod and absorb pressure through horizontal scaling, state layer switches to multi-AZ PostgreSQL with standalone queue/cache tier.

## Estimation Formulas

- API pod count: `ceil(target_qps / 200)`, then take max with HPA `minReplicas=3`.
- PostgreSQL connection budget: `pod_count * pool_max <= database_connection_budget * 0.7`.
- Redis memory budget: `active_keys * average_value_size * 1.5`.

## Verification Loop

1. Use `tests/integration/ops-maturity/capacity-planning-integration.test.ts` as repeatable baseline; unit tests see `tests/unit/ops-maturity/capacity-planning-service.test.ts`.
2. Gradually increase concurrency in phases, and record CPU, memory, queue depth and DB waiters.
3. Whenever a release changes Pod efficiency, query patterns, or HPA strategy, synchronously update this document.