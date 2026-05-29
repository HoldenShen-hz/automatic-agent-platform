# ADR-117 Cost Event WAL Recovery

- 状态：Accepted

## 背景
成本事件写前日志已经引入 pending/committed 状态，但 orphaned pending entry 的恢复策略之前没有权威描述。

## 决策
- pending WAL entry 必须可被定期 sweep。
- orphan 判定至少包含：
  - 状态仍为 `pending`
  - 超过恢复窗口
  - 无对应 commit / settle 证据
- 恢复动作允许两类：
  - 标记为 `orphaned` 进入人工审计
  - 安全删除并输出审计记录
- `unsourcedRecordCount` 仅作为观测指标，不替代 WAL 恢复器。

## 结果
- 成本台账 crash recovery 不再停留在注释层。

## 相关实现
- `src/platform/five-plane-control-plane/cost-alert/*`
- `src/ops-maturity/cost-optimizer/*`
