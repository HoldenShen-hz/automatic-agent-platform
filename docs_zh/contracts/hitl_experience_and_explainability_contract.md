# HITL Experience And Explainability Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 release
- **Release**：受控发布与回滚

---

## 1. 范围

本 contract 定义审批体验、人工接管体验和关键决策可解释性边界。

相关文档：

- `approval_and_hitl_contract.md`
- `admin_console_and_human_takeover_contract.md`
- `policy_engine_contract.md`
- `control_vs_intelligence_boundary_contract.md`

## 2. 目标

- 降低审批噪声，提升人工协作效率。
- 让人工接管不只是“暂停后等回复”，而是正式操作面。
- 让企业用户能理解关键路由、风险和降级决策。

## 3. 审批体验

审批系统至少支持：

- 同类审批合并
- 批量审批
- 风险分层展示
- 默认推荐解释
- 审批策略缓存

Decision 呈现最小结构：

- 发生了什么
- 为什么需要你决定
- 有哪些选项
- 推荐哪个
- 不回复会怎样

输入收集建议：

- 选项问题应支持单选结构，而不是把所有交互都退化为自由文本。
- 备注 / notes 应作为附属字段，而不是覆盖选项本身。
- 若用户未提供回答，应显式记录为 `skipped` 或等价语义，而不是静默缺失。
- 在交互式 UI 中，应把选项选择、备注输入、提交 / 取消焦点状态分开治理，减少误触。

## 4. 人工接管动作

- 手动改上下文
- 手动替换步骤输出
- 手动重试指定 step
- 手动指定 worker
- 手动降级运行模式
- 结束任务并归档原因
- 标记任务不可恢复

## 5. 可解释性对象

- `DecisionExplanation`
- `RoutingExplanation`
- `RiskExplanation`
- `FallbackExplanation`
- `TakeoverJustification`

## 6. 可解释性要求

系统至少能解释：

- 为什么选择这个 division
- 为什么升级 HITL
- 为什么拒绝某命令
- 为什么判定重试
- 为什么切换模型 / worker / provider
- 为什么批准、拒绝或要求双审批
- 为什么某个 feedback signal 被采纳或忽略
- 为什么某个 improvement candidate 被接受或拒绝
- 为什么 release 被推进、暂停或回滚

权限 / 策略解释最少应包含：

- `reason_summary`
- `matched_rule_or_policy`
- `reason_source`
- `remediation_hint?`

说明：

- `reason_source` 至少区分 `policy bundle / project settings / local settings / runtime guard / manual override`。
- 当解释来自规则遮蔽、未知命令保守拒绝或 hook 强制升级时，应明确告诉用户“是什么规则导致了当前结果”以及“应该去哪里修正”。

## 7. 审批与接管边界

- explainability 不应改变 authoritative policy 结果，它只解释结果。
- 人工接管动作必须写审计，不得成为“绕过策略”的无痕后门。
- 高风险接管动作应再次经过 Policy Engine 或 break-glass 流程。
- 只读观察或 viewer 模式可以展示解释，但不得获得接管、批准或强制执行权。

## 8. 收口结论

工业级人机协作不能只提供一个审批按钮。

它必须同时提供：

- 降噪后的审批体验
- 正式的人类接管入口
- 可审计、可读懂的关键决策解释

## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- R16-86: 本 contract 定义 HITL 审批与人工接管，但未明确接管动作必须锚定 v4.3 canonical entity。修复：正文现明确人工接管动作必须作用于 `HarnessRun` / `NodeRun` / `NodeAttempt`，不得以旧 `execution_id` / `step_id` 作为权威作用域；审批展示的 `task_id` 必须能映射到对应 `harness_run_id`。

强制规则：所有改变运行态的 takeover 动作必须通过 `RuntimeStateMachine.transition(command)` 并携带 `harness_run_id` / `node_run_id` 作用域；`DecisionExplanation` / `TakeoverJustification` 必须引用 v4.3 canonical entity，不得引用旧 `TaskRecord` / `ExecutionReceipt` 作为 truth source。
