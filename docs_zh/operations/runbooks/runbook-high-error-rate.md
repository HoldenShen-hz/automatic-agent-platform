# 高错误率 Runbook

## 症状

- `AutomaticAgentHighErrorRate` 告警触发
- `/healthz` 仍可访问，但 5xx 比例上升
- operator 反馈任务失败或 API retry 明显增多

## 诊断

1. 在 Prometheus/Grafana 中检查近期 `aa_error_rate:rate5m`、请求量和任务执行趋势。
2. 查看 `api-server` 日志，确认失败最多的 route 和 error code。
3. 在 Kubernetes/Helm 环境下，用 `kubectl get pods`、`kubectl logs` 和平台健康面板确认数据库与 Redis 健康；`docker compose ps` 只适用于本地栈。
4. 检查近期 rollout、policy 变更或 plugin 激活是否与错误尖峰同时间发生。

## 处置

1. 如果尖峰与近期 rollout 同步，先暂停或回滚候选 release。
2. 如果问题只集中在单一路由或 plugin，先下掉该路径，保住核心流量。
3. 如果下游依赖劣化，切到 degraded mode 并削减非关键流量。
4. 如果根因是饱和，扩 `api-server` 副本或降低并发负载。

## 验证

1. 确认 5xx 比例回落到 5% 以下并持续至少 10 分钟。
2. 验证 queue backlog 和 task failure rate 回到基线。
3. 只有在告警解除且用户侧影响停止后，才关闭 incident。
