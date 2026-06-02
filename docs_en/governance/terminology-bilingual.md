# Terminology Bilingual Glossary

## Overview

This document provides a comprehensive Chinese-English bilingual reference for all core terms used in the Automatic Agent Platform. Terms are organized by domain area.

This document is the Chinese-English bilingual reference for all core terminology of the Automatic Agent Platform, organized by domain.

---

## 1. Core Objects

| English | 中文 | 解释 |
|---------|------|------|
| task | 任务 | User-level work unit; the smallest work commitment object the system exposes to users and business |
| workflow | 工作流 | Structured execution path of a task; defines steps, dependencies, inputs/outputs, and failure paths |
| step | 步骤 | A single execution step within a workflow |
| execution | 执行实例 | A specific running attempt of a task/workflow |
| attempt | 重试计数 | Retry count / re-entry index for the same execution or step |
| session | 会话 | Channel interaction session that carries user input, streaming output, and interaction context |
| message | 消息 | A complete message object that may contain multiple message parts |
| message part | 消息片段 | Structured segment inside a message, such as text, tool_use, tool_result, summary |
| artifact | 产物/制品 | File or binary artifact, typically managed through the artifact store |
| output | 输出 | Result for the upstream step or the user; may be structured data or text, not necessarily a file |
| step output | 步骤输出 | Structured result snapshot after a step completes |
| result envelope | 结果信封 | Unified result wrapper for success, partial success, failure, warning, artifact, and metrics |

---

## 2. OAPEFLIR Terms

| English | 中文 | 解释 |
|---------|------|------|
| OAPEFLIR | OAPEFLIR | Eight-stage closed loop: Observe -> Assess -> Plan -> Execute -> Feedback -> Learn -> Improve -> Release |
| stage | 阶段 | Stage-level state unit within the OAPEFLIR closed loop |
| loop iteration | 闭环迭代 | One full or partial cycle execution round of the closed loop |
| TaskSituation | 任务态势 | Fact snapshot output by the Observe stage |
| UnifiedAssessment | 统一评估 | Structured judgment output by the Assess stage |
| Plan | 执行计划 | Explicit execution plan from the Plan Hub |
| FeedbackSignal | 反馈信号 | Structured feedback signal collected after Execute |
| LearningObject | 学习对象 | Reusable learning object produced by the Learn Hub |
| ImprovementCandidate | 改进候选 | Improvement candidate produced by the Improve Hub |
| RolloutRecord | 发布记录 | Controlled release record from the Release stage |

---

## 3. Execution & Recovery

| English | 中文 | 解释 |
|---------|------|------|
| runtime | 运行时 | The execution layer that actually runs task / workflow / agent / tool |
| execution ticket | 执行票据 | Formal execution document dispatched from the scheduler to the execution layer |
| lease | 租约 | Temporary ownership of an execution or worker dispatch |
| lease owner | 租约持有者 | The execution entity currently holding execution rights |
| fencing token | 隔离令牌 | Version token that prevents stale executors from writing back dirty results |
| dispatch | 调度分发 | Assigning a task or execution right to a particular execution carrier |
| worker | 工作器 | Execution carrier unit, which may be local or remote |
| sub-agent | 子代理 | Secondary intelligent execution unit that collaborates within the same task context |
| heartbeat | 心跳 | Periodic health / load report |
| stalled | 停滞 | Process is not necessarily dead, but has made no effective progress within the specified time |
| dead-letter | 死信 | Failure landing record that cannot be auto-recovered or should not be retried further |
| checkpoint | 检查点 | State snapshot at a recoverable boundary |
| partial result | 部分结果 | The task as a whole is not yet complete, but there is a stage-level result that is retainable and auditable |
| compensation | 补偿 | Action that rolls back, reconciles, or manually repairs a step that has already produced side effects |

---

## 4. Task Status

| English | 中文 | 解释 |
|---------|------|------|
| queued | 排队中 | Task pre-execution state: created but not yet entered the scheduler |
| pending | 待处理 | Task pre-execution state: created but not yet entered the scheduler |
| in_progress | 进行中 | Main logic is in progress (Task state) |
| awaiting_decision | 等待决策 | Task is waiting for an approval decision |
| done | 已完成 | Task terminal state: task ended successfully |
| failed | 失败 | Execution failed and the current attempt has terminated |
| cancelled | 已取消 | Explicitly terminated, no further continuation |

---

## 5. Workflow Status

| English | 中文 | 解释 |
|---------|------|------|
| running | 运行中 | Workflow is advancing its main logic |
| paused | 已暂停 | Explicitly paused and resumable |
| resuming | 恢复中 | Workflow transition state for resuming from pause |
| completed | 已完成 | Workflow ended successfully |
| failed | 失败 | Workflow execution failed |
| cancelling | 取消中 | Workflow transient state before cancelled |
| cancelled | 已取消 | Explicitly terminated, no further continuation |

---

## 6. Execution Status

| English | 中文 | 解释 |
|---------|------|------|
| created | 已创建 | Execution has been created |
| prechecking | 预校验中 | Execution pre-validation phase |
| executing | 执行中 | Main logic is in progress (Execution state) |
| blocked | 阻塞 | Temporarily unable to continue due to unmet dependencies, approval, policy, or resources |
| succeeded | 成功 | Execution completed successfully |
| failed | 失败 | Execution failed |
| cancelled | 已取消 | Explicitly terminated, no further continuation |
| superseded | 已替代 | Execution replaced by a newer execution |

---

## 7. Session Status

| English | 中文 | 解释 |
|---------|------|------|
| open | 开放 | Session is in the open state |
| streaming | 流式输出中 | Session is in the streaming output state |
| awaiting_user | 等待用户 | Waiting for human or external system input (Session state) |
| paused | 已暂停 | Session has been paused |
| completed | 已完成 | Session ended successfully |
| failed | 失败 | Session failed |
| cancelled | 已取消 | Session was terminated |

---

## 8. Approval Status

| English | 中文 | 解释 |
|---------|------|------|
| requested | 已请求 | Approval requested, waiting for human decision |
| approved | 已批准 | Approval granted |
| rejected | 已拒绝 | Approval denied |
| expired | 已过期 | Approval timed out |
| cancelled | 已取消 | Approval cancelled |

---

## 9. Worker & Dispatch

| English | 中文 | 解释 |
|---------|------|------|
| worker | 工作器 | Execution carrier unit, which may be local or remote |
| agent | 智能体 | Intelligent execution entity that takes on a role and responsibility |
| coordinator | 协调器 | Scheduling coordination service that manages task distribution across workers |
| idle | 空闲 | Worker is ready to accept new tasks |
| busy | 忙碌 | Worker is executing a task |
| draining | 排空中 | Worker is finishing existing tasks but is not accepting new ones |
| degraded | 降级 | Worker capability is limited but still functional |
| unavailable | 不可用 | Worker cannot accept tasks at the moment |
| quarantined | 隔离 | Worker is temporarily disabled |
| offline | 离线 | Worker connection is lost |
| local | 本地 | Worker is deployed in the same process |
| remote | 远程 | Worker is connected through a bridge |
| execution ticket | 执行票据 | Formal execution document dispatched from the scheduler to the execution layer |
| dispatch | 调度分发 | Assigning a task or execution right to a particular execution carrier |

---

## 10. Lease & Fencing

| English | 中文 | 解释 |
|---------|------|------|
| lease | 租约 | Temporary ownership of an execution or worker dispatch |
| fencing token | 隔离令牌 | Version token that prevents stale executors from writing back dirty results |
| active | 活跃 | Lease is currently in effect |
| expired | 已过期 | Lease has exceeded its validity period |
| released | 已释放 | Lease was actively released |
| reclaimed | 已回收 | Lease was reclaimed by the system |
| handed_over | 已交接 | Lease was transferred to another worker |
| stale_write_rejected | 过期写入拒绝 | Stale write rejected because the fencing token did not match |

---

## 11. Message & Event

| English | 中文 | 解释 |
|---------|------|------|
| message | 消息 | A complete message object |
| message part | 消息片段 | Structured segment inside a message |
| inbound | 入站 | Message direction: user input |
| outbound | 出站 | Message direction: system output |
| system | 系统 | Message direction: system notification |
| event | 事件 | Structured fact notification inside the system |
| tier_1 event | 一级事件 | Events that must be reliably persisted, recoverable, and never silently lost |
| tier_2 event | 二级事件 | At-least-once delivery events |
| tier_3 event | 三级事件 | Best-effort delivery events |
| ack | 确认 | Record that a consumer has acknowledged processing of an event |
| replay | 重放 | Re-sending events from the in-memory buffer |
| stream | 流 | Incremental output stream for channels / UI |
| stream_id | 流标识 | Unique identifier of a display stream |

---

## 12. Message Part Types

| English | 中文 | 解释 |
|---------|------|------|
| text | 文本 | Text content segment |
| reasoning | 推理 | Reasoning process trace segment |
| tool_use | 工具调用 | Tool use request segment |
| tool_result | 工具结果 | Tool execution result segment |
| summary | 摘要 | Content summary segment |
| artifact_ref | 产物引用 | Segment that references an artifact |
| decision_prompt | 决策提示 | Decision prompt segment |
| agent_ref | 智能体引用 | Segment that references an agent |
| subtask_ref | 子任务引用 | Segment that references a subtask |
| retry_record | 重试记录 | Retry history segment |
| step_boundary | 步骤边界 | Step boundary marker segment |
| compaction_marker | 压缩标记 | Context compaction marker segment |
| hook_event | 钩子事件 | Hook-trigger event segment |
| command_execution | 命令执行 | Command execution segment |
| mcp_call | MCP 调用 | Model Context Protocol call segment |

---

## 13. Step Output Status

| English | 中文 | 解释 |
|---------|------|------|
| succeeded | 成功 | Step completed successfully |
| failed | 失败 | Step execution failed |
| partial_success | 部分成功 | Step partially succeeded with partial results |
| skipped | 已跳过 | Step was skipped |

---

## 14. Memory

| English | 中文 | 解释 |
|---------|------|------|
| memory | 记忆 | Retrievable memory unit |
| layer_3 | 第三层 | High-frequency, low-latency memory layer |
| layer_5 | 第五层 | Medium-frequency, medium-latency memory layer |
| layer_7 | 第七层 | Low-frequency, high-latency memory layer |
| general | 一般 | General memory content |
| fact | 事实 | Factual memory content |
| episode | 事件 | Episodic memory content |
| rule | 规则 | Rule-based memory content |
| decision | 决策 | Decision-based memory content |
| active | 活跃 | Memory is currently usable |
| archived | 归档 | Memory has been archived |
| superseded | 已替代 | Memory has been replaced by newer content |
| trusted | 可信 | Information source is trusted |
| external | 外部 | Information source is external |
| untrusted | 不可信 | Information source is untrusted |

---

## 15. Run Types

| English | 中文 | 解释 |
|---------|------|------|
| task_run | 任务运行 | Standard task execution type |
| tool_call | 工具调用 | Tool call execution type |
| approval_resume | 审批恢复 | Resume execution after approval |
| replay | 重放 | Replay execution |

---

## 16. Compensation & Checkpoint

| English | 中文 | 解释 |
|---------|------|------|
| compensation | 补偿 | Action that rolls back, reconciles, or manually repairs a step that has already produced side effects |
| idempotent_replay | 幂等重放 | Compensation strategy by replay |
| compare_and_swap_write | 比较并交换写入 | Compensation strategy via CAS write |
| compensating_action | 补偿动作 | Compensation strategy by executing a compensating action |
| manual_reconciliation_required | 需要人工对账 | Manual intervention required for reconciliation and repair |
| checkpoint | 检查点 | State snapshot at a recoverable boundary |
| resume_from_checkpoint | 从检查点恢复 | Strategy to resume execution from a checkpoint |
| replay_from_start | 从头重放 | Strategy to re-execute from the beginning of a workflow |
| manual_reconciliation | 人工对账 | Strategy that requires manual intervention for repair |

---

## 17. Termination & Error

| English | 中文 | 解释 |
|---------|------|------|
| reasonCode | 原因码 | Termination reason code recorded as a string |
| termination_initiator | 终止发起者 | The subject that triggered the termination: user / system / policy / admin |
| termination_scope | 终止范围 | The scope affected by the termination: step / workflow / task / session |
| recoverable | 可恢复 | Whether the recovery path is allowed after termination |
| dead-letter | 死信 | Failure landing record that cannot be auto-recovered or should not be retried further |

---

## 18. Task Priority & Source

| English | 中文 | 解释 |
|---------|------|------|
| low | 低 | Low priority |
| normal | 普通 | Normal priority |
| high | 高 | High priority |
| urgent | 紧急 | Urgent priority |
| user | 用户 | Task source: directly created by user |
| perception | 感知 | Task source: triggered by system perception |
| system | 系统 | Task source: created internally by the system |

---

## 19. Isolation & Placement

| English | 中文 | 解释 |
|---------|------|------|
| standard | 标准 | Standard isolation level |
| hardened | 加固 | Hardened isolation level |
| strict | 严格 | Strict isolation level |
| local | 本地 | Worker is deployed in the same process |
| remote | 远程 | Worker is connected through a bridge |

---

## 20. Session Consistency

| English | 中文 | 解释 |
|---------|------|------|
| connecting | 连接中 | Remote session is establishing a connection |
| connected | 已连接 | Remote session is connected |
| reconnecting | 重连中 | Remote session is reconnecting |
| degraded | 降级 | Remote session capability is degraded |
| failed | 失败 | Remote session connection failed |
| viewer_only | 仅查看 | Session is in a read-only observation state |
| unknown | 未知 | Consistency check status is unknown |
| passed | 通过 | Consistency check passed |
| mismatch | 不匹配 | Consistency check found a mismatch |
| aligned | 对齐 | Workspace state is synchronized |
| conflict | 冲突 | Workspace state has a conflict |

---

## 21. Lease Audit Events

| English | 中文 | 解释 |
|---------|------|------|
| lease_granted | 租约授予 | Lease was granted |
| lease_renewed | 租约续期 | Lease was renewed |
| lease_expired | 租约过期 | Lease naturally expired |
| lease_reclaimed | 租约回收 | Lease was reclaimed by the system |
| stale_write_rejected | 过期写入拒绝 | Stale write rejected because the token did not match |
| lease_released | 租约释放 | Lease was actively released |
| lease_handover | 租约交接 | Lease was transferred to another execution entity |

---

## 22. Dispatch Rejection Reasons

| English | 中文 | 解释 |
|---------|------|------|
| worker_unavailable | 工作器不可用 | Worker is currently unavailable |
| worker_quarantined | 工作器被隔离 | Worker is in the quarantined state |
| worker_offline | 工作器离线 | Worker connection is lost |
| worker_draining | 工作器排空中 | Worker is draining |
| worker_degraded_filtered | 工作器降级被过滤 | Degraded worker was filtered out |
| worker_untrusted | 工作器不可信 | Worker trust check failed |
| worker_capacity_full | 工作器容量满 | Worker has reached maximum capacity |
| queue_affinity_mismatch | 队列亲和性不匹配 | Queue affinity requirements were not met |
| missing_capabilities | 缺少能力 | Worker is missing required capabilities |
| worker_placement_mismatch | 工作器部署位置不匹配 | Local/remote placement requirements were not met |
| worker_isolation_mismatch | 工作器隔离级别不匹配 | Isolation level requirements were not met |
| worker_repo_version_mismatch | 工作器版本不匹配 | Code repository version requirements were not met |
| worker_remote_session_unready | 工作器远程会话未就绪 | Remote session is not ready |

---

## 23. Execution Ticket Status

| English | 中文 | 解释 |
|---------|------|------|
| pending | 待认领 | Ticket is waiting to be claimed |
| claimed | 已认领 | Ticket has been claimed by a worker |
| consumed | 已消费 | Ticket has been used |
| cancelled | 已取消 | Ticket has been cancelled |
| expired | 已过期 | Ticket has expired |

---

## 24. Operator Actions

| English | 中文 | 解释 |
|---------|------|------|
| take_over_task | 接管任务 | Operator takes over a task |
| modify_input | 修改输入 | Operator modifies task input |
| retry_execution | 重试执行 | Operator triggers a retry |
| skip_step | 跳过步骤 | Operator skips a step |
| set_current_step | 设置当前步骤 | Operator sets the current execution step |
| switch_worker | 切换工作器 | Operator switches the execution worker |
| write_step_output | 写入步骤输出 | Operator writes step output |
| complete_task | 完成任务 | Operator manually completes the task |

---

## 25. Takeover Session

| English | 中文 | 解释 |
|---------|------|------|
| open | 开放 | Takeover session is in the open state |
| closed | 已关闭 | Takeover session has ended |

---

## 26. Evolution & Promotion

| English | 中文 | 解释 |
|---------|------|------|
| pending_approval | 待审批 | Proposal is waiting for approval |
| approved | 已批准 | Proposal was approved |
| rejected | 已拒绝 | Proposal was rejected |
| applied | 已应用 | Proposal was applied |
| rolled_back | 已回滚 | Proposal was rolled back |
| draft | 草稿 | Draft state |
| validated | 已验证 | Validation passed |
| promoted | 已推广 | Promoted |
| retired | 已退役 | Retired |
| shadow | 影子运行 | Shadow mode run |
| canary_5 | 5% 金丝雀 | 5% traffic canary release |
| partial_25 | 25% 分批 | 25% partial release |
| partial_50 | 50% 分批 | 50% partial release |
| partial_75 | 75% 分批 | 75% partial release |
| stable | 稳定 | Stable version |
| shadow_running | 影子运行中 | Shadow mode is running |

---

## 27. Compaction

| English | 中文 | 解释 |
|---------|------|------|
| trim | 修剪 | Remove old tool results |
| summarize | 摘要 | Compress content into key insights |

---

## 28. Event Consumer Ack

| English | 中文 | 解释 |
|---------|------|------|
| pending | 待确认 | Waiting for consumer acknowledgement |
| acked | 已确认 | Consumer acknowledged |
| failed | 失败 | Acknowledgement failed |
| dead_lettered | 死信 | Moved to the dead-letter queue |

---

## 29. Remote Log Levels

| English | 中文 | 解释 |
|---------|------|------|
| debug | 调试 | Debug level log |
| info | 信息 | Info level log |
| warn | 警告 | Warning level log |
| error | 错误 | Error level log |

---

## 30. Budget Scope

| English | 中文 | 解释 |
|---------|------|------|
| task_execution | 任务执行 | Task execution budget |
| compaction | 压缩 | Context compaction budget |
| skill_execution | 技能执行 | Skill execution budget |
| recovery_retry | 恢复重试 | Recovery retry budget |
| approval_review | 审批审查 | Approval review budget |

---

## 31. Transition

| English | 中文 | 解释 |
|---------|------|------|
| task | 任务 | Task entity type |
| workflow | 工作流 | Workflow entity type |
| session | 会话 | Session entity type |
| approval | 审批 | Approval entity type |
| execution | 执行实例 | Execution entity type |
| user | 用户 | User trigger |
| agent | 智能体 | Agent trigger |
| system | 系统 | System trigger |
| scheduler | 调度器 | Scheduler trigger |
| admin | 管理员 | Admin trigger |
| webhook | Webhook | Webhook trigger |
| recovery | 恢复 | Recovery trigger |

---

## 32. Quick Reference: Commonly Confused Terms

### task vs session
- **task**: Business work unit
- **session**: Interaction session

### workflow vs execution
- **workflow**: Structure definition
- **execution**: A specific running attempt

### agent vs worker
- **agent**: Emphasizes role and intelligent entity
- **worker**: Emphasizes execution carrier and resource slot

### artifact vs output vs step output
- **artifact**: Emphasizes file-type artifact
- **output**: Emphasizes result semantics
- **step output**: Emphasizes step-level structured snapshot

### queued vs blocked
- **queued**: Waiting for scheduler assignment
- **blocked**: Cannot continue due to dependencies / approval / policy / resources

### paused vs awaiting_user
- **paused**: Explicitly paused
- **awaiting_user**: Waiting for external input

### stalled vs offline
- **stalled**: Has progress but timed out
- **offline**: Connection lost

### failed vs cancelled
- **failed**: Execution failed and terminated
- **cancelled**: Explicitly cancelled

### done vs completed
- **done**: The unique terminal success state of Task
- **completed**: Workflow successful completion state

---

## Document Info

- Source: `docs_zh/governance/glossary_and_terminology.md` and `src/platform/contracts/types/`
- Governance Level: Main version (terminology glossary main version)
- Last Updated: 2026-04-22

---

## 33. Data & Storage

| English | 中文 | 解释 |
|---------|------|------|
| Authoritative Store | 权威存储 | The storage system that has the final interpretation authority over a class of facts; the ultimate source of truth for data; must not be mixed with arbitrary caches |
| Transaction Store | 事务存储 | Storage responsible for transactional data such as tasks, states, approvals, and events; in code, transactional data is stored in AuthoritativeSqlDatabase |
| Artifact Store | 产物存储 | Storage for file-type, large-volume, or export-type artifacts; it differs in nature from the transaction store |
| Analytics Store | 分析存储 | Storage oriented to projections and materialized views; not an independent analytics report store |
| Data Plane | 数据平面 | Unified data plane of transaction, artifact, analytics, archive, and replay (currently a planned concept) |
| Namespace | 命名空间 | Logical namespace under data, artifact, or tenant boundaries; distinct from OS path |
| Eventual Consistency | 最终一致性 | State that is allowed to become consistent after a brief delay, different from strong consistency guarantees |
| Reconciliation | 对账修复 | Action that reconciles and repairs state, events, workers, locks, etc. |
| Migration | 迁移 | Formal version migration of schema or storage structure, distinct from ad-hoc SQL patches |
| Storage Backend | 存储后端 | Underlying storage abstraction supporting both SQLite and PostgreSQL drivers |
| Storage Driver | 存储驱动 | Either SQLite or PostgreSQL storage engine driver type |
| Schema Migration | Schema 迁移 | Formal upgrade or downgrade process of the database structure version |
| Checksum Mismatch | 校验和不匹配 | Migration version check failure; expected and actual values do not match |
| Shadow SQLite | 影子 SQLite | SQLite shadow database running in parallel under the PostgreSQL dual-run mode |
| Authoritative Task Store | 权威任务存储 | The authoritative task-state storage in Phase 1a, delegated to sqlite or postgres implementation |
| Phase 1a Store | Phase 1a 存储 | The task storage abstraction for the initial stable core stage |
| Read-after-write Consistency | 写后读一致性 | Guarantee that an immediate read after a write can observe the result of that write |
| Lease | 租约 | Temporary ownership of an execution or worker dispatch; not permanent ownership |
| Fencing Token | 隔离令牌 | Version token that prevents stale executors from writing back dirty results; not a regular sequence |
| Dead-letter | 死信 | Failure landing record that cannot be auto-recovered or should not be retried further |
| Partial Result | 部分结果 | The task as a whole is not yet complete, but there is a stage-level result that is retainable and auditable |
| Checkpoint | 检查点 | State snapshot at a recoverable boundary; distinct from arbitrary temporary variables |

---

## 34. Configuration & Version

| English | 中文 | 解释 |
|---------|------|------|
| Config Bundle | 配置包 | A group of configurations that take effect together; includes bootstrap, gateways, providers, runtime, security, workflows, and other layers |
| Config Version | 配置版本 | Version identifier after a configuration change; used for tamper detection and cache management |
| Config Layer | 配置层级 | Vertical layer structure of configurations, such as platform, tenant, pack, task_type |
| Feature Flag | 特性开关 | Switch that controls capability enablement/disablement or gradual rollout |
| Prompt Bundle | Prompt 包 | A group of prompts released and versioned together |
| Config Diff | 配置差异 | The set of changes between two configuration bundles; used for drift detection |
| Bundle Hash | 包哈希 | SHA-256 hash of the entire configuration bundle |
| Layer Hash | 层级哈希 | Content hash of a single configuration layer; used for change detection |
| Tamper Detection | 篡改检测 | Detection of unauthorized configuration changes by comparing version IDs |
| Config Rollout | 配置发布 | Configuration release that supports canary strategies, with phased (5%/25%/50%/100%) progressive rollout |
| Canary Rollout | 金丝雀发布 | Configuration release strategy that runs a small proportion first, then gradually expands |
| Rollback Point | 回滚点 | Configuration version snapshot record available for restoration |
| Config Governance Service | 配置治理服务 | Service responsible for loading, validating, and integrity-checking layered configuration bundles |
| Sandbox Policy | 沙箱策略 | Security verification policy for file path access; prevents directory traversal attacks |
| Compatibility Window | 兼容性窗口 | Formally supported compatibility time interval between different runtime/SDK/protocol/plugin versions |
| Promote Criteria | 晋升标准 | Evidence threshold required for a module to be elevated from usable to platform-ready / production-ready |
| Readiness Registry | 就绪注册表 | Formal registry surface that records the readiness state of environments or modules |
| Evidence Package | 证据包 | A set of evidence used to support promote / signoff / production-ready decisions |
| Production-ready | 生产就绪 | Has reached the comprehensive threshold required for production safeguards |
| Phase 1a Ready | Phase 1a 就绪 | Has reached the minimum viable threshold of the Phase 1a stable core |

---

## 35. Prompt & Cache

| English | 中文 | 解释 |
|---------|------|------|
| Fixed Prefix | 固定前缀 | Fixed system prompt prefix shared across agents; not subject to normal compaction by default |
| Domain Block | 领域块 | Reusable prompt middle layer for the same domain / profile |
| Variable Suffix | 变量后缀 | Prompt suffix that varies dynamically by task, role, plan, and memory |
| KV Cache Fixed Prefix | KV 缓存固定前缀 | Prefill cache reuse mechanism based on the same prefix hash |

---

## 36. Storage Operations

| English | 中文 | 解释 |
|---------|------|------|
| Migration Runner | 迁移运行器 | State management service responsible for executing storage backend schema upgrades |
| Schema Status | Schema 状态 | Comparison status between the current version and the expected version |
| Pending Versions | 待执行版本 | List of migration versions that have not yet been applied |
| Up-to-date | 最新版本 | Current storage schema has completed all migrations |
| Dual Run | 双跑模式 | Mode in which the production PostgreSQL environment must run a SQLite shadow database in parallel |

---

## 37. Security & Governance

| English | 中文 | 解释 |
|---------|------|------|
| Policy Engine | 策略引擎 | Code-level entry point that makes the final ruling on permissions, risk, approval, budget, and runtime constraints; the unified security decision center |
| HITL (Human In The Loop) | 人工介入 | Decision steps that require explicit human participation; high-risk operations must go through human approval before continuing |
| Approval | 人工审批 | Decision node in a workflow that requires explicit human confirmation before continuing |
| Break-Glass | 紧急放行 | Configuration flag for high-risk emergency override; the critical risk triggers the break-glass approval type for emergency bypass of the standard flow |
| Sandbox | 沙箱 | Execution isolation boundary that confines untrusted code or operations to a controlled environment |
| Exec Policy | 执行策略 | Rule set for tool / command execution; defines which operations are allowed or prohibited |
| Permission | 权限 | Authorization state by which a subject can see or use a capability; implicitly implemented through the PolicyEngine |
| Secret | 密钥/凭证 | Sensitive confidential information such as keys, tokens, and credentials, including API Key, OAuth Token, database password, etc. |
| Secret Masking | 密钥脱敏 | Method of masking sensitive secret information in logs and displays to prevent credential leakage |
| Data Classification | 数据分级 | Data sensitivity classification rules, including four levels: public / internal / confidential / restricted |
| Audit Evidence | 审计证据 | Behavior evidence that is traceable, verifiable, and hard to deny; used for compliance and accountability |
| Field Encryption | 字段加密 | Encryption protection for specific fields, ensuring the security of sensitive data during storage and transmission |
| Network Egress Policy | 出站网络策略 | Policy that controls and audits outbound network requests initiated by the system |
| Outbound URL Policy | 出站URL策略 | Rules that filter and restrict the target URL of outbound HTTP requests |
| Kill Switch | 熔断开关 | Switch that fully disables system functionality in an emergency; once activated, all operations are denied |
| Budget Guard | 预算防护 | Mechanism that monitors and controls task execution cost to prevent overspending |
| Risk Category | 风险类别 | Risk types evaluated by the PolicyEngine, including destructive / irreversible / prod_affecting etc. |
| PII (Personally Identifiable Information) | 个人身份信息 | Information that can identify an individual, such as email, phone number, SSN, credit card number, etc. |
| Secret Lease | 密钥租约 | Time-limited access authorization for a secret; controls the secret's validity period and usage scope |
| Secret Rotation | 密钥轮换 | Operational practice of regularly updating secrets to reduce the risk of leakage |
| CVE Intelligence | CVE情报 | Known vulnerability intelligence service that tracks and evaluates the degree to which the system is affected by vulnerabilities |
| Policy Decision Request | 策略决策请求 | Policy evaluation request containing context such as task ID, subject ID, action, and risk category |
| Policy Decision Result | 策略决策结果 | Decision result returned by the policy engine, including allow / deny / escalate_for_approval |
| Data Classification Level | 数据分级级别 | Four sensitivity levels: public / internal / confidential / restricted |
| Data Handling Dimension | 数据处理维度 | Scenario dimensions of data flow, including prompt / logs / memory / artifact / cross_worker / debug |
| Handling Decision | 处理决策 | Allow / deny / redact / audit decision based on data classification and handling dimension |
| PII Detection | PII检测 | Use of regular expression patterns to identify personally identifiable information in content |
| PII Annotation | PII标注 | Marking the location of detected PII and the redaction form in content |
| Secret Management Service | 密钥管理服务 | Service that uniformly manages the lifecycle, rotation, and access of all secrets |
| Managed Secret Provider | 托管密钥提供者 | Provider that obtains secrets from Vault / KMS / Secret Manager |
| Env Secret Provider | 环境变量密钥提供者 | Provider that reads secrets from environment variables |
| External Secret Provider | 外部密钥提供者 | Provider that obtains secrets from an external key management system |
| Audit Integrity | 审计完整性 | Integrity protection mechanism that ensures audit records are not tampered with |
| Network Egress Audit | 出站网络审计 | Mechanism that records and reviews all outbound network requests |
| Trusted Context Scanner | 可信上下文扫描器 | Component that scans and validates trusted context configuration |
| File Freshness | 文件新鲜度 | Mechanism that checks whether a file is outdated or needs to be updated |
| CVE Intelligence Service | CVE情报服务 | Intelligence service that tracks and evaluates the impact of known vulnerabilities |
| Approval Service | 审批服务 | Service that handles human approval requests and decisions |
| Approval Request | 审批请求 | Approval task sent to a human approver |
| Approval Decision | 审批决策 | Approve or reject decision made by the approver |
| Idempotent | 幂等性 | Property that repeated execution of the same operation produces consistent results |

---

## 38. Testing & Stabilization

| English | 中文 | 解释 |
|---------|------|------|
| Stable Core | 稳定核心 | The minimal capability scope intentionally narrowed to achieve stable operation first, ensuring core functionality is reliable |
| Golden Task | 黄金任务 | Fixed representative task used as a version regression baseline, used to verify that core system functions have not regressed |
| Fixture | 测试固件 | Pre-set fixed input / output samples for stable testing and VCR replay |
| VCR (Video Cassette Recorder) | VCR录制回放 | Testing mechanism that records / replays external LLM calls, enabling deterministic tests |
| Unit Test | 单元测试 | Fine-grained tests targeting a single function, module, or object |
| Integration Test | 集成测试 | Cross-module collaboration tests, verifying that the interaction between multiple components is correct |
| E2E (End-to-End) | 端到端测试 | Full-flow test from entry to result, covering the entire system chain |
| Chaos Test | 混沌测试 | Tests that actively inject failures to verify recovery and resilience, such as injecting network latency or service outages |
| Soak Test | 浸泡测试 | Long-running stability test that verifies system behavior under sustained load |
| Recovery Drill | 恢复演练 | Recovery capability drill for scenarios such as crashes, disconnections, lock conflicts, and restarts |
| Chaos Smoke | 混沌冒烟测试 | Quick end-to-end test that verifies fault detection and repair capabilities at system startup |
| Admission Control | 准入控制 | Protection mechanism that rejects, delays, or degrades the system before overload |
| Readiness | 就绪度 | Whether a stage, module, or environment has reached the preparation state required to enter the next action |
| Stable Validation | 稳定验证 | Validation process that runs golden tasks and checks database integrity and backup round-trips |
| Stable Gate | 稳定门禁 | Quality threshold that an environment must pass to be promoted to the next stage |
| Golden Task Inventory | 黄金任务清单 | Required set of task categories, including coding / research / content / data etc. |
| VCR Replay Mode | VCR回放模式 | Includes three modes: fixture_only / vcr_replay / vcr_record; controls whether actual calls are allowed |
| Drift Detection | 漂移检测 | Compares current runtime results with a baseline to detect performance or behavior anomalies |
| Regression Detection | 回归检测 | Testing approach that discovers regressions in existing functionality caused by new code |
| Stable Runtime Validator | 运行时稳定验证器 | Core module that runs golden tasks and checks database integrity and backup validity |
| Stable Acceptance Line | 稳定验收线 | Quality standard that an environment must reach to be promoted to a production-ready state |
| Stable Release Gate | 发布门禁 | Stability and quality checks that must be passed before a version is released |
| Stable Release Package | 稳定发布包 | Version artifact that has been validated and is available for formal deployment |
| Stable Evidence Campaign | 证据收集活动 | A set of evidence packages collected to support promote / signoff decisions |
| Stable Evidence Bundle | 证据包 | A collection of evidence containing test results, baseline comparisons, regression analysis, etc. that supports release decisions |
| Stable Evidence Sequence | 证据序列 | Stability evidence records organized in chronological order |
| Stable Migration Compatibility Rehearsal | 迁移兼容性演练 | Rehearsal that verifies migration compatibility between system versions |
| Stable Gray Release Rehearsal | 灰度发布演练 | Rehearsal that verifies the reliability of the gray release mechanism |
| Stable Rolling Upgrade Rehearsal | 滚动升级演练 | Rehearsal that verifies the reliability of the rolling upgrade process |
| Stable Concurrency Rehearsal | 并发演练 | Rehearsal that verifies the system's ability to run stably under concurrent load |
| Stable Backup Restore Rehearsal | 备份恢复演练 | Rehearsal that verifies the reliability of the data backup and recovery process |
| Stable DB Queue Disconnect Rehearsal | 数据库队列断连演练 | Rehearsal that verifies system behavior in scenarios where database and queue connections are interrupted |
| Stable DB Writability Rehearsal | 数据库写入演练 | Rehearsal that verifies that database write capability is recoverable in failure scenarios |
| Stable Dispatch Rehearsal | 调度演练 | Rehearsal that verifies that the task dispatch mechanism works correctly under abnormal conditions |
| Stable Dispatch Reconciliation Rehearsal | 调度对账演练 | Rehearsal that verifies state consistency between the scheduler layer and the execution layer |
| Stable Event Replay Rehearsal | 事件重放演练 | Rehearsal that verifies the reliability of the event replay mechanism |
| Stable Lease Rehearsal | 租约演练 | Rehearsal that verifies correct release and renewal of task leases in failure scenarios |
| Stable Queue Delivery Rehearsal | 队列投递演练 | Rehearsal that verifies the reliability of message queue delivery |
| Stable Runtime Soak Runner | 运行时浸泡运行器 | Runner that performs long-running tests to verify stability |
| Stable Worker Handshake Rehearsal | Worker握手演练 | Rehearsal that verifies the reliability of worker registration and heartbeat mechanisms |
| Stable Worker Writeback Rehearsal | Worker回写演练 | Rehearsal that verifies the reliability of worker result writeback |
| Stable Cross-Division Recovery Drill | 跨部门恢复演练 | Disaster recovery drill for cross-division collaboration scenarios |
| Stable Maintenance Rehearsal | 维护演练 | Rehearsal that verifies availability protection capabilities during system maintenance |
| Prompt Injection Guard | 提示词注入防护 | Protection mechanism that detects and blocks malicious prompt injection attacks |
| Prompt Injection Red Team | 提示词注入红队 | Security testing team that targets prompt injection attacks |
| Environment Readiness | 环境就绪度 | Conditions that an environment must meet to be ready for production use |
| Environment Promotion | 环境晋升 | Process of upgrading an environment from its current stage to the next stage |
| Drill Type | 演练类型 | Includes backup_restore / rolling_upgrade / maintenance_drain / tenant_gray_rollout / regional_failover / worker_reassignment / queue_repair etc. |
| Golden Task Latency Band | 黄金任务延迟带 | Expected latency range for tasks, including interactive / extended |
| Golden Task Case | 黄金任务用例 | Specific golden task definition, including request, metadata, and expected result |
| Golden Task Run Result | 黄金任务运行结果 | Actual result and pass status after a golden task is executed |
| Golden Task Class | 黄金任务类别 | Required task types, including coding / research / content / data / cross_division / high_risk_approval / crash_recovery |
| VCR Replay Fixture | VCR回放固件 | Recorded and saved request / response pairs used for test replay |
| VCR Request Fingerprint | VCR请求指纹 | SHA-256 hash of a request, used to uniquely identify a recording |

---

## 39. Abbreviations

| English | 中文 | 解释 |
|---------|------|------|
| ADR | 架构决策记录 | Architecture Decision Record, documents important architecture decisions |
| API | 应用编程接口 | Application Programming Interface |
| SDK | 软件开发工具包 | Software Development Kit |
| DSL | 领域专用语言 | Domain-Specific Language |
| DDL | 数据定义语言 | Data Definition Language |
| WAL | 预写日志 | Write-Ahead Logging |
| HITL | 人工介入 | Human In The Loop |
| PII | 个人身份信息 | Personally Identifiable Information |
| TTL | 生存时间 | Time To Live |
| DLQ | 死信队列 | Dead Letter Queue |
| HA | 高可用 | High Availability |
| DR | 灾难恢复 | Disaster Recovery |
| OIDC | OpenID连接 | OpenID Connect, used for identity federation authentication |
| SSO | 单点登录 | Single Sign-On |
| SCIM | 用户身份同步 | System for Cross-domain Identity Management |
| RLS | 行级安全 | Row-Level Security |
| SBOM | 软件物料清单 | Software Bill of Materials |
| RCA | 根因分析 | Root Cause Analysis |
| VCR | 录像回放 | Video Cassette Recorder, figuratively refers to test recording and replay |
| IAM | 身份与访问管理 | Identity and Access Management |
| SLA | 服务等级协议 | Service Level Agreement |
| SLO | 服务目标 | Service Level Objective |
| SLI | 服务等级指标 | Service Level Indicator |

---

## 37. Protocol, Model & Security Abbreviations

| English | 中文 | 解释 |
|---------|------|------|
| ADR | 架构决策记录 | Architecture Decision Record, documents architecture design decisions |
| API | 应用编程接口 | Application Programming Interface, the interface surface exposed externally or between modules |
| SDK | 软件开发工具包 | Software Development Kit, derived from authoritative schema |
| DSL | 领域专用语言 | Domain-Specific Language, such as workflow DSL |
| DDL | 数据定义语言 | Data Definition Language, statements for table creation / indexes / constraint migrations |
| WAL | 预写日志 | Write-Ahead Logging, persistence mechanism for SQLite / databases |
| MCP | 模型上下文协议 | Model Context Protocol, external capability access protocol |
| HITL | 人工介入 | Human In The Loop, decision step that requires human participation |
| PII | 个人身份信息 | Personally Identifiable Information, must be redacted |
| TTL | 存活时间 | Time To Live, the validity duration of data or cache |
| DLQ | 死信队列 | Dead Letter Queue, accepts messages or tasks that cannot continue processing |
| HA | 高可用 | High Availability, ensures continuous system availability |
| DR | 容灾恢复 | Disaster Recovery, business recovery capability in disaster scenarios |
| OIDC | 开放身份连接 | OpenID Connect, used for identity federation authentication |
| SSO | 单点登录 | Single Sign-On, one authentication passes through the whole chain |
| SCIM | 身份同步协议 | System for Cross-domain Identity Management, user and organization identity synchronization |
| RLS | 行级安全 | Row-Level Security, row-level isolation in data access |
| SBOM | 软件物料清单 | Software Bill of Materials, dependency component manifest |
| RBAC | 基于角色的访问控制 | Role-Based Access Control, permission management model |
| PKCE | 代码交换证明 | Proof Key for Code Exchange, OAuth extension security mechanism |

---

## 38. Integration & Communication Abbreviations

| English | 中文 | 解释 |
|---------|------|------|
| RPC | 远程过程调用 | Remote Procedure Call, communication mode between services |
| REST | 表述性状态转移 | Representational State Transfer, Web API style |
| GraphQL | 图查询语言 | Graph Query Language, API query language |
| OAuth | 开放授权 | Open Authorization, third-party authorization protocol |
| Webhook | Web 回调 | Web callback, event-driven notification mechanism |
| SSE | 服务器推送事件 | Server-Sent Events, client receives server-side push |
| TCP | 传输控制协议 | Transmission Control Protocol, connection-oriented reliable transport |
| UDP | 用户数据报协议 | User Datagram Protocol, connectionless transport |
| HTTP | 超文本传输协议 | HyperText Transfer Protocol, Web communication |
| HTTPS | 安全超文本传输协议 | HTTP Secure, TLS-encrypted transport |
| DNS | 域名系统 | Domain Name System, domain name resolution |
| CDN | 内容分发网络 | Content Delivery Network, static resource acceleration |
| QoS | 服务质量 | Quality of Service, network performance guarantee |

---

## 39. Code-Level Variable Abbreviations

| English | 中文 | 解释 |
|---------|------|------|
| id | 标识符 | identifier, unique object identifier |
| uid | 用户标识 | user identifier, user identity number |
| pid | 进程标识 | process identifier, operating system process number |
| tid | 线程标识 | thread identifier, operating system thread number |
| sid | 会话标识 | session identifier, unique identifier for an interaction session |
| eid | 执行标识 | execution identifier, execution instance number |
| cid | 关联标识 | correlation identifier, cross-module correlation number |
| ts | 时间戳 | timestamp, records the time |
| ctx | 上下文 | context, execution environment information passing |
| cfg | 配置 | config / configuration, runtime parameters |
| opts | 选项 | options, optional parameters |
| args | 参数 | arguments, function / command input |
| env | 环境 | environment, runtime environment variables |
| db | 数据库 | database, persistent storage |
| sql | 查询语言 | structured query language |
| url | 资源定位符 | uniform resource locator |
| uri | 资源标识符 | uniform resource identifier |
| ip | 网络地址 | internet protocol address |
| err | 错误 | error, exception or failure state |
| res | 响应 | response, returned result |
| req | 请求 | request, input / call |
| resp | 响应 | response, returned data |
| msg | 消息 | message, communication unit |
| evt | 事件 | event, state change notification |
| svc | 服务 | service, business capability unit |
| repo | 仓库 | repository, code or data storage |
| auth | 认证 | authentication, identity verification |
| authz | 授权 | authorization, permission check |
| prop | 属性 | property, object attribute |
| val | 值 | value, attribute value |
| idx | 索引 | index, array position or database index |
| len | 长度 | length, quantity or size |
| max | 最大值 | maximum, upper limit |
| min | 最小值 | minimum, lower limit |
| prev | 上一个 | previous, prior state |
| curr | 当前 | current, current state |
| next | 下一个 | next, next state |
| init | 初始化 | initialize, initialization operation |
| def | 默认 | default, default value |
| tmp | 临时 | temporary, temporary variable |
| src | 源 | source, origin |
| dest | 目标 | destination, target location |

---

## 40. Operations & Business Abbreviations

| English | 中文 | 解释 |
|---------|------|------|
| SLA | 服务等级协议 | Service Level Agreement, externally committed agreement |
| SLO | 服务等级目标 | Service Level Objective, expected target |
| SLI | 服务等级指标 | Service Level Indicator, actual measurement metric |
| KPI | 关键绩效指标 | Key Performance Indicator, business measurement metric |
| OKR | 目标与关键成果 | Objectives and Key Results, goal management framework |
| PMF | 产品-市场匹配 | Product-Market Fit, product-market fit degree |
| ROI | 投资回报率 | Return on Investment, investment return ratio |
| MTTR | 平均恢复时间 | Mean Time To Recovery, average failure recovery duration |
| MTBF | 平均故障间隔 | Mean Time Between Failures, average fault-free runtime |
| RCA | 根因分析 | Root Cause Analysis, incident analysis process |
| RTO | 恢复时间目标 | Recovery Time Objective, failure recovery time target |
| RPO | 数据回退点目标 | Recovery Point Objective, acceptable data loss window |

---

## 41. Testing Abbreviations

| English | 中文 | 解释 |
|---------|------|------|
| E2E | 端到端 | End-to-End, complete test or flow from entry to result |
| UT | 单元测试 | Unit Test, single function / module test |
| IT | 集成测试 | Integration Test, cross-module collaboration test |
| VCR | 测试录制回放 | Video Cassette Recorder, external call recording / replay mechanism |

---

*This document is a read-only governance reference; in case of terminology conflicts, the corresponding authoritative contract takes precedence.*

---

## 42. Organization & Control Plane Roles

| English | 中文 | 解释 |
|---------|------|------|
| `strategic_governor` | 战略总督 | Control plane role for strategic judgment, escalation governance, and organization-level approvals (defined in the document; not implemented as an independent service in code) |
| `intake_router` | 摄取路由器 | Control plane role for input triage, classification, routing, and budget entry |
| `workflow_planner` | 工作流规划器 | Control plane role for cross-division decomposition, dependency graph, aggregation, and failure escalation |
| `division_lead` | 部门主管 | Control plane role for autonomous workflow orchestration within a division (defined in the document; not implemented as an independent service in code) |
| `division` | 事业部 | Business capability domain or division boundary; should not be confused with `tenant` |
| `role` | 角色 | Responsibility definition; not a running instance |
| `agent` | 智能体 | Intelligent execution entity that takes on a role; should not be confused with `worker` |
| `organization` | 组织 | Enterprise / organization-level boundary |
| `workspace` | 工作空间 | Workspace boundary under an organization; should not be confused with `session` |
| `tenant` | 租户 | Primary boundary for isolation, security, quota, and billing |

---

## 43. Channel & Extension

| English | 中文 | 解释 |
|---------|------|------|
| `channel` | 渠道 | User or system access interface, such as CLI, Web, Telegram, API (note: only telegram / slack / webhook are implemented in code) |
| `channel capability` | 渠道能力 | Capabilities supported by a channel, such as text, button, stream, attachment (note: there is no corresponding capability enum type defined in code) |
| `plugin` | 插件 | Installation unit that extends platform capabilities through a public SDK or controlled boundary |
| `skill` | 技能 | Reusable orchestration capability over tools or steps |
| `MCP` | 模型上下文协议 | External capability access protocol / extension type (MCP tools are validated by mcp-tool-guard) |
| `recipe` | 配方 | Structured workflow or template definition, usable as the workflow author input layer |
| `template` | 模板 | Similar to recipe, definition of a structured workflow or steps; reusable |
| `provider` | 提供方 | LLM or model capability provider |
| `model` | 模型 | Specific model instance provided by a provider |
| `model profile` | 模型画像 | Metadata of a model such as capabilities, limits, pricing, and default parameters |

---

## 44. Domain & Plugin Registry

| English | 中文 | 解释 |
|---------|------|------|
| `domain` | 领域 | Definition of a business capability domain, including workflows, toolBundles, outputContracts, etc. |
| `domain model` | 领域模型 | Structural definition including StepTemplateConfig, WorkflowConfig, ToolBundleConfig, etc. |
| `plugin binding` | 插件绑定 | Association configuration between a domain and a plugin, defining pluginId, pluginType, priority, etc. |
| `PluginSpiType` | 插件SPI类型 | Five types: retriever, validator, planner, presenter, adapter |
| `PluginLifecycleState` | 插件生命周期状态 | Includes registered, loaded, active, inactive, unloaded, degraded, disabled |
| `ExternalAdapterPlugin` | 外部适配器插件 | Plugin type that connects external systems (github, jira, notion, figma, etc.) |
| `PluginRuntimeIsolation` | 插件运行时隔离级别 | Includes shared_process, serialized_in_process, forked_process, sandboxed_process, containerized_process |
| `PluginSandboxPolicy` | 插件沙箱策略 | Security configuration such as timeoutMs, allowFilesystemWrite, allowNetworkEgress, etc. |

---

## 45. Confusable Term Pairs with Distinctions

### permission vs policy
- **permission**: Authorization result or static capability boundary. In code, the permission concept is implicitly implemented through PolicyEngine; there is no independent Permission type definition.
- **policy**: Adjudication logic and rule system; the code-level entry point that makes the final ruling on permissions, risk, approval, budget, and runtime constraints.
- **Distinction**: Verbal restrictions in prompts should not be treated as formal policy.

### queue vs lease
- **queue**: Task queuing mechanism that determines the waiting order.
- **lease**: Temporary ownership of an execution or worker dispatch; used to prevent duplicate execution and determine the current execution right.
- **Distinction**: When both exist, they should not substitute for each other.

### readiness vs production-ready
- **readiness**: Indicates the preparation level for reaching a certain gate or next action.
- **production-ready**: Indicates that the comprehensive threshold required for production safeguards has been reached.
- **Distinction**: `Phase 1a ready` must not be misread as `production-ready`.

### signoff vs completion gate
- **signoff**: Review conclusion for the current revision.
- **completion gate**: Threshold check that must be re-executed before entering coding.
- **Distinction**: A signoff conclusion should not be treated as a permanent pass.

### provider vs model
- **provider**: Service provider, such as OpenAI, Anthropic.
- **model**: Specific model instance provided by a provider, such as GPT-4, Claude-3.
- **Distinction**: `model profile` is model metadata and is not equal to provider profile.

### artifact vs output vs step output
- **artifact**: File-type or binary artifact, typically managed through the artifact store.
- **output**: Result for the upstream step or the user; may be structured data or text, not necessarily a file.
- **step output**: Structured result snapshot after a step completes.

### task vs session
- **task**: Business work unit; the smallest work commitment object the system exposes to users and business.
- **session**: Channel interaction session that carries user input, streaming output, and interaction context.
- **Distinction**: A single session can trigger multiple tasks; a single task may also update state across multiple sessions.

### workflow vs execution
- **workflow**: Definition of the structured execution path of a task.
- **execution**: A specific running attempt.
- **Distinction**: The same workflow can correspond to multiple execution attempts.

### agent vs worker
- **agent**: Emphasizes role and intelligent entity concept.
- **worker**: Emphasizes execution carrier and resource slot.
- **Distinction**: `sub-agent` is not synonymous with a remote worker.

---

## 46. Five-Plane Architecture

| English | 中文 | 解释 |
|---------|------|------|
| P1 Interface Plane | P1 接口平面 | External ingress layer: API Gateway / Webhook / Scheduler / Console / Ingress, responsible for input validation, identity authentication, rate limiting, and routing |
| P2 Control Plane | P2 控制平面 | Control and governance layer: Policy / Approval / Rollout / Incident / Config, responsible for definition and version governance, approval control, risk guards, and release control |
| P3 Orchestration Plane | P3 编排平面 | Orchestration and decision layer: OAPEFLIR Loop / Planner / Routing / Escalation, responsible for deciding what to do, who executes next, and when to pause for human intervention |
| P4 Execution Plane | P4 执行平面 | Unified execution layer: Dispatcher / Workers / Tools / Plugins / Recovery, responsible for actually executing actions, maintaining leases, writing back results, and triggering recovery |
| P5 State & Evidence Plane | P5 状态与证据平面 | State and evidence plane: Truth / Events / Artifacts / Memory / Knowledge / Audit / Projections, responsible for preserving control truth, historical trajectories, recovery support, and audit evidence |
| X1 Reliability Fabric | X1 可靠性织网 | Cross-plane cross-cutting life support system: AuthN/Z / Sandbox / Circuit Breaker / DLQ / Backpressure, injected into each plane as middleware |
| RequestEnvelope | 请求信封 | Standard request wrapper from P1 -> P2, containing requestId / tenantId / taskSpec / priority / traceContext / principal |
| ControlDirective | 控制指令 | Control directive from P2 -> P3/P4, used for mode switching, pausing, termination, rollback, and quota adjustment |
| ExecutionPlan | 执行计划 | Standard execution plan from P3 -> P4, describing ordered steps and resource constraints |
| ExecutionReceipt | 执行回执 | Execution result return from P4 -> P3/P5, containing status / duration / artifacts / telemetry / sideEffects / error |
| StateCommand | 状态命令 | State write instruction from P3/P4 -> P5, idempotent based on CAS |
| EvidenceRecord | 证据记录 | Asynchronous decision evidence write from P3 -> P5 |
| ProjectionUpdate | 投影更新 | Projection change event notification from P5 -> P2 |

---

## 47. OAPEFLIR Stage Types

| English | 中文 | 解释 |
|---------|------|------|
| OapeflirStage | OAPEFLIR 阶段枚举 | State enum for the eight-stage closed loop: `observe / assess / plan / execute / feedback / learn / improve / release / knowledge_promotion` |
| OapeflirStageStatus | OAPEFLIR 阶段状态 | Stage execution status: `completed / skipped` |
| OapeflirStageRecord | 阶段记录 | Records the execution status, duration, reference IDs, and reason code of a single stage |
| OapeflirStageTimelineBuilder | 阶段时间线构建器 | Utility class used to build execution timelines for each OAPEFLIR stage |
| OapeflirLoopInput | OAPEFLIR 循环输入 | Contains taskId / objective / workflow / feedbackSignals / blockerSummaries / fileRefs / stepOutputs |
| OapeflirLoopResult | OAPEFLIR 循环结果 | Contains observation / assessment / plan / stepOutputs / feedback / learningSignals / learningObjects / rolloutRecord / timeline / outcome / qualityGate / replanDecision |
| OapeflirLoopService | OAPEFLIR 循环服务 | Main service class of the OAPEFLIR closed loop, coordinating the execution of each stage |
| ExecuteBridge | 执行桥接 | Conversion interface from execution plan to dual-channel step output |
| RuntimeExecuteBridge | 运行时执行桥接 | Database-based implementation |
| MockExecuteBridge | 模拟执行桥接 | Mock implementation used for testing |

---

## 48. OAPEFLIR Status Enums

| English | 中文 | 解释 |
|---------|------|------|
| promotion_status | 推广状态 | Lifecycle status of LearningObject: `draft / validated / promoted / retired` |
| candidate_status | 候选状态 | Status of ImprovementCandidate: `proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| rollout_status | 发布状态 | Status of RolloutRecord: `draft / pending_approval / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable / rejected / rolled_back / paused` |
| rollout_level | 发布级别 | Gradual rollout level: `off / suggest / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable` |
| AssessmentPhase | 评估阶段 | Assessment moment: `pre-execution / post-execution` |
| AssessmentComplexity | 评估复杂度 | Task complexity level: `trivial / simple / moderate / complex / critical` |
| AssessmentRisk | 评估风险 | Risk level: `low / medium / high / critical` |
| ExecutionMode | 执行模式 | Execution mode: `auto / supervised / manual` |
| ApprovalLevel | 审批级别 | Approval requirement level: `none / user / admin` |
| FeedbackSource | 反馈来源 | Source of feedback signal: `execution / user / hitl / validation / system` |
| FeedbackCategory | 反馈类别 | Category of feedback signal: `success / failure / correction / timeout / partial` |
| FeedbackSeverity | 反馈严重性 | Feedback severity: `info / warning / error / critical` |
| PlanStrategy | 计划策略 | Plan generation strategy: `linear / hierarchical / tree_branch / reflexive / goal_driven / resource_constrained / online / replanned` |
| PlanStepStatus | 计划步骤状态 | Step execution status: `pending / running / done / failed / skipped` |
| LearningType | 学习类型 | Learning object type: `failure_pattern / user_correction / recovery_playbook / model_retraining / dataset_gap` |
| ValidatedBy | 验证方式 | Learning object validation method: `none / evidence / human_review / shadow_execution` |
| ImprovementChangeScope | 改进变更范围 | Scope of improvement change: `prompt / policy / model / workflow / tool_config` |
| TaskPhase | 任务阶段 | Current stage of the task: `intake / planning / executing / reviewing / completed` |

---

## 49. Execution Assessment Types

| English | 中文 | 解释 |
|---------|------|------|
| ExecutionAssessment | 执行评估 | Complete post-execution assessment of a plan, including result classification, quality score, deviation analysis, and replan suggestion |
| ExecutionOutcome | 执行结果 | Execution result type: `completed / completed_with_deviations / repairable / failed / escalated` |
| ExecutionDeviation | 执行偏差 | Workflow deviation from the plan during execution: `skipped / reordered / modified / added / substituted` |
| ExecutionError | 执行错误 | Error encountered during execution, including step ID, error code, message, severity, and recoverability |
| CriterionResult | 标准结果 | Success criterion evaluation result, including pass/fail, actual value, and failure reason |

---

## 50. Recovery & Fault Tolerance

| English | 中文 | 解释 |
|---------|------|------|
| runtime repair | 运行时修复 | Mechanism that automatically repairs execution in the event of a failure |
| replay | 重放 | Re-execute from a known good state |
| recovery playbook | 恢复手册 | Standardized recovery steps for a specific failure mode |
| lease reclaim | 租约回收 | Reclaim execution rights from timed-out workers |
| stalled detection | 停滞检测 | Detect executions that have made no effective progress for a long time |
| auto-rollback | 自动回滚 | Automatically fall back to the previous version when a release fails |
| guardrail | 护栏 | Mechanism that protects the production environment from inappropriate changes |
| canary | 金丝雀发布 | Validate a new version with small traffic first, then expand |
| circuit breaker | 断路器 | Protection mechanism that temporarily blocks calls when the failure rate is too high |

---

*This document is a read-only governance reference; in case of terminology conflicts, the corresponding authoritative contract takes precedence.*
