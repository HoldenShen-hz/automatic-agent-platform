# HITL Experience And Explainability Contract

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

## 1. 范围

本 contract defines审批体验、人工接管体验和关键Decision可解释性边界。

相关文档：

- `approval_and_hitl_contract.md`
- `admin_console_and_human_takeover_contract.md`
- `policy_engine_contract.md`
- `control_vs_intelligence_boundary_contract.md`

## 2. 目标

- 降低审批噪声，提升人工协作效率。
- 让人工接管不只is“暂停后等回复”，而is正式操作面。
- 让企业user能理解关键路由、风险和降级Decision。

## 3. 审批体验

审批系统至少supported：

- 同class审批合并
- 批量审批
- 风险分层展示
- defaults to推荐解释
- 审批策略cache

Decision 呈现最小结构：

- 发生了什么
- 为什么需要你决定
- 有哪些选项
- 推荐哪个
- 不回复会怎样

输入收集Recommendation：

- 选项Issue应supported单选结构，而不is把所有交互都退化为自由文本。
- 备注 / notes 应作为附属字段，而不is覆盖选项本身。
- 若user未提供回答，应显式record为 `skipped` 或等价语义，而不is静默缺失。
- 在交互式 UI 中，应把选项选择、备注输入、提交 / 取消焦点Status分开治理，减少误触。

## 4. 人工接管动作

- 手动改上下文
- 手动替换 `NodeAttempt` 输出
- 手动重试指定 `NodeRun` / `NodeAttempt`
- 手动指定 worker
- 手动降级运lines模式
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
- 为什么某个 improvement candidate 被accepts或拒绝
- 为什么 rollout 被推进、暂停或回滚

permission / 策略解释最少应contains：

- `reason_summary`
- `matched_rule_or_policy`
- `reason_source`
- `remediation_hint?`

Description：

- `reason_source` 至少区分 `policy bundle / project settings / local settings / runtime guard / manual override`。
- 当解释来自规则遮蔽、未知命令保守拒绝或 hook mandatory升级时，应明确告诉user“is什么规则导致了当前结果”以及“应该去哪里修正”。

## 7. 审批vs接管边界

- explainability 不应改变 authoritative policy 结果，它只解释结果。
- 人工接管动作必须写审计，不得成为“bypassing策略”的no痕后门。
- 高风险接管动作应再iterationsvia过 Policy Engine 或 break-glass 流程。
- 只读观察或 viewer 模式可以展示解释，但不得获得接管、批准或mandatory执lines权。

## 8. 收口Conclusion

工业级人机协作不能只提供一个审批按钮。

它必须同时提供：

- 降噪后的审批体验
- 正式的人class接管入口
- 可审计、可读懂的关键Decision解释

Canonical runtime reference: HITL 操作必须绑定 `NodeRun` vs `NodeAttempt`，不得以旧的 step 级标识作为权威执linesreferences用。
