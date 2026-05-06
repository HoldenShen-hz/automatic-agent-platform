# Capacity Planning

本运行手册消费 `docs_zh/contracts/capacity_planning_contract.md` 中冻结的 canonical 对象，尤其是：

- `CapacitySignal`：采样输入，记录 `resource_type / usage / queue_depth / error_budget_burn`
- `CapacityForecast`：容量预测输出，必须带时间窗口与置信区间
- `CapacityScenario`：what-if 扩缩容仿真对象
- `CapacityAlert`：forecast 越线时的显式预警对象
- `CapacityRecommendation`：综合成本与 SLO 风险后的建议对象

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
2. Increase concurrency in controlled steps and persist sampled runtime metrics as `CapacitySignal`.
3. For each target deployment size, generate at least one `CapacityForecast` and one `CapacityScenario` to compare “keep / scale out / scale down” outcomes.
4. When predicted utilization crosses the operating threshold, emit and archive a `CapacityAlert` together with the chosen `CapacityRecommendation`.
5. Update this document when a new release changes pod efficiency or query behavior.
