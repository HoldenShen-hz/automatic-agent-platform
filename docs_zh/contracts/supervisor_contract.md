# Supervisor Contract

## 1. 范围

本 contract 定义 Agent Supervisor 对运行实例、健康状态、心跳、告警、恢复动作、绩效与 OAPEFLIR 闭环提案的最小监管边界。

它不负责直接执行任务，而负责观察、判断、升级和审计。

## 2. 关键对象

- `AgentRuntimeInstance`
- `HealthSnapshot`
- `HeartbeatPolicy`
- `AlertRecord`
- `RecoveryAction`
- `PerformanceReview`
- `EvolutionProposal`
- `LoopHealthSnapshot`
- `StageStallAlert`
- `FeedbackAccumulator`

## 3. AgentRuntimeInstance 最小字段

- `instance_id`
- `agent_id`
- `harness_run_id`
- `node_run_id?`
- `attempt_id?`
- `task_id?`
- `status`
- `started_at`
- `last_heartbeat_at`
- `current_node_view_ref?`

规则：

- `current_node_view_ref` 只能表达语义投影，不得把 `HarnessStep` / `current_step_id` 重新引入为 runtime truth 主键。
- 任何 supervisor 恢复、告警或接管动作都必须能回链到 `harness_run_id / node_run_id / attempt_id`。

## 4. HealthSnapshot 最小字段

- `instance_id`
- `health` (`healthy \| degraded \| stalled \| failed`)
- `current_stage_view?`
- `loop_iteration_view?`
- `negative_feedback_ratio?`
- `reason?`
- `sampled_at`

## 5. HeartbeatPolicy 最小字段

- `expected_interval_sec`
- `stale_after_sec`
- `sample_strategy` (`latest_only \| sampled \| all_persisted`)

Phase 1a 规则：

- 默认采用 `latest_only` 或 `sampled`，避免高频 heartbeat 直接灌满数据库。
- 超过 `stale_after_sec` 未见心跳时，Supervisor 应把实例标为 `degraded` 或 `stalled`，而不是静默忽略。

## 6. AlertRecord 最小字段

- `alert_id`
- `instance_id`
- `severity` (`SEV1 \| SEV2 \| SEV3 \| SEV4`)
- `code`
- `message`
- `created_at`
- `resolved_at?`

告警分级建议：

- `SEV4`: 局部轻微、可自动恢复、主要用于观测提示。
- `SEV3`: 单 workflow / 单 worker 影响，例如心跳陈旧、重试次数偏高、运行时间异常。
- `SEV2`: 单业务域 / 单租户明显受影响，例如安全策略异常、批量失败、预算异常扩散。
- `SEV1`: 平台级影响 / 安全事件 / 生产严重风险。

推荐告警 code 基线：

- `supervisor.stage_stalled`
- `supervisor.loop_diverging`
- `feedback.negative_spike`

## 7. RecoveryAction 最小字段

- `action_id`
- `instance_id`
- `action_type` (`mark_stalled \| request_retry \| request_cancel \| escalate_to_human \| skip_stage \| force_loop_exit \| rollback_improvement`)
- `reason`
- `created_at`
- `actor`

规则：

- Supervisor 可以建议或触发受控恢复动作，但不得静默改写业务输出。
- 自动恢复、取消、升级都必须留下审计记录。
- 高风险动作仍需服从审批和安全 contract。

## 8. 行为约束

- Supervisor 负责监控和升级，不直接篡改业务结果。
- 任何自动恢复或终止动作都必须留下审计记录。
- 与进化相关的建议只能形成 proposal，不能直接生效。
- Supervisor 对 heartbeat、alert、recovery 的判断应与 runtime execution contract 一致。

## 9. 与 runtime 的关系

- `runtime_execution_contract.md` 定义单次 run 如何 precheck、执行、重试和终止。
- 本 contract 定义谁来发现 run 异常，以及如何形成告警和恢复动作。
- `event_bus_contract.md` 负责这些信号如何传播，不负责改写监管语义。

## 10. 补充规则

- Phase 1b 多 worker 拓扑下，supervisor 应至少区分 node-local monitor 与 control-plane supervisor。
- 绩效评分只能形成 proposal，不得直接驱动 prompt / role 热更新；正式生效仍需治理链路批准。

## 10A. OAPEFLIR 循环监控

`LoopHealthSnapshot` 最小字段：

- `harness_run_id`
- `task_id?`
- `loop_iteration_view`
- `current_stage_view`
- `loop_health` (`healthy \| drifting \| stalled \| terminated`)
- `stage_duration_ms?`
- `negative_feedback_count`
- `last_transition_at`

`StageStallAlert` 最小字段：

- `harness_run_id`
- `task_id?`
- `loop_iteration_view`
- `stage_view_ref`
- `stall_reason`
- `created_at`

`FeedbackAccumulator` 最小字段：

- `harness_run_id`
- `task_id?`
- `window_started_at`
- `positive_count`
- `neutral_count`
- `negative_count`
- `correction_count`

规则：

- Supervisor 只能建议 `skip_stage`、`force_loop_exit`、`rollback_improvement`，是否执行仍需走 control-plane / policy 边界。
- `feedback.negative_spike` 只能作为治理和恢复信号，不能直接等同于候选拒绝或 release 回滚。
- 若 loop 已进入 `release`，Supervisor 的恢复动作必须优先保护 release audit 和 evidence 完整性。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-23: 本文原先把 `current_step_id` 和 `info / warning / critical` 三档严重度写进 supervisor 主对象，根因是早期单进程 agent 监管模型既把业务步骤当执行主键，又沿用通用日志级别代替平台事件分级。修复：正文现把实例关联键收敛到 `harness_run_id / node_run_id / attempt_id`，并把告警严重度改为 `SEV1-4`。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
