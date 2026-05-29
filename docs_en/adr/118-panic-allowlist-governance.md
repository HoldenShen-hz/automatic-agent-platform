# ADR-118 Panic Allowlist Governance

- Status：Accepted

## Background
panic mode 的 allowList 具有强 break-glass 性质，但之前没有权威治理Description。

## Decision
- allowList onlyused for break-glass 场景，不作为常规放lines机制。
- allowList 命中不等于no限permission；仍需保留审计、速率控制vs高风险动作限制。
- allowList 成员加入、变更、移除必须走治理审批vs审计留痕。
- panic allowList vsExecution Plane admission control 必须保持一致口径，不允许一边放lines、一边no审计。

## 结果
- 将“特权bypassing”收敛为受治理的紧急能力，而不is隐式后门。

## 相关实现
- `src/ops-maturity/emergency/platform-panic-service.ts`
