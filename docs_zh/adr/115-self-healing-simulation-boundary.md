# ADR-115 Self Healing Simulation Boundary

- 状态：Accepted

## 背景
当前 self-healing 服务提供的是仓内可测试的 deterministic simulation baseline，不是外部真实基础设施编排器。

## 决策
- 自愈执行结果允许采用 deterministic outcome model，但必须：
  - 行为可解释
  - 受 policy 约束
  - 与组件健康状态、重试预算、冷却期联动
- 当组件已超过最大失败次数时，自动进入 fail-closed / cooldown，而不是持续盲目重试。
- 文档必须明确这是一层 simulation baseline，真实执行器可在后续替换。

## 结果
- 自愈逻辑不再是“黑盒成功率”。
- 运维和测试都能基于统一规则判断期望行为。

## 相关实现
- `src/ops-maturity/platform-ops-agent/self-healing-service.ts`
