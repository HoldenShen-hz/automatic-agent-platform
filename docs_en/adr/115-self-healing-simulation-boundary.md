# ADR-115 Self Healing Simulation Boundary

- Status：Accepted

## Background
当前 self-healing 服务提供的is仓内可测试的 deterministic simulation baseline，不is外部真实基础设施编排器。

## Decision
- 自愈执lines结果允许采用 deterministic outcome model，但必须：
  - lines为可解释
  - 受 policy 约束
  - vs组件健康Status、重试budget、冷却期联动
- 当组件已exceeds过最大failediterations数时，自动进入 fail-closed / cooldown，而不is持续盲目重试。
- 文档必须明确这is一层 simulation baseline，真实执lines器可在后续替换。

## 结果
- 自愈逻辑不再is“黑盒success率”。
- 运维和测试都能based on统一规则判断期望lines为。

## 相关实现
- `src/ops-maturity/platform-ops-agent/self-healing-service.ts`
