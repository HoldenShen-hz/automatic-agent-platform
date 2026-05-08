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

v2.7 `§41-§42` 要求平台支持主动式 Agent 与渐进式自主权。当前仓库已有：

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

自主权采用 4 级分层命名体系：

| 等级 | 名称 | 说明 |
|------|------|------|
| **L0** | `manual_only` | 所有操作需人工确认 |
| **L1** | `suggest_only` | Agent 提供建议，人工决策 |
| **L2** | `supervised_execute` | 执行需人审批准，可自动执行 |
| **L3** | `trusted_auto_execute` | 高置信度下自动执行，定期审计 |

约束：
- L3 信任自动执行需满足：历史准确率 > 95%、无高风险标记、连续运行时长 < 阈值
- 任何等级均可被人工降级或冻结
- 等级晋升必须经过评估期（evaluate_0）验证

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

