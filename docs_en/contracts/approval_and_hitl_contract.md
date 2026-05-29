# Approval And HITL Contract

> **v4.3 兼容Description**：本文件保留为历史审批vs HITL Description。v4.3 裁决和人工责任以 [decision-hitl-contract.md](./decision-hitl-contract.md) 为准；旧 approval status 不能单独作为 `HarnessDecision` 或 `HumanResponsibilityRecord` 的替代。

## 1. 范围

本 contract defines人工Decision升级、审批request、审批结果回传和运lines模式下的lines为差异。

## 2. 关键对象

- `ApprovalRequest`
- `ApprovalDecision`
- `HitlEscalation`
- `ApprovalContext`
- `ApprovalTimeoutPolicy`
- `ApprovalFeedbackLink`

## 3. ApprovalRequest 最小字段

| 字段 | class型 | Description |
|---|-------|--------|
| `approval_id` | `string` | 审批 ID |
| `harness_run_id` | `string` | 关联 `HarnessRun` |
| `node_run_id` | `string?` | 关联 `NodeRun`；针对节点级审批必填 |
| `source_agent_id` | `string` | 发起 Agent |
| `reason` | `string` | 升级原因 |
| `risk_level` | `low \| medium \| high \| critical` | 风险等级 |
| `stage_view_ref` | `OapeflirStage?` | only解释/time线视图references用；不得作为 truth 主键或Status推进依据 |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | 关联证据或发布对象 |
| `options` | `string[]` | optionalDecision |
| `context` | `json` | 相关上下文 |
| `timeout_policy` | `reject \| approve \| remain_pending` | timeout策略 |
| `timeout_auto_action` | `reject \| escalate \| remain_pending \| continue_readonly` | timeout后系统自动执lines的治理动作 |
| `escalation_chain` | `ApprovalEscalationHop[]` | 明确的逐级升级链vs每级时限/责任人 |
| `created_at` | `timestamp` | 发起time |

规则：

- `timeout_policy` is治理request的一部分，但最终只能被系统code收紧，不能被下游 Agent 任意放宽。
- `timeout_auto_action` is控制平面执lines语义，不得由 UI 渲染层或下游 Agent 自lines推断。
- Agent 输出不得越权覆盖已via冻结的timeout策略。
- `critical` 风险defaults to不得uses `approve` 作为timeout策略，除非有显式 break-glass 规则vs额外审计。
- 审批的权威关联键is `harness_run_id` / `node_run_id`；`stage_view_ref` 只能used for解释视图，不得作为 truth source。

`ApprovalEscalationHop` 最小字段：

- `level`
- `reviewer_type`
- `reviewer_ref`
- `timeout_ms`
- `on_timeout`

## 4. ApprovalDecision 最小字段

- `approval_id`
- `decision_type` (`option_selected | confirmed | text_input | rejected | expired`)
- `selected_option_id?`
- `confirmed?`
- `input_text?`
- `responded_by`
- `responded_at`

判别约束：

- `option_selected` 时必须提供 `selected_option_id`，不得同时携带 `confirmed`。
- `confirmed` 时必须提供 `confirmed=true`，不得同时携带 `selected_option_id`。
- `text_input` 时必须提供 `input_text`。
- `rejected` vs `expired` 不得携带前述三class交互字段。
- 同一 `approval_id` 的 decision 只能success应用一iterations；repeats提交必须视为幂等 no-op 或conflicts，而不is再iterations推进业务Status。

## 5. 触发场景

至少includes：

- 成本exceedsthreshold或接近threshold。
- security敏感命令。
- 任务歧义。
- 自愈exceeds出最大尝试iterations数。
- 组织变更。
- 高风险 workflow Recommendation。
- PlanHub 产出高风险计划或不可逆执lines路径。
- FeedbackHub 收到持续负面信号、user纠正或质量异常，需要人工确认occurrences置。
- ImproveHub 尝试accepts策略升级、prompt/policy 变更或候选改进。
- ReleaseHub 尝试推进 rollout level、完成发布或触发 rollback。

## 6. 运lines模式差异

- `supervised`: 高风险lines为defaults to要求审批。
- `auto`: 中低风险可自动放lines，高风险仍审批。
- `full-auto`: only在硬性禁止项之外允许更强自动化，但仍要record升级vsdefaults to策略。

补充规则：

- `full-auto` 不能bypassing硬拒策略、break-glass 策略和双审批要求。
- 运lines模式只Impact“isno允许自动放lines”，不Impact“硬性禁止项isno被拒绝”。

补充Recommendation：

- approval policy 应supported从粗粒度模式逐步演进到细粒度 capability / risk class 级别的结构化configure，而不is只保留单一布尔开关。
- reviewer routing 应显式建模，例如defaults to `user`，后续可references入受限 guardian / reviewer subagent，但该 reviewer 只能给出审批Recommendation或代办handle，不得bypassing最终策略复核。

## 7. lines为约束

- 每个审批request必须可追踪。
- 同一审批结果不得repeats应用。
- timeouthandle必须明确：defaults to拒绝、defaults tovia或暂停等待，不能含糊。
- 同一 `approval_id` 的 decision payload 必须满足判别约束，不能出现互相conflicts字段并存。
- 审批结果落地后，最终动作执lines前必须再iterationsvia过 Policy Engine 复核，防止环境变化后仍accesses along用旧批准。
- `critical` 风险动作应supported双审批或 break-glass 流程，不能只靠单iterations普通确认。
- 带 `stage_view_ref` 的审批必须能回写到对应 OAPEFLIR timeline，不能只存在于审批table或消息渠道中。
- vs Improve / Release 相关的审批结果只能改变候选或 rollout 的受控Status，不得directly改写已发布策略内容。
- user文本输入型审批若table达纠正、偏好或负面反馈，应转成 `FeedbackSignal`，供 FeedbackHub / LearnHub 消费。

## 8. 补充规则

### 8.1 审批包 schema

`ApprovalPacket` 至少contains：

- `approval_id`
- `harness_run_id`
- `node_run_id?`
- `title`
- `reason`
- `risk_level`
- `options`
- `recommended_option_id?`
- `deadline_at?`
- `timeout_policy`

### 8.2 渠道交互按钮

- 按钮模型统一为 `option_id + label + style + requires_confirm?`。
- 非按钮渠道必须降级为同等语义的#选项或文本输入。
- 渠道适配层不得改变审批语义，只改变呈现方式。

### 8.3 组织职责边界

- HQ 负责defines审批升级principle和defaults to timeout policy。
- division / planner / orchestrator 只负责提出需要审批的上下文，不directly批准自身高风险动作。
- CEO/VP 等产品叙事名称不Impact最终审批 authority 的工程边界。
- 高风险动作的批准 authority 必须和发起执lines主体解耦，防止“自己申请、自己批准”的伪审批链。

### 8.4 级联拒绝语义

当一个审批request被拒绝或过期时，系统必须handle所有relies on该审批结果的下游Status：

| 场景 | lines为 |
| --- | --- |
| 单任务单审批被 `rejected` | 关联 execution 进入 `blocked` 或 `failed`（取决于isno可重试），任务进入 `awaiting_decision` 或 `failed` |
| 单任务单审批 `expired` | 按 `timeout_policy` 执lines：`reject` 走拒绝链、`approve` 走放lines链、`remain_pending` 保持等待 |
| 同一 execution 存在多个待决审批 | 任一审批被拒绝时，其他同 execution 的 `requested` 审批必须进入 `superseded`，不得留为悬挂态 |
| 父任务审批被拒绝 | 若子任务的执linesrelies on父审批结果，子任务应进入 `cancelled`，关联 execution 进入 `cancelled`，原因码 `parent_approval_rejected` |
| 审批拒绝后重新提交 | 必须创建新的 `approval_id`，不得复用已终态的审批record；新request应references用原 `approval_id` 作为 `supersedes_ref` |

规则：

- 级联拒绝必须在同一事务或可恢复的事件链中完成，不得relies on异步轮询发现悬挂审批。
- 级联 `superseded` 的审批必须record `superseded_by` references用，指向触发级联的源审批。
- 级联拒绝产生的所有Status变更必须writes审计链。

### 8.5 审批 reviewer 路由

- reviewer routing 必须is显式字段，而不is UI 层隐含lines为。
- `user` reviewer 仍isdefaults to基线。
- 若references入 guardian / review-subagent，only能在受控 prompt、受控工具、受控permission边界下工作。
- guardian reviewer 的Conclusion必须再iterations进入 Policy Engine 复核，不得directly落为 authoritative allow。

### 8.6 OAPEFLIR Stage 审批联动

`ApprovalFeedbackLink` used for把人工Decisionvs OAPEFLIR 闭环证据绑定，最小字段：

| 字段 | class型 | Description |
|---|-------|--------|
| `approval_id` | `string` | 审批 ID |
| `harness_run_id` | `string` | 关联 `HarnessRun` |
| `node_run_id` | `string?` | 关联 `NodeRun` |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | OAPEFLIR 视图阶段references用，不得作为 truth 主键 |
| `loop_iteration` | `integer?` | 触发轮iterations |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | 关联对象 |
| `feedback_signal_id` | `string?` | 审批产生或消费的反馈信号 |
| `decision_effect` | `continue \| revise_plan \| block_candidate \| approve_candidate \| advance_rollout \| rollback_rollout` | 对闭环的Impact |

规则：

- PlanHub 审批via后只能允许计划进入 execute；仍需 runtime precheck 和 Policy Engine 复核。
- FeedbackHub 审批不is对user情绪的覆盖，而is对后续 learn/improve isno采纳的人工治理信号。
- ImproveHub 的 `approve_candidate` 只能推进候选Status，不能跳过 guardrail 或directly发布。
- ReleaseHub 的 `advance_rollout` / `rollback_rollout` 必须references用 rollout record，并writes release audit。
- OAPEFLIR 审批timeout必须进入 stage timeline，且按 `timeout_policy` 转换成明确的 stage blocked / failed / remain_pending 语义。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-9: 缺少Architecture§31要求的 escalation_chain 和 timeout_auto_action 字段。Root Cause：旧审批 contract 把“timeout策略”压缩成了单值 UI 语义，没有把控制平面的自动动作和逐级升级链建模出来。修复：`ApprovalRequest` 已补入 `timeout_auto_action` vs `escalation_chain`，并defines `ApprovalEscalationHop` 最小字段。
- T-54: 仍用OapeflirStage作为一等stage_ref字段，Architecture§5.5不variable"oapeflir.\*事件不得作为truth source"。Root Cause：历史审批流把 OAPEFLIR 阶段既当解释视图又当权威关联键，混淆了 projection vs runtime truth。修复：正文已改为 `harness_run_id` / `node_run_id` 为权威关联键，`stage_view_ref` 只保留视图语义。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
