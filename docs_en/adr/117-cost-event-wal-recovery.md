# ADR-117 Cost Event WAL Recovery

- Status：Accepted

## Background
成本事件写前日志已viareferences入 pending/committed Status，但 orphaned pending entry 的恢复策略之前没有权威Description。

## Decision
- pending WAL entry 必须可被定期 sweep。
- orphan 判定至少contains：
  - Status仍为 `pending`
  - exceeds过恢复窗口
  - no对应 commit / settle 证据
- 恢复动作允许两class：
  - 标记为 `orphaned` 进入人工审计
  - security删除并输出审计record
- `unsourcedRecordCount` only作为观测指标，不替代 WAL 恢复器。

## 结果
- 成本台账 crash recovery 不再停留在comment层。

## 相关实现
- `src/platform/five-plane-control-plane/cost-alert/*`
- `src/ops-maturity/cost-optimizer/*`
