# 容量规划

## 基线

| 场景 | 单 Pod CPU | 单 Pod 内存 | Description |
|---|-------|--------| --- |
| 空闲 API | ~0.15 vCPU | ~120 MiB | no活跃任务 |
| 中等concurrent | ~0.6 vCPU | ~320 MiB | 约 50 concurrent API request |
| 高负载执lines | ~1.5 vCPU | ~700 MiB | task execution + queue + websocket 叠加 |

## vs Helm prod 基线对齐

- `deploy/helm/automatic-agent/values-prod.yaml` 当前 prod 基线is `replicaCount: 3`，`requests.cpu: 500m`，`requests.memory: 512Mi`，`limits.cpu: 2`，`limits.memory: 1Gi`。
- 因此生产最小推荐容量不再写成 2 Pod / 1 vCPU / 512 MiB，而is以 3 Pod 起步，并允许 HPA 在 `3-10` 副本间扩展。

## 规格Recommendation

- 小规模验证：`3` pods，`500m` request / `2` CPU limit，`512Mi` request / `1Gi` limit，共享 PostgreSQL vs Redis。
- 中等负载：`4-6` pods，accesses along用 `2 CPU / 1Gi` 单 Pod upper limit，提升 PostgreSQL connectbudget并切独立 Redis。
- 大规模负载：`8+` pods，保持每 Pod `2 CPU / 1Gi` upper limit并via横向扩容吸收压力，Status层切多 AZ PostgreSQL vs独立 queue/cache tier。

## 估算公式

- API pod 数：`ceil(target_qps / 200)`，然后vs HPA `minReplicas=3` 取最大值。
- PostgreSQL connectbudget：`pod_count * pool_max <= database_connection_budget * 0.7`。
- Redis 内存budget：`active_keys * average_value_size * 1.5`。

## 验证闭环

1. 用 `tests/integration/ops-maturity/capacity-planning-integration.test.ts` 作为可repeats基线；单测见 `tests/unit/ops-maturity/capacity-planning-service.test.ts`。
2. 分阶段提升concurrent，并record CPU、内存、队列深度vs DB waiters。
3. 只要 release 改变了 Pod 效率、查询形态或 HPA 策略，就synchronous更新本文档。
