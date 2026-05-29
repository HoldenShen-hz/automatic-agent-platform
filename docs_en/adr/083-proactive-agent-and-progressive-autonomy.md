# ADR-083 Proactive Agent And Progressive Autonomy

---

## OAPEFLIR 关联

本文档defines OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：事件、threshold、定时器vs外部信号监听
- **Assess**：触发条件评估、信任积分vs风险门禁
- **Plan**：触发动作选择、Recommendation模式或自动模式Decision
- **Execute**：主动触发任务、Recommendation、看板更新
- **Feedback**：主动Recommendationaccepts率、误报率、failed率
- **Learn**：触发器vs自治等级的持续校准
- **Improve**：自治晋升 / 降级策略优化
- **Release**：主动式能力vs自治规则灰度发布

---

- Status：Accepted
- Decision日期：2026-04-20

## Background

v2.7 `§41-§42` 要求平台supported主动式 Agent vs渐进式自主权。当前仓库已有：

- `src/interaction/proactive-agent`
- `src/interaction/autonomy`

但两者尚未被一个统一Decision串起来。

## Decision

### 1. 主动式 Agent 只能via声明式 TriggerDefinition 工作

主动式lines为必须via过显式 trigger 声明，最少contains：

- trigger source
- trigger condition
- rate limit
- cooldown
- action template
- risk level

### 2. 自主权不is布尔开关，而is等级Status机

实现层必须显式区分 `InteractionAutonomyLevel` vs `UnifiedRuntimeMode`：前者决定Recommendation/人审/自动交互边界，后者决定运lines时降级、暂停和 `incident_mode`。

自主权采用 ADR-042 defines的 4 级交互自治命名体系（vs ADR-042 保持一致）：

| 等级 | 名称 | Description |
|------|------|------|
| **L1** | `suggestion` | 只生成Recommendation |
| **L2** | `supervised` | 人工确认后执lines |
| **L3** | `semi_auto` | 低风险自动执lines，高风险升级 |
| **L4** | `full_auto` | 在显式治理边界内自动执lines |

约束：
- 高危域defaults to不得进入 `full_auto`，除非存在显式 `DomainRiskSpec` / `DomainRiskProfile` 允许并附带人工责任边界
- 任何等级均可被人工降级或冻结
- 等级晋升必须via过评估期验证

### 3. 主动触发vs自治等级解耦

isno触发由 trigger 决定；
触发后采取“Recommendation / 人审 / 自动执lines”由 autonomy level 决定。

### 4. 自治等级变更必须可审计

每iterations自治等级变化必须record：

- old level
- new level
- reason codes
- evidence snapshot
- approver / policy source

## Consequences

- 主动式能力不会bypassing审批、budgetvs风险references擎
- 自治升级不再is静态configure，而is持续治理Issue
- `src/interaction/proactive-agent` vs `src/interaction/autonomy` 将共享统一 contract

## v4.3 ADR Remediation

- R3-55: 本 ADR 原先defines第三套自治命名体系，vs ADR-042 互不兼容。修复：正文现明确声明采用 ADR-042 的 `suggestion / supervised / semi_auto / full_auto` 四级体系，两者保持一致。
