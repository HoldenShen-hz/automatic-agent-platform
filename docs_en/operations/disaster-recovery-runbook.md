# 灾难恢复操作手册

本文档补充 ADR-031 的执lines步骤，used for区域不可用、data库不可写、队列不可用和关键运lines时恢复。

当前执lines口径vs `config/dr/default.json` 保持一致：

- `RTO <= 1 小时`
- `RPO <= 5 分钟`

## 触发条件

- 主区域 API、worker 或data库连续不可用exceeds过 RTO 门限。
- datawritesfailed且no法via局部重试恢复。
- 队列或事件证据链出现不可accepts的delay或丢失风险。

## 准备检查

1. 确认 incident commander 和审批人。
2. 冻结非必要部署。
3. export当前健康检查、队列深度、data库复制Status和最近事件证据。
4. 确认备份快照、恢复点和目标区域容量。
5. uses `bash deploy/scripts/dr-drill.sh --mode verify --component all --output-dir .dr-reports/manual-verify` 先验证现有备份可读。

## 恢复步骤

1. 切换入口流量到备用区域或降级入口。
2. 启动备用 worker 和Control Plane服务。
3. 恢复data库到目标恢复点，并执lines只读校验。
4. 恢复队列消费，先enabled低concurrent，再逐步恢复正常concurrent。
5. 执lines runtime recovery 定向检查，确认 stale、blocked、dead-letter 视图可用。
6. record恢复窗口、data缺口和人工审批动作。

## 回滚

- 若备用区域恢复failed，停止新增writes并保持只读Status。
- 回退流量前必须确认主区域writes路径和事件证据链一致。

## 证据

- 健康检查输出。
- data库恢复日志。
- 队列深度和消费恢复record。
- runtime recovery 报告。
- 事后 postmortem。
