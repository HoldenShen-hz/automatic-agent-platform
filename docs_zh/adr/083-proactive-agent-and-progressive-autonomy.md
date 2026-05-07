# ADR-083 Proactive Agent And Progressive Autonomy

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：事件、阈值、定时器与外部信号监听
- **Assess**：触发条件评估、信任积分与风险门禁
- **Plan**：触发动作选择、建议模式或自动模式决策
- **Execute**：主动触发任务、建议、看板更新
- **Feedback**：主动建议接受率、误报率、失败率
- **Learn**：触发器与自治等级的持续校准
- **Improve**：自治晋升 / 降级策略优化
- **Release**：主动式能力与自治规则灰度发布

---

- 状态：Accepted
- 决策日期：2026-04-20

## 背景

v4.3 `§41-§42` 要求平台支持主动式 Agent 与渐进式自主权。当前仓库已有：

- `src/interaction/proactive-agent`
- `src/interaction/autonomy`

但两者尚未被一个统一决策串起来。

## 决策

### 1. 主动式 Agent 只能通过声明式 TriggerDefinition 工作

主动式行为必须经过显式 trigger 声明，最少包含：

- trigger source
- trigger condition
- rate limit
- cooldown
- action template
- risk level

### 2. 自主权不是布尔开关，而是等级状态机

ADR-083 需要显式区分两层语义，避免把 interaction autonomy 和 runtime mode 混成一个枚举：

- `InteractionAutonomyLevel`：面向主动式 Agent 的自治梯子
- `UnifiedRuntimeMode`：面向执行/治理面的 8 态运行模式

`InteractionAutonomyLevel` 与 ADR-042 保持一致，采用 5 级自治模型加冻结态：

| 等级 | 名称 | 权限 |
|------|------|------|
| 0 | suggestion | 仅提供建议，需人工确认 |
| 1 | supervised | 人工监督执行 |
| 2 | semi_auto | 半自动，可自动执行但需人工监督 |
| 3 | full_auto | 完全自动化 |
| freeze | frozen | 冻结，需人工恢复 |

注：`full_auto` 不代表无限制自动化；高危域默认不得进入 `full_auto`，除非存在显式 `DomainRiskSpec / DomainRiskProfile` 允许并附带人工责任边界。

运行时仍必须再映射到 `UnifiedRuntimeMode`：

| InteractionAutonomyLevel | UnifiedRuntimeMode |
| --- | --- |
| `full_auto` | `full_auto` |
| `semi_auto` | `supervised_auto` |
| `supervised` | `manual_only` |
| `suggestion` | `no_write` |
| `frozen` | `incident_mode` |

自主权等级必须可以晋升、降级和冻结。

### 3. 主动触发与自治等级解耦

是否触发由 trigger 决定；
触发后采取“建议 / 人审 / 自动执行”由 autonomy level 决定。

### 4. 自治等级变更必须可审计

每次自治等级变化必须记录：

- old level
- new level
- reason codes
- evidence snapshot
- approver / policy source

## 后果

- 主动式能力不会绕过审批、预算与风险引擎
- 自治升级不再是静态配置，而是持续治理问题
- `src/interaction/proactive-agent` 与 `src/interaction/autonomy` 将共享统一 contract
