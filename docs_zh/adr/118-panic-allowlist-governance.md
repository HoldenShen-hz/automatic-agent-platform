# ADR-118 Panic Allowlist Governance

- 状态：Accepted

## 背景
panic mode 的 allowList 具有强 break-glass 性质，但之前没有权威治理说明。

## 决策
- allowList 仅用于 break-glass 场景，不作为常规放行机制。
- allowList 命中不等于无限权限；仍需保留审计、速率控制与高风险动作限制。
- allowList 成员加入、变更、移除必须走治理审批与审计留痕。
- panic allowList 与执行面 admission control 必须保持一致口径，不允许一边放行、一边无审计。

## 结果
- 将“特权绕过”收敛为受治理的紧急能力，而不是隐式后门。

## 相关实现
- `src/ops-maturity/emergency/platform-panic-service.ts`
