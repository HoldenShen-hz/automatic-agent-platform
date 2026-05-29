# Supervisor Contract

## 1. 范围

本 contract defines Agent Supervisor 对运lines实例、健康Status、心跳、告警、恢复动作、绩效vs OAPEFLIR 闭环提案的最小监管边界。

它不负责directly执lines任务，而负责观察、判断、升级和审计。

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

- `current_node_view_ref` 只能table达语义投影，不得把 `HarnessStep` / `current_step_id` 重新references入为 runtime truth 主键。
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

- defaults to采用 `latest_only` 或 `sampled`，避免高频 heartbeat directly灌满data库。
- exceeds过 `stale_after_sec` 未见心跳时，Supervisor 应把实例标为 `degraded` 或 `stalled`，而不is静默忽略。

## 6. AlertRecord 最小字段

- `alert_id`
- `instance_id`
- `severity` (`SEV1 \| SEV2 \| SEV3 \| SEV4`)
- `code`
- `message`
- `created_at`
- `resolved_at?`

告警分级Recommendation：

- `SEV4`: 局部轻微、可自动恢复、主要used for观测提示。
- `SEV3`: 单 workflow / 单 worker Impact，例如心跳陈旧、重试iterations数偏高、运linestime异常。
- `SEV2`: 单业务域 / 单租户明显受Impact，例如security策略异常、批量failed、budget异常扩散。
- `SEV1`: 平台级Impact / security事件 / 生产严重风险。

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

- Supervisor 可以Recommendation或触发受控恢复动作，但不得静默改写业务输出。
- 自动恢复、取消、升级都必须留下审计record。
- 高风险动作仍需服从审批和security contract。

## 8. lines为约束

- Supervisor 负责监控和升级，不directly篡改业务结果。
- 任何自动恢复或终止动作都必须留下审计record。
- vs进化相关的Recommendation只能形成 proposal，不能directly生效。
- Supervisor 对 heartbeat、alert、recovery 的判断应vs runtime execution contract 一致。

## 9. vs runtime 的关系

- `runtime_execution_contract.md` defines单iterations run 如何 precheck、执lines、重试和终止。
- 本 contract defines谁来发现 run 异常，以及如何形成告警和恢复动作。
- `event_bus_contract.md` 负责这些信号如何传播，不负责改写监管语义。

## 10. 补充规则

- Phase 1b 多 worker 拓扑下，supervisor 应至少区分 node-local monitor vs control-plane supervisor。
- 绩效评分只能形成 proposal，不得directly驱动 prompt / role 热更新；正式生效仍需治理链路批准。

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

- Supervisor 只能Recommendation `skip_stage`、`force_loop_exit`、`rollback_improvement`，isno执lines仍需走 control-plane / policy 边界。
- `feedback.negative_spike` 只能作为治理和恢复信号，不能directly等同于候选拒绝或 rollout 回滚。
- 若 loop 已进入 `release`，Supervisor 的恢复动作必须优先保护 rollout audit 和 evidence 完整性。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-23: 本文原先把 `current_step_id` 和 `info / warning / critical` 三档严重度写进 supervisor 主对象，Root cause: 早期单进程 agent 监管模型既把业务步骤当执lines主键，又accesses along用通用日志级别代替平台事件分级。修复：正文现把实例关联键收敛到 `harness_run_id / node_run_id / attempt_id`，并把告警严重度改为 `SEV1-4`。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
