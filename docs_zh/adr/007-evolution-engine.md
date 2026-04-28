# ADR-007 进化引擎

- 状态：Partially Superseded by ADR-075
- 决策日期：2026-04-02
- 部分取代：ADR-075 的六级发布模型已取代其中"Release 仅允许 off/suggest/shadow 三档"的描述

## 背景

静态 Prompt、静态模型和静态策略会随着任务分布变化逐渐失效。平台希望形成“执行、评估、优化、回滚”的闭环，但不能让系统因为自我修改而变得不可控。

## 决策

通过 OAPEFLIR 副链 `Feedback → Learn → Improve → Release` 驱动进化，并由 deterministic guardrail 控制进入生产：

- HarnessRuntime 负责生命周期管理、实时监控、健康检查与指标采集。
- Feedback Hub 负责把执行信号归一为结构化 `FeedbackSignal`。
- Learn Hub 只允许 evidence-backed 学习对象进入后续阶段，并显式维护 `promotionStatus`。
- Improve Hub 只接收 `validated/promoted` 的 LearningObject。
- Release 在当前 phase1-4 仅允许 `off / suggest / shadow` 三档，不直接开放 canary/staged。
- 任何变更都必须可回滚、可审计、可灰度、可暂停。

## HarnessRuntime 生命周期控制

v4.3 §45 将所有生命周期控制收口到 HarnessRuntime：

- 管理 Agent 生命周期。
- 跟踪心跳、上下文占用、工具调用和资源使用。
- 评估成功率、成本、时延和质量信号。
- 在必要时重启、暂停、升级或终止异常 Agent。

## 进化维度

8 个维度可概括为：

1. Prompt 优化。
2. 计算预算自适应。
3. 工具调用优化与 Skill 沉淀。
4. 能力画像与反思记忆。
5. 预检查失败分析。
6. Reflexion / Self-Refine / 经验回放。
7. 推理策略自适应选择。
8. 多 Agent 协作优化与评估函数进化。

## MVP 范围

当前 phase1-4 的实际 MVP 收口为：

- Feedback：去重、关联、恢复路径识别。
- Learn：仅支持 `failure_pattern`、`user_correction`、`recovery_playbook` 三类学习对象。
- Improve：只允许 evidence-backed 且 validated 的 LearningObject 进入候选。
- Release：仅支持 `off / suggest / shadow`。

其他更重的进化能力，如多阶段 canary、auto-rollback、更多学习类型，继续延后。

## 安全总则

进化必须遵守几条铁律：

- 不可降级：新策略上线前必须证明不劣于现状。
- 可逆：每次变更都要有快照和回滚点。
- 可控：必须可以一键暂停。
- 可审计：所有变化都写入 evolution log。
- 可灰度：先在小流量上验证，再逐步放量。
- 不可越权：模型只能提议 LearningObject / Candidate，不能直接推进 `promotionStatus`、`candidate.status` 或 `rollout.status`。

## 告警与观测

HarnessRuntime / observability 应对以下事件给出告警或通知：

- 上下文逼近阈值。
- Agent 疑似卡死。
- Agent 异常终止。
- 进化事件成功或回滚。
- 成本告警。
- OAPEFLIR 阶段时间线异常。
- Learn validation 失败或 rollout guardrail 阻断。

## 结果

优点：

- 平台能够基于真实运行数据迭代，而不是只靠人工凭经验调参。
- 将优化过程纳入统一治理和审计。
- 让进化从“神秘调参”变成受约束的工程流程。
- 让主链和副链之间的边界更清晰，减少“执行逻辑里偷偷自我修改”的风险。

代价：

- 指标质量直接决定优化质量。
- 如果没有离线回测、灰度和回滚，进化会成为新的不稳定源。
- 过早引入全部 8 个维度会显著增加系统复杂度。

## 当前实现对齐

截至当前 phase1-4 交付，已对齐部分包括：

- `FeedbackCollector` + `SignalPreprocessor` 已形成结构化 learning input。
- `LearningObjectValidator` 已把 evidence 与 `promotionStatus` 变成硬边界。
- `PolicyRolloutService` + `GuardrailEvaluator` 已把 rollout 放行从模型建议收回到系统代码。
- `OapeflirLoopService` 已持久化阶段时间线视角，便于审计主链/副链闭环。

## 交叉引用

- [ADR-003 六层记忆与 KV Cache 固定前缀](./003-memory-seven-layers.md)
- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [ADR-008 成本模型](./008-cost-model.md)

## 来源章节

- `OAPEFLIR §7`
- `OAPEFLIR §8`
- `OAPEFLIR §9`
- `OAPEFLIR §E.1`
- `OAPEFLIR §L.3.2`

## v4.3 ADR Remediation

- R6-51: 修复生命周期所有权归属。ADR-007 原先描述 "Supervisor / observability 继续负责生命周期管理"，与 v4.3 §45 将所有生命周期控制收口到 HarnessRuntime 的决策冲突。修复：正文改为 "HarnessRuntime 负责生命周期管理、实时监控、健康检查与指标采集"。
