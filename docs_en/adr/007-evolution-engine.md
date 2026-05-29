# ADR-007 进化references擎

- Status：Partially Superseded by ADR-075
- Decision日期：2026-04-02
- 部分取代：ADR-075 的六级发布模型已取代其中"Release only允许 off/suggest/shadow 三档"的Description

## Background

静态 Prompt、静态模型和静态策略会随着任务分布变化逐渐失效。平台希望形成“执lines、评估、优化、回滚”的闭环，但不能让系统因为自我修改而变得不可控。

## Decision

via OAPEFLIR 副链 `Feedback → Learn → Improve → Release` 驱动进化，并由 deterministic guardrail 控制进入生产：

- Supervisor / observability 继续负责生命cyclemanage、实时监控、健康检查vs指标采集。
- Feedback Hub 负责把执lines信号归一为结构化 `FeedbackSignal`。
- Learn Hub 只允许 evidence-backed 学习对象进入后续阶段，并显式维护 `promotionStatus`。
- Improve Hub 只接收 `validated/promoted` 的 LearningObject。
- Release 在当前 phase1-4 only允许 `off / suggest / shadow` 三档，不directly开放 canary/staged。
- 任何变更都必须可回滚、可审计、可灰度、可暂停。

## Supervisor 角色

Supervisor 不只is监控器，还承担治理职责：

- manage Agent 生命cycle。
- 跟踪心跳、上下文占用、工具call和资源uses。
- 评估success率、成本、时延和质量信号。
- 在必要时重启、暂停、升级或终止异常 Agent。

## 进化维度

8 个维度可概括为：

1. Prompt 优化。
2. 计算budget自适应。
3. 工具call优化vs Skill 沉淀。
4. 能力画像vs反思记忆。
5. 预检查failed分析。
6. Reflexion / Self-Refine / via验回放。
7. 推理策略自适应选择。
8. 多 Agent 协作优化vs评估function进化。

## MVP 范围

当前 phase1-4 的实际 MVP 收口为：

- Feedback：for deduplication、关联、恢复路径识别。
- Learn：onlysupported `failure_pattern`、`user_correction`、`recovery_playbook` 三class学习对象。
- Improve：只允许 evidence-backed 且 validated 的 LearningObject 进入候选。
- Release：onlysupported `off / suggest / shadow`。

其他更重的进化能力，如多阶段 canary、auto-rollback、更多学习class型，继续延后。

## security总则

进化必须遵守几条铁律：

- 不可降级：新策略上线前必须证明不劣于现状。
- 可逆：每iterations变更都要有快照和回滚点。
- 可控：必须可以一键暂停。
- 可审计：所有变化都writes evolution log。
- 可灰度：先在小流量上验证，再逐步放量。
- 不可越权：模型只能提议 LearningObject / Candidate，不能directly推进 `promotionStatus`、`candidate.status` 或 `rollout.status`。

## 告警vs观测

Supervisor / observability 应对以下事件给出告警或通知：

- 上下文逼近threshold。
- Agent 疑似卡死。
- Agent 异常终止。
- 进化事件success或回滚。
- 成本告警。
- OAPEFLIR 阶段time线异常。
- Learn validation failed或 rollout guardrail 阻断。

## 结果

优点：

- 平台能够based on真实运linesdata迭代，而不is只靠人工凭via验调参。
- 将优化过程纳入统一治理和审计。
- 让进化从“神秘调参”变成受约束的工程流程。
- 让主链和副链之间的边界更清晰，减少“执lines逻辑里偷偷自我修改”的风险。

代价：

- 指标质量directly决定优化质量。
- 如果没有离线回测、灰度和回滚，进化会成为新的不稳定源。
- 过早references入全部 8 个维度会显著增加系统复杂度。

## 当前实现对齐

截至当前 phase1-4 交付，已对齐部分includes：

- `FeedbackCollector` + `SignalPreprocessor` 已形成结构化 learning input。
- `LearningObjectValidator` 已把 evidence vs `promotionStatus` 变成硬边界。
- `PolicyRolloutService` + `GuardrailEvaluator` 已把 rollout 放lines从模型Recommendation收回到系统code。
- `OapeflirLoopService` 已持久化阶段time线视角，便于审计主链/副链闭环。

## 交叉references用

- [ADR-003 六层记忆vs KV Cache 固定前缀](./003-memory-six-layers.md)
- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [ADR-008 成本模型](./008-cost-model.md)

## 来源章节

- `OAPEFLIR §7`
- `OAPEFLIR §8`
- `OAPEFLIR §9`
- `OAPEFLIR §E.1`
- `OAPEFLIR §L.3.2`
