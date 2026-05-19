# ADR-042 渐进式自主权模型

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

不同成熟度的 Agent 需要不同的自主权限，新接入的 Agent 应该逐步赢得信任。

## 决策

### 自主权等级

| 等级 | 名称 | 权限 |
|------|------|------|
| L1 | suggestion | 只生成建议，不自动执行 |
| L2 | supervised | 允许受控执行，但需要人工确认或强监管 |
| L3 | semi_auto | 允许低风险自动执行，高风险仍需升级 |
| L4 | full_auto | 允许在显式边界内自动执行 |

交互自主权枚举需保留 `suggestion` 与 `frozen` 两端：`suggestion` 表示只给建议、不自动执行；`frozen` 表示因风险、panic 或治理策略冻结交互推进。该枚举只描述 interaction autonomy，不等同于 `UnifiedRuntimeMode`。

规则：

- `full_auto` 不代表无限制自动化。
- 高危域默认不得进入 `full_auto`，除非存在显式 `DomainRiskSpec` / `DomainRiskProfile` 允许并附带人工责任边界。
- 若 domain 被标记为 `advisory_only`、`human_accountable` 或 `deterministic_hot_path_only`，则自治等级上限必须低于 `full_auto`。

### 晋升规则

- 基于执行成功率
- 基于风险评估结果
- 基于人工反馈
- 渐进式晋升，避免跃升

### 降级规则

- 连续失败触发降级
- 风险事件触发降级
- 用户可手动降级

### 权限边界

- 每个等级明确权限范围
- 高风险操作需要高等级
- 关键决策保留人工审批

## 后果

优点：

- 渐进式授权降低风险
- 激励 Agent 持续改进
- 明确的权限边界便于管理

代价：

- 晋升/降级逻辑复杂
- 需要完善的监控和评估机制

## 交叉引用

- [ADR-041 主动式 Agent 框架](./041-proactive-agent-framework.md)
- [ADR-083 主动式 Agent 与渐进式自主权](./083-proactive-agent-and-progressive-autonomy.md)

## 来源章节

- `§42` 渐进式自主权模型

## v4.3 ADR Remediation

- A-34: 本 ADR 原先把 level 4 `full_auto` 写成”完全自动化”，根因是渐进式自主权 ADR 把自治等级误写成无限授权梯子，没有跟高危域风险覆盖规则绑定。修复：正文现明确高危域默认不得 `full_auto`，除非有显式 `DomainRiskSpec / DomainRiskProfile` 允许。
- R3-54: 本 ADR 曾同时保留 6 级自治实验命名和 §42.1 的 4 级对外交付模型，导致契约与产品表达冲突。修复：正文现统一到 `suggestion / supervised / semi_auto / full_auto` 四级交互自主权；更细粒度的运行时限制继续由 `RuntimeModeEnvelope` 承载。
