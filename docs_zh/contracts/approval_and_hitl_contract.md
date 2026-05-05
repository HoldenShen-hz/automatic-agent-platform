# Approval And HITL Contract

> **v4.3 兼容说明**：本文件保留为历史审批与 HITL 说明。v4.3 裁决和人工责任以 [decision-hitl-contract.md](./decision-hitl-contract.md) 为准；旧 approval status 不能单独作为 `HarnessDecision` 或 `HumanResponsibilityRecord` 的替代。

## 1. 范围

本 contract 定义人工决策升级、审批请求、审批结果回传和运行模式下的行为差异。

## 2. 关键对象

- `ApprovalRequest`
- `ApprovalDecision`
- `HitlEscalation`
- `ApprovalContext`
- `ApprovalTimeoutPolicy`
- `ApprovalFeedbackLink`

## 3. ApprovalRequest 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `approval_id` | `string` | 审批 ID |
| `harness_run_id` | `string` | 关联 `HarnessRun` |
| `node_run_id` | `string?` | 关联 `NodeRun`；针对节点级审批必填 |
| `source_agent_id` | `string` | 发起 Agent |
| `reason` | `string` | 升级原因 |
| `risk_level` | `low \| medium \| high \| critical` | 风险等级 |
| `stage_view_ref` | `OapeflirStage?` | 仅解释/时间线视图引用；不得作为 truth 主键或状态推进依据 |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | 关联证据或发布对象 |
| `options` | `string[]` | 可选决策 |
| `context` | `json` | 相关上下文 |
| `timeout_policy` | `reject \| approve \| remain_pending` | 超时策略 |
| `timeout_auto_action` | `reject \| escalate \| remain_pending \| continue_readonly` | 超时后系统自动执行的治理动作 |
| `escalation_chain` | `ApprovalEscalationHop[]` | 明确的逐级升级链与每级时限/责任人 |
| `created_at` | `timestamp` | 发起时间 |

规则：

- `timeout_policy` 是治理请求的一部分，但最终只能被系统代码收紧，不能被下游 Agent 任意放宽。
- `timeout_auto_action` 是控制平面执行语义，不得由 UI 渲染层或下游 Agent 自行推断。
- Agent 输出不得越权覆盖已经冻结的超时策略。
- `critical` 风险默认不得使用 `approve` 作为超时策略，除非有显式 break-glass 规则与额外审计。
- 审批的权威关联键是 `harness_run_id` / `node_run_id`；`stage_view_ref` 只能用于解释视图，不得作为 truth source。

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
- `rejected` 与 `expired` 不得携带前述三类交互字段。
- 同一 `approval_id` 的 decision 只能成功应用一次；重复提交必须视为幂等 no-op 或冲突，而不是再次推进业务状态。

## 5. 触发场景

至少包括：

- 成本超阈值或接近阈值。
- 安全敏感命令。
- 任务歧义。
- 自愈超出最大尝试次数。
- 组织变更。
- 高风险 workflow 建议。
- PlanHub 产出高风险计划或不可逆执行路径。
- FeedbackHub 收到持续负面信号、用户纠正或质量异常，需要人工确认处置。
- ImproveHub 尝试接受策略升级、prompt/policy 变更或候选改进。
- ReleaseHub 尝试推进 release level、完成发布或触发 rollback。

## 6. 运行模式差异

- `supervised`: 高风险行为默认要求审批。
- `auto`: 中低风险可自动放行，高风险仍审批。
- `full-auto`: 仅在硬性禁止项之外允许更强自动化，但仍要记录升级与默认策略。

补充规则：

- `full-auto` 不能绕过硬拒策略、break-glass 策略和双审批要求。
- 运行模式只影响“是否允许自动放行”，不影响“硬性禁止项是否被拒绝”。

补充建议：

- approval policy 应支持从粗粒度模式逐步演进到细粒度 capability / risk class 级别的结构化配置，而不是只保留单一布尔开关。
- reviewer routing 应显式建模，例如默认 `user`，后续可引入受限 guardian / reviewer subagent，但该 reviewer 只能给出审批建议或代办处理，不得绕过最终策略复核。

## 7. 行为约束

- 每个审批请求必须可追踪。
- 同一审批结果不得重复应用。
- 超时处理必须明确：默认拒绝、默认通过或暂停等待，不能含糊。
- 同一 `approval_id` 的 decision payload 必须满足判别约束，不能出现互相冲突字段并存。
- 审批结果落地后，最终动作执行前必须再次经过 Policy Engine 复核，防止环境变化后仍沿用旧批准。
- `critical` 风险动作应支持双审批或 break-glass 流程，不能只靠单次普通确认。
- 带 `stage_view_ref` 的审批必须能回写到对应 OAPEFLIR timeline，不能只存在于审批表或消息渠道中。
- 与 Improve / Release 相关的审批结果只能改变候选或 release 的受控状态，不得直接改写已发布策略内容。
- 用户文本输入型审批若表达纠正、偏好或负面反馈，应转成 `FeedbackSignal`，供 FeedbackHub / LearnHub 消费。

## 8. 补充规则

### 8.1 审批包 schema

`ApprovalPacket` 至少包含：

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
- 非按钮渠道必须降级为同等语义的编号选项或文本输入。
- 渠道适配层不得改变审批语义，只改变呈现方式。

### 8.3 组织职责边界

- HQ 负责定义审批升级原则和默认 timeout policy。
- division / planner / orchestrator 只负责提出需要审批的上下文，不直接批准自身高风险动作。
- CEO/VP 等产品叙事名称不影响最终审批 authority 的工程边界。
- 高风险动作的批准 authority 必须和发起执行主体解耦，防止“自己申请、自己批准”的伪审批链。

### 8.4 级联拒绝语义

当一个审批请求被拒绝或过期时，系统必须处理所有依赖该审批结果的下游状态：

| 场景 | 行为 |
| --- | --- |
| 单任务单审批被 `rejected` | 关联 execution 进入 `blocked` 或 `failed`（取决于是否可重试），任务进入 `awaiting_decision` 或 `failed` |
| 单任务单审批 `expired` | 按 `timeout_policy` 执行：`reject` 走拒绝链、`approve` 走放行链、`remain_pending` 保持等待 |
| 同一 execution 存在多个待决审批 | 任一审批被拒绝时，其他同 execution 的 `requested` 审批必须进入 `superseded`，不得留为悬挂态 |
| 父任务审批被拒绝 | 若子任务的执行依赖父审批结果，子任务应进入 `cancelled`，关联 execution 进入 `cancelled`，原因码 `parent_approval_rejected` |
| 审批拒绝后重新提交 | 必须创建新的 `approval_id`，不得复用已终态的审批记录；新请求应引用原 `approval_id` 作为 `supersedes_ref` |

规则：

- 级联拒绝必须在同一事务或可恢复的事件链中完成，不得依赖异步轮询发现悬挂审批。
- 级联 `superseded` 的审批必须记录 `superseded_by` 引用，指向触发级联的源审批。
- 级联拒绝产生的所有状态变更必须写入审计链。

### 8.5 审批 reviewer 路由

- reviewer routing 必须是显式字段，而不是 UI 层隐含行为。
- `user` reviewer 仍是默认基线。
- 若引入 guardian / review-subagent，仅能在受控 prompt、受控工具、受控权限边界下工作。
- guardian reviewer 的结论必须再次进入 Policy Engine 复核，不得直接落为 authoritative allow。

### 8.6 OAPEFLIR Stage 审批联动

`ApprovalFeedbackLink` 用于把人工决策与 OAPEFLIR 闭环证据绑定，最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `approval_id` | `string` | 审批 ID |
| `harness_run_id` | `string` | 关联 `HarnessRun` |
| `node_run_id` | `string?` | 关联 `NodeRun` |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | OAPEFLIR 视图阶段引用，不得作为 truth 主键 |
| `loop_iteration` | `integer?` | 触发轮次 |
| `ref_id` | `EvidenceRef \| ArtifactRef \| StrategyVersionRef \| RolloutRecordRef?` | 关联对象 |
| `feedback_signal_id` | `string?` | 审批产生或消费的反馈信号 |
| `decision_effect` | `continue \| revise_plan \| block_candidate \| approve_candidate \| advance_release \| rollback_release` | 对闭环的影响 |

规则：

- PlanHub 审批通过后只能允许计划进入 execute；仍需 runtime precheck 和 Policy Engine 复核。
- FeedbackHub 审批不是对用户情绪的覆盖，而是对后续 learn/improve 是否采纳的人工治理信号。
- ImproveHub 的 `approve_candidate` 只能推进候选状态，不能跳过 guardrail 或直接发布。
- ReleaseHub 的 `advance_release` / `rollback_release` 必须引用 release record，并写入 release audit。
- OAPEFLIR 审批超时必须进入 stage timeline，且按 `timeout_policy` 转换成明确的 stage blocked / failed / remain_pending 语义。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-9: 缺少架构§31要求的 escalation_chain 和 timeout_auto_action 字段。根因：旧审批 contract 把“超时策略”压缩成了单值 UI 语义，没有把控制平面的自动动作和逐级升级链建模出来。修复：`ApprovalRequest` 已补入 `timeout_auto_action` 与 `escalation_chain`，并定义 `ApprovalEscalationHop` 最小字段。
- T-54: 仍用OapeflirStage作为一等stage_ref字段，架构§5.5不变量"oapeflir.\*事件不得作为truth source"。根因：历史审批流把 OAPEFLIR 阶段既当解释视图又当权威关联键，混淆了 projection 与 runtime truth。修复：正文已改为 `harness_run_id` / `node_run_id` 为权威关联键，`stage_view_ref` 只保留视图语义。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
