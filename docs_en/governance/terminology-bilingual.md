# Terminology Bilingual Glossary | 术语对照表

## Overview | 概述

This document provides a comprehensive Chinese-English bilingual reference for all core terms used in the Automatic Agent Platform. Terms are organized by domain area.

This document is the Chinese-English bilingual reference for all core terminology of the Automatic Agent Platform, organized by domain area.

---

## 1. Core Objects | 核心对象

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

## 2. OAPEFLIR Terms | OAPEFLIR 术语

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

## 3. Execution & Recovery | 执行与恢复

| English | 中文 | 解释 |
|---------|------|------|
| runtime | 运行时 | The runtime layer that actually executes task / workflow / agent / tool |
| execution ticket | 执行票据 | Formal execution document issued by the scheduling layer to the execution layer |
| lease | 租约 | Temporary ownership of a specific execution or worker dispatch |
| lease owner | 租约持有者 | The execution entity currently holding the execution right |
| fencing token | 隔离令牌 | Version token that prevents old executors from writing back stale results |
| dispatch | 调度分发 | Allocating a task or execution right to an execution carrier |
| worker | 工作器 | Execution carrier unit, may be local or remote |
| sub-agent | 子代理 | Secondary intelligent execution unit collaborating within the same task context |
| heartbeat | 心跳 | Periodic health/load reporting |
| stalled | 停滞 | The process is not necessarily dead but has shown no valid progress within the specified time |
| dead-letter | 死信 | Failure record that cannot be auto-recovered or should not be retried |
| checkpoint | 检查点 | State snapshot at a recoverable boundary |
| partial result | 部分结果 | The task is not fully complete, but there is a retainable, auditable intermediate result |
| compensation | 补偿 | Action to roll back, reconcile, or manually repair a step with side effects that have already occurred |

---

## 4. Task Status | 任务状态

| English | 中文 | 解释 |
|---------|------|------|
| queued | 排队中 | Task pre-execution state; created but not yet entering scheduling |
| pending | 待处理 | Task pre-execution state; created but not yet entering scheduling |
| in_progress | 进行中 | Advancing the main logic (Task state) |
| awaiting_decision | 等待决策 | Task waiting for approval; waiting for an approval decision |
| done | 已完成 | Task terminal state; Task ended successfully |
| failed | 失败 | Execution failed and the current attempt is terminated |
| cancelled | 已取消 | Explicitly terminated; will not continue |

---

## 5. Workflow Status | 工作流状态

| English | 中文 | 解释 |
|---------|------|------|
| running | 运行中 | Workflow is advancing the main logic |
| paused | 已暂停 | Explicitly paused; can be resumed |
| resuming | 恢复中 | Workflow transition state for resuming from pause |
| completed | 已完成 | Workflow ended successfully |
| failed | 失败 | Workflow execution failed |
| cancelling | 取消中 | Workflow transient state before cancelled |
| cancelled | 已取消 | Explicitly terminated; will not continue |

---

## 6. Execution Status | 执行实例状态

| English | 中文 | 解释 |
|---------|------|------|
| created | 已创建 | Execution created state; Execution has been created |
| prechecking | 预校验中 | Execution pre-validation phase; pre-execution validation stage |
| executing | 执行中 | Advancing the main logic (Execution state) |
| blocked | 阻塞 | Temporarily unable to continue due to unmet dependencies, approval, policy, or resource reasons |
| succeeded | 成功 | Execution completed successfully |
| failed | 失败 | Execution failed |
| cancelled | 已取消 | Explicitly terminated; will not continue |
| superseded | 已替代 | Execution replaced by newer execution |

---

## 7. Session Status | 会话状态

| English | 中文 | 解释 |
|---------|------|------|
| open | 开放 | Session open state; the session is in the open state |
| streaming | 流式输出中 | Session streaming state; the session is streaming output |
| awaiting_user | 等待用户 | Waiting for human or external system input (Session state) |
| paused | 已暂停 | Session paused; the session is paused |
| completed | 已完成 | Session completed; the session ended successfully |
| failed | 失败 | Session failed; the session failed |
| cancelled | 已取消 | Session cancelled; the session is terminated |

---

## 8. Approval Status | 审批状态

| English | 中文 | 解释 |
|---------|------|------|
| requested | 已请求 | Approval requested; waiting for a human decision |
| approved | 已批准 | Approval granted; approval passed |
| rejected | 已拒绝 | Approval denied; approval did not pass |
| expired | 已过期 | Approval timeout; approval timed out |
| cancelled | 已取消 | Approval cancelled; approval is revoked |

---

## 9. Worker & Dispatch | 工作器与调度

| English | 中文 | 解释 |
|---------|------|------|
| worker | 工作器 | Execution carrier unit, may be local or remote |
| agent | 智能体 | Intelligent execution entity that assumes role responsibilities |
| coordinator | 协调器 | Scheduling coordination service that manages task distribution among workers |
| idle | 空闲 | Worker can accept new tasks |
| busy | 忙碌 | Worker is executing a task |
| draining | 排空中 | Worker is completing existing tasks but not accepting new ones |
| degraded | 降级 | Worker capability is limited but still functional |
| unavailable | 不可用 | Worker cannot currently accept tasks |
| quarantined | 隔离 | Worker is temporarily disabled |
| offline | 离线 | Worker connection is lost |
| local | 本地 | Worker is deployed in the same process |
| remote | 远程 | Worker is connected via a bridge |
| execution ticket | 执行票据 | Formal execution document issued by the scheduling layer to the execution layer |
| dispatch | 调度分发 | Allocating a task or execution right to an execution carrier |

---

## 10. Lease & Fencing | 租约与隔离

| English | 中文 | 解释 |
|---------|------|------|
| lease | 租约 | Temporary ownership of a specific execution or worker dispatch |
| fencing token | 隔离令牌 | Version token that prevents old executors from writing back stale results |
| active | 活跃 | Lease is currently valid |
| expired | 已过期 | Lease has exceeded the validity period |
| released | 已释放 | Lease was actively released |
| reclaimed | 已回收 | Lease was reclaimed by the system |
| handed_over | 已交接 | Lease was handed over to another worker |
| stale_write_rejected | 过期写入拒绝 | Old write rejected because the fencing token did not match |

---

## 11. Message & Event | 消息与事件

| English | 中文 | 解释 |
|---------|------|------|
| message | 消息 | A complete message object |
| message part | 消息片段 | Structured segment inside a message |
| inbound | 入站 | Message direction: user input |
| outbound | 出站 | Message direction: system output |
| system | 系统 | Message direction: system notification |
| event | 事件 | Structured fact notification inside the system |
| tier_1 event | 一级事件 | Events that must be durably persisted, must be recoverable, and must not be silently lost |
| tier_2 event | 二级事件 | Events delivered at least once |
| tier_3 event | 三级事件 | Best-effort delivered events |
| ack | 确认 | Record that a consumer has acknowledged processing of an event |
| replay | 重放 | Re-delivering events from an in-memory buffer |
| stream | 流 | Incremental output stream for channel/UI |
| stream_id | 流标识 | Unique identifier of a presentation stream |

---

## 12. Message Part Types | 消息片段类型

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
| hook_event | 钩子事件 | Hook trigger event segment |
| command_execution | 命令执行 | Command execution segment |
| mcp_call | MCP 调用 | Model Context Protocol call segment |

---

## 13. Step Output Status | 步骤输出状态

| English | 中文 | 解释 |
|---------|------|------|
| succeeded | 成功 | Step completed successfully |
| failed | 失败 | Step execution failed |
| partial_success | 部分成功 | Step partially succeeded; partial result exists |
| skipped | 已跳过 | Step was skipped |

---

## 14. Memory | 记忆系统

| English | 中文 | 解释 |
|---------|------|------|
| memory | 记忆 | Retrievable memory unit |
| layer_3 | 第三层 | High-frequency low-latency memory layer |
| layer_5 | 第五层 | Mid-frequency mid-latency memory layer |
| layer_7 | 第七层 | Low-frequency high-latency memory layer |
| general | 一般 | General memory content |
| fact | 事实 | Factual memory content |
| episode | 事件 | Episodic memory content |
| rule | 规则 | Rule-based memory content |
| decision | 决策 | Decision-based memory content |
| active | 活跃 | Memory is currently available |
| archived | 归档 | Memory is archived |
| superseded | 已替代 | Memory has been replaced by new content |
| trusted | 可信 | Information source is trusted |
| external | 外部 | Information source is external |
| untrusted | 不可信 | Information source is untrusted |

---

## 15. Run Types | 运行类型

| English | 中文 | 解释 |
|---------|------|------|
| task_run | 任务运行 | Standard task execution type |
| tool_call | 工具调用 | Tool call execution type |
| approval_resume | 审批恢复 | Resume execution after approval |
| replay | 重放 | Replay execution |

---

## 16. Compensation & Checkpoint | 补偿与检查点

| English | 中文 | 解释 |
|---------|------|------|
| compensation | 补偿 | Action to roll back, reconcile, or manually repair a step with side effects that have already occurred |
| idempotent_replay | 幂等重放 | Compensation strategy via replay |
| compare_and_swap_write | 比较并交换写入 | Compensation strategy via CAS write |
| compensating_action | 补偿动作 | Rollback strategy via executing a compensating action |
| manual_reconciliation_required | 需要人工对账 | Manual intervention required for reconciliation and repair |
| checkpoint | 检查点 | State snapshot at a recoverable boundary |
| resume_from_checkpoint | 从检查点恢复 | Strategy to resume execution from a checkpoint |
| replay_from_start | 从头重放 | Strategy to re-execute from the start of a workflow |
| manual_reconciliation | 人工对账 | Strategy that requires manual intervention for repair |

---

## 17. Termination & Error | 终止与错误

| English | 中文 | 解释 |
|---------|------|------|
| reasonCode | 原因码 | Termination reason code, recorded as a string |
| termination_initiator | 终止发起者 | Subject that triggered the termination: user / system / policy / admin |
| termination_scope | 终止范围 | Termination impact scope: step / workflow / task / session |
| recoverable | 可恢复 | Whether the recovery path is allowed after termination |
| dead-letter | 死信 | Failure record that cannot be auto-recovered or should not be retried |

---

## 18. Task Priority & Source | 任务优先级与来源

| English | 中文 | 解释 |
|---------|------|------|
| low | 低 | Low priority |
| normal | 普通 | Normal priority |
| high | 高 | High priority |
| urgent | 紧急 | Urgent priority |
| user | 用户 | Task source: directly created by the user |
| perception | 感知 | Task source: triggered by system perception |
| system | 系统 | Task source: created internally by the system |

---

## 19. Isolation & Placement | 隔离与部署

| English | 中文 | 解释 |
|---------|------|------|
| standard | 标准 | Standard isolation level |
| hardened | 加固 | Hardened isolation level |
| strict | 严格 | Strict isolation level |
| local | 本地 | Worker is deployed in the same process |
| remote | 远程 | Worker is connected via a bridge |

---

## 20. Session Consistency | 会话一致性

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
| aligned | 对齐 | Workspace state has been synchronized |
| conflict | 冲突 | Workspace state has conflicts |

---

## 21. Lease Audit Events | 租约审计事件

| English | 中文 | 解释 |
|---------|------|------|
| lease_granted | 租约授予 | Lease was granted |
| lease_renewed | 租约续期 | Lease was renewed |
| lease_expired | 租约过期 | Lease expired naturally |
| lease_reclaimed | 租约回收 | Lease was reclaimed by the system |
| stale_write_rejected | 过期写入拒绝 | Old write rejected because the token did not match |
| lease_released | 租约释放 | Lease was actively released |
| lease_handover | 租约交接 | Lease was handed over to another execution entity |

---

## 22. Dispatch Rejection Reasons | 调度拒绝原因

| English | 中文 | 解释 |
|---------|------|------|
| worker_unavailable | 工作器不可用 | Worker is currently unavailable |
| worker_quarantined | 工作器被隔离 | Worker is in a quarantined state |
| worker_offline | 工作器离线 | Worker connection is lost |
| worker_draining | 工作器排空中 | Worker is draining |
| worker_degraded_filtered | 工作器降级被过滤 | Degraded worker is filtered out |
| worker_untrusted | 工作器不可信 | Worker trust check failed |
| worker_capacity_full | 工作器容量满 | Worker has reached maximum capacity |
| queue_affinity_mismatch | 队列亲和性不匹配 | Queue affinity requirements are not met |
| missing_capabilities | 缺少能力 | Worker is missing the required capabilities |
| worker_placement_mismatch | 工作器部署位置不匹配 | Local/remote placement requirements are not met |
| worker_isolation_mismatch | 工作器隔离级别不匹配 | Isolation level requirements are not met |
| worker_repo_version_mismatch | 工作器版本不匹配 | Code repository version requirements are not met |
| worker_remote_session_unready | 工作器远程会话未就绪 | Remote session is not ready |

---

## 23. Execution Ticket Status | 执行票据状态

| English | 中文 | 解释 |
|---------|------|------|
| pending | 待认领 | Ticket is waiting to be claimed |
| claimed | 已认领 | Ticket has been claimed by a worker |
| consumed | 已消费 | Ticket has been consumed |
| cancelled | 已取消 | Ticket has been cancelled |
| expired | 已过期 | Ticket has expired |

---

## 24. Operator Actions | 操作员动作

| English | 中文 | 解释 |
|---------|------|------|
| take_over_task | 接管任务 | Operator takes over a task |
| modify_input | 修改输入 | Operator modifies task input |
| retry_execution | 重试执行 | Operator triggers a retry |
| skip_step | 跳过步骤 | Operator skips a step |
| set_current_step | 设置当前步骤 | Operator sets the current execution step |
| switch_worker | 切换工作器 | Operator switches the execution worker |
| write_step_output | 写入步骤输出 | Operator writes a step output |
| complete_task | 完成任务 | Operator manually completes a task |

---

## 25. Takeover Session | 接管会话

| English | 中文 | 解释 |
|---------|------|------|
| open | 开放 | Takeover session is in the open state |
| closed | 已关闭 | Takeover session has ended |

---

## 26. Evolution & Promotion | 演化与晋升

| English | 中文 | 解释 |
|---------|------|------|
| pending_approval | 待审批 | Proposal is awaiting approval |
| approved | 已批准 | Proposal is approved |
| rejected | 已拒绝 | Proposal is rejected |
| applied | 已应用 | Proposal is applied |
| rolled_back | 已回滚 | Proposal is rolled back |
| draft | 草稿 | Draft state |
| validated | 已验证 | Has passed validation |
| promoted | 已推广 | Has been promoted |
| retired | 已退役 | Has been retired |
| shadow | 影子运行 | Runs in shadow mode |
| canary_5 | 5% 金丝雀 | 5% traffic canary release |
| partial_25 | 25% 分批 | 25% batch release |
| partial_50 | 50% 分批 | 50% batch release |
| partial_75 | 75% 分批 | 75% batch release |
| stable | 稳定 | Stable version |
| shadow_running | 影子运行中 | Currently running in shadow mode |

---

## 27. Compaction | 上下文压缩

| English | 中文 | 解释 |
|---------|------|------|
| trim | 修剪 | Remove old tool results |
| summarize | 摘要 | Compress content into key insights |

---

## 28. Event Consumer Ack | 事件消费者确认

| English | 中文 | 解释 |
|---------|------|------|
| pending | 待确认 | Waiting for consumer acknowledgement |
| acked | 已确认 | Consumer has acknowledged |
| failed | 失败 | Acknowledgement failed |
| dead_lettered | 死信 | Moved to the dead-letter queue |

---

## 29. Remote Log Levels | 远程日志级别

| English | 中文 | 解释 |
|---------|------|------|
| debug | 调试 | Debug-level log |
| info | 信息 | Info-level log |
| warn | 警告 | Warning-level log |
| error | 错误 | Error-level log |

---

## 30. Budget Scope | 预算范围

| English | 中文 | 解释 |
|---------|------|------|
| task_execution | 任务执行 | Task execution budget |
| compaction | 压缩 | Context compaction budget |
| skill_execution | 技能执行 | Skill execution budget |
| recovery_retry | 恢复重试 | Recovery retry budget |
| approval_review | 审批审查 | Approval review budget |

---

## 31. Transition | 状态转换

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

## 32. Quick Reference: Commonly Confused Terms | 快速参考：易混淆术语

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
- **artifact**: Emphasizes file artifact
- **output**: Emphasizes result semantics
- **step output**: Emphasizes step-level structured snapshot

### queued vs blocked
- **queued**: Waiting for scheduling dispatch
- **blocked**: Cannot continue due to dependency / approval / policy / resource

### paused vs awaiting_user
- **paused**: Explicitly paused
- **awaiting_user**: Waiting for external input

### stalled vs offline
- **stalled**: Has progress but timed out
- **offline**: Connection is lost

### failed vs cancelled
- **failed**: Execution failure terminated
- **cancelled**: Explicitly cancelled

### done vs completed
- **done**: The unique Task terminal success state
- **completed**: Workflow success end state

---

## Document Info | 文档信息

- Source: `docs_zh/governance/glossary_and_terminology.md` and `src/platform/contracts/types/`
- Governance Level: Main version (terminology glossary main version)
- Last Updated: 2026-04-22

---

## 33. Data & Storage | 数据与存储

| English | 中文 | 解释 |
|---------|------|------|
| Authoritative Store | 权威存储 | The storage system that has final say over a category of facts; the ultimate source of truth for data; must not be mixed with arbitrary caches |
| Transaction Store | 事务存储 | Storage responsible for transactional data such as task, state, approval, and event; in code, transactional data is stored in AuthoritativeSqlDatabase |
| Artifact Store | 产物存储 | Storage for file-based, large-volume, or export-type artifacts; differs in nature from the transaction store |
| Analytics Store | 分析存储 | Storage oriented toward projections and materialized views; not a standalone analytics reporting store |
| Data Plane | 数据平面 | The unified data plane of transaction layer, artifact, analytics, archive, replay (currently a planning concept) |
| Namespace | 命名空间 | Logical namespace under data, artifact, or tenant boundaries; distinct from an OS path |
| Eventual Consistency | 最终一致性 | State that is allowed to converge after a brief delay; differs from a strong consistency guarantee |
| Reconciliation | 对账修复 | Action of reconciling and repairing state, events, workers, locks, etc. |
| Migration | 迁移 | Formal version migration of schema or storage structure; distinct from ad-hoc SQL patch |
| Storage Backend | 存储后端 | Underlying storage abstraction supporting both SQLite and PostgreSQL drivers |
| Storage Driver | 存储驱动 | Storage engine driver type: SQLite or PostgreSQL |
| Schema Migration | Schema 迁移 | Formal upgrade or downgrade process of a database structure version |
| Checksum Mismatch | 校验和不匹配 | Migration version validation failed; expected does not match actual |
| Shadow SQLite | 影子 SQLite | SQLite shadow database running in parallel under the PostgreSQL dual-run mode |
| Authoritative Task Store | 权威任务存储 | Authoritative task state storage for Phase 1a; delegated to sqlite or postgres implementation |
| Phase 1a Store | Phase 1a 存储 | Task storage abstraction of the initial stable core phase |
| Read-after-write Consistency | 写后读一致性 | Guarantee that a read immediately after a write can see the written result |
| Lease | 租约 | Temporary ownership of a specific execution or worker dispatch; not permanent ownership |
| Fencing Token | 隔离令牌 | Version token that prevents old executors from writing back stale results; not a regular sequence |
| Dead-letter | 死信 | Failure record that cannot be auto-recovered or should not be retried |
| Partial Result | 部分结果 | The task is not fully complete, but there is a retainable, auditable intermediate result |
| Checkpoint | 检查点 | State snapshot at a recoverable boundary; distinct from arbitrary temporary variables |

---

## 34. Configuration & Version | 配置与版本

| English | 中文 | 解释 |
|---------|------|------|
| Config Bundle | 配置包 | A group of configurations that take effect together, including layers such as bootstrap, gateways, providers, runtime, security, workflows |
| Config Version | 配置版本 | Version identifier after a configuration change, used for tamper detection and cache management |
| Config Layer | 配置层级 | Vertical layer structure of configuration, such as platform, tenant, pack, task_type |
| Feature Flag | 特性开关 | Switch that controls capability on/off or grayscale |
| Prompt Bundle | Prompt 包 | A group of prompts that are released and versioned together |
| Config Diff | 配置差异 | Change entries between two configuration bundles, used for drift detection |
| Bundle Hash | 包哈希 | SHA-256 hash of the entire configuration bundle |
| Layer Hash | 层级哈希 | Content hash of a single configuration layer, used for change detection |
| Tamper Detection | 篡改检测 | Detecting unauthorized configuration changes via version ID comparison |
| Config Rollout | 配置发布 | Configuration release supporting canary strategy; can be progressively pushed in stages (5%/25%/50%/100%) |
| Canary Rollout | 金丝雀发布 | Configuration release strategy that first runs at a small scale and then expands progressively |
| Rollback Point | 回滚点 | Configuration version snapshot record available for recovery |
| Config Governance Service | 配置治理服务 | Service responsible for loading, validating, and integrity-checking the layered configuration bundle |
| Sandbox Policy | 沙箱策略 | Security validation policy for file path access to prevent directory traversal attacks |
| Compatibility Window | 兼容性窗口 | Officially supported compatibility time window between different runtime/SDK/protocol/plugin |
| Promote Criteria | 晋升标准 | Evidence threshold for a module to be promoted from available to platform-ready/production-ready |
| Readiness Registry | 就绪注册表 | Formal registry surface that records the readiness state of an environment or module |
| Evidence Package | 证据包 | A group of evidence used to support promote/signoff/production-ready judgment |
| Production-ready | 生产就绪 | Has reached the comprehensive threshold required for production fallback |
| Phase 1a Ready | Phase 1a 就绪 | Reached the minimum viable threshold of the Phase 1a stable core |

---

## 35. Prompt & Cache | Prompt 与缓存

| English | 中文 | 解释 |
|---------|------|------|
| Fixed Prefix | 固定前缀 | Fixed prefix of the system prompt shared across agents; by default does not participate in normal compaction |
| Domain Block | 领域块 | Middle layer of prompt reusable within the same domain/profile |
| Variable Suffix | 变量后缀 | Prompt suffix that varies dynamically by task, role, plan, memory |
| KV Cache Fixed Prefix | KV 缓存固定前缀 | Prefill cache reuse mechanism based on the same prefix hash |

---

## 36. Storage Operations | 存储运行机制

| English | 中文 | 解释 |
|---------|------|------|
| Migration Runner | 迁移运行器 | State management service responsible for executing storage backend schema upgrades |
| Schema Status | Schema 状态 | Comparison status between the current version and the expected version |
| Pending Versions | 待执行版本 | List of migration versions not yet applied |
| Up-to-date | 最新版本 | Current storage schema has completed all migrations |
| Dual Run | 双跑模式 | Mode where production PostgreSQL must run an SQLite shadow database in parallel |

---

## 37. Security & Governance | 安全与治理

| English | 中文 | 解释 |
|---------|------|------|
| Policy Engine | 策略引擎 | The code-level entry point for final adjudication of permissions, risk, approval, budget, and runtime constraints; the unified security decision center |
| HITL (Human In The Loop) | 人工介入 | Decision step that requires explicit human participation; high-risk operations must pass human approval before continuing |
| Approval | 人工审批 | Decision node in a workflow that requires explicit human confirmation to continue |
| Break-Glass | 紧急放行 | High-risk emergency release configuration flag; critical risk triggers the break-glass approval type, used to urgently bypass standard procedures |
| Sandbox | 沙箱 | Execution isolation boundary that confines untrusted code or operations to a controlled environment |
| Exec Policy | 执行策略 | Rule set for tool/command execution, defining which operations are allowed or prohibited |
| Permission | 权限 | Authorization state of a subject to see or use a capability; implicitly implemented via PolicyEngine |
| Secret | 密钥/凭证 | Sensitive confidential information such as keys, tokens, credentials, including API Key, OAuth Token, database password, etc. |
| Secret Masking | 密钥脱敏 | Method of masking sensitive secret information in logs and display to prevent credential leakage |
| Data Classification | 数据分级 | Data sensitivity classification rules, including four levels: public/internal/confidential/restricted |
| Audit Evidence | 审计证据 | Traceable, verifiable, non-repudiable action evidence used for compliance and accountability |
| Field Encryption | 字段加密 | Encryption protection on specific fields, ensuring the security of sensitive data in storage and transmission |
| Network Egress Policy | 出站网络策略 | Strategy for controlling and auditing network requests initiated from the system to the external network |
| Outbound URL Policy | 出站URL策略 | Rules for filtering and restricting target URLs of external HTTP requests |
| Kill Switch | 熔断开关 | Switch that fully disables system functions in an emergency; once activated, all operations will be rejected |
| Budget Guard | 预算防护 | Mechanism that monitors and controls task execution cost to prevent exceeding budget |
| Risk Category | 风险类别 | Risk types evaluated by PolicyEngine, including destructive/irreversible/prod_affecting, etc. |
| PII (Personally Identifiable Information) | 个人身份信息 | Information that can identify an individual, such as email, phone, SSN, credit card number, etc. |
| Secret Lease | 密钥租约 | Time-limited access authorization for a secret, controlling the secret's validity period and usage scope |
| Secret Rotation | 密钥轮换 | Operations practice of periodically updating secrets to reduce the risk of leakage |
| CVE Intelligence | CVE情报 | Known security vulnerability intelligence service, tracking and evaluating the system's exposure to vulnerabilities |
| Policy Decision Request | 策略决策请求 | Policy evaluation request containing context such as task ID, subject ID, action, risk category |
| Policy Decision Result | 策略决策结果 | Decision result returned by the policy engine, including allow/deny/escalate_for_approval |
| Data Classification Level | 数据分级级别 | Includes four sensitivity levels: public/internal/confidential/restricted |
| Data Handling Dimension | 数据处理维度 | Scenario dimensions of data flow, including prompt/logs/memory/artifact/cross_worker/debug |
| Handling Decision | 处理决策 | Allow/deny/mask/audit decision made based on data classification and handling dimensions |
| PII Detection | PII检测 | Using regular expression patterns to identify personally identifiable information in content |
| PII Annotation | PII标注 | Marking the location and masked form of detected PII in content |
| Secret Management Service | 密钥管理服务 | Service that uniformly manages the lifecycle, rotation, and access of all secrets |
| Managed Secret Provider | 托管密钥提供者 | Provider that retrieves secrets from Vault/KMS/Secret Manager, etc. |
| Env Secret Provider | 环境变量密钥提供者 | Provider that reads secrets from environment variables |
| External Secret Provider | 外部密钥提供者 | Provider that retrieves secrets from an external secret management system |
| Audit Integrity | 审计完整性 | Integrity protection mechanism that ensures audit records are not tampered with |
| Network Egress Audit | 出站网络审计 | Audit mechanism that records and reviews all outbound network requests |
| Trusted Context Scanner | 可信上下文扫描器 | Component that scans and validates the trusted context configuration |
| File Freshness | 文件新鲜度 | Mechanism that checks whether a file is outdated or needs updating |
| CVE Intelligence Service | CVE情报服务 | Intelligence service that tracks and evaluates the impact of known security vulnerabilities |
| Approval Service | 审批服务 | Service that handles manual approval requests and decisions |
| Approval Request | 审批请求 | Approval task sent to a human approver |
| Approval Decision | 审批决策 | Approval or rejection decision made by the approver |
| Idempotent | 幂等性 | Property that repeated execution of the same operation produces consistent results |

---

## 38. Testing & Stabilization | 测试与稳定化

| English | 中文 | 解释 |
|---------|------|------|
| Stable Core | 稳定核心 | The minimum capability scope intentionally narrowed to achieve stable operation first, ensuring core functions are reliable |
| Golden Task | 黄金任务 | Fixed representative task used as the version regression baseline, used to verify that basic system functions have not regressed |
| Fixture | 测试固件 | Pre-set fixed input/output samples used for stable testing and VCR replay |
| VCR (Video Cassette Recorder) | VCR录制回放 | Testing mechanism that records/replays external LLM calls to achieve deterministic testing |
| Unit Test | 单元测试 | Fine-grained test targeting a single function, module, or object |
| Integration Test | 集成测试 | Cross-module collaborative test that validates the correctness of interaction between multiple components |
| E2E (End-to-End) | 端到端测试 | Complete flow test from entry to result, covering the entire system chain |
| Chaos Test | 混沌测试 | Test that actively injects faults to verify recovery and resilience, such as injecting network latency, service downtime |
| Soak Test | 浸泡测试 | Stability test that runs continuously for a long time, verifying the system's performance under long-term load |
| Recovery Drill | 恢复演练 | Recovery capability drill for scenarios such as crash, disconnection, lock conflict, and restart |
| Chaos Smoke | 混沌冒烟测试 | Quick end-to-end test that verifies fault detection and repair capabilities at system startup |
| Admission Control | 准入控制 | Protection mechanism where the system rejects, delays, or degrades before overload |
| Readiness | 就绪度 | Whether a stage, module, or environment has reached the state of being ready for the next action |
| Stable Validation | 稳定验证 | Verification process that runs golden tasks and checks database integrity and backup round-trip |
| Stable Gate | 稳定门禁 | Quality threshold that an environment must pass to upgrade to the next stage |
| Golden Task Inventory | 黄金任务清单 | Set of task categories that must be covered, including coding/research/content/data, etc. |
| VCR Replay Mode | VCR回放模式 | Includes three modes: fixture_only/vcr_replay/vcr_record, controlling whether actual calls are allowed |
| Drift Detection | 漂移检测 | Comparing the current run result with the baseline to detect performance or behavior anomalies |
| Regression Detection | 回归检测 | Test method that discovers new code causing degradation of existing functionality |
| Stable Runtime Validator | 运行时稳定验证器 | Core module that runs golden tasks and checks database integrity and backup validity |
| Stable Acceptance Line | 稳定验收线 | Quality standard line that an environment must reach to be promoted to production-ready |
| Stable Release Gate | 发布门禁 | Stability and quality check that must be passed before version release |
| Stable Release Package | 稳定发布包 | Version artifact that has been verified and is available for formal deployment |
| Stable Evidence Campaign | 证据收集活动 | A group of evidence packages collected to support promote/signoff judgment |
| Stable Evidence Bundle | 证据包 | Evidence set containing test results, baseline comparison, regression analysis, etc., that supports release decisions |
| Stable Evidence Sequence | 证据序列 | Stability evidence records organized in time order |
| Stable Migration Compatibility Rehearsal | 迁移兼容性演练 | Rehearsal that verifies the system's compatibility when migrating between different versions |
| Stable Gray Release Rehearsal | 灰度发布演练 | Rehearsal that verifies the reliability of the gray release mechanism |
| Stable Rolling Upgrade Rehearsal | 滚动升级演练 | Rehearsal that verifies the reliability of the rolling upgrade process |
| Stable Concurrency Rehearsal | 并发演练 | Rehearsal that verifies the system's ability to run stably under concurrent load |
| Stable Backup Restore Rehearsal | 备份恢复演练 | Rehearsal that verifies the reliability of the data backup and recovery process |
| Stable DB Queue Disconnect Rehearsal | 数据库队列断连演练 | Rehearsal that verifies system behavior under database and queue disconnection scenarios |
| Stable DB Writability Rehearsal | 数据库写入演练 | Rehearsal that verifies database write capability is recoverable in failure scenarios |
| Stable Dispatch Rehearsal | 调度演练 | Rehearsal that verifies that the task scheduling mechanism works properly under abnormal conditions |
| Stable Dispatch Reconciliation Rehearsal | 调度对账演练 | Rehearsal that verifies consistency between the scheduling layer and the execution layer |
| Stable Event Replay Rehearsal | 事件重放演练 | Rehearsal that verifies the reliability of the event replay mechanism |
| Stable Lease Rehearsal | 租约演练 | Rehearsal that verifies the task lease mechanism correctly releases and renews in failure scenarios |
| Stable Queue Delivery Rehearsal | 队列投递演练 | Rehearsal that verifies the reliability of message queue delivery |
| Stable Runtime Soak Runner | 运行时浸泡运行器 | Runner that runs long-duration continuous tests to verify stability |
| Stable Worker Handshake Rehearsal | Worker握手演练 | Rehearsal that verifies the reliability of worker registration and heartbeat mechanisms |
| Stable Worker Writeback Rehearsal | Worker回写演练 | Rehearsal that verifies the reliability of the worker result writeback mechanism |
| Stable Cross-Division Recovery Drill | 跨部门恢复演练 | Disaster recovery drill for cross-division collaboration scenarios |
| Stable Maintenance Rehearsal | 维护演练 | Rehearsal of availability assurance capability during system maintenance |
| Prompt Injection Guard | 提示词注入防护 | Protection mechanism that detects and blocks malicious prompt injection attacks |
| Prompt Injection Red Team | 提示词注入红队 | Security test team targeting prompt injection attacks |
| Environment Readiness | 环境就绪度 | Conditions that an environment must meet to be put into production use |
| Environment Promotion | 环境晋升 | Process of upgrading an environment from the current stage to the next |
| Drill Type | 演练类型 | Includes backup_restore/rolling_upgrade/maintenance_drain/tenant_gray_rollout/regional_failover/worker_reassignment/queue_repair, etc. |
| Golden Task Latency Band | 黄金任务延迟带 | Expected latency range of a task, including interactive/extended |
| Golden Task Case | 黄金任务用例 | Specific golden task definition, including request, metadata, expected result |
| Golden Task Run Result | 黄金任务运行结果 | Actual result and pass status after golden task execution |
| Golden Task Class | 黄金任务类别 | Task types that must be covered, including coding/research/content/data/cross_division/high_risk_approval/crash_recovery |
| VCR Replay Fixture | VCR回放固件 | Recorded request/response pairs saved for test replay |
| VCR Request Fingerprint | VCR请求指纹 | SHA-256 hash of the request, used to uniquely identify the recording |

---

## 39. Abbreviations | 缩写词

| English | 中文 | 解释 |
|---------|------|------|
| ADR | 架构决策记录 | Architecture Decision Record; records important architecture decisions |
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
| OIDC | OpenID连接 | OpenID Connect; used for identity authentication federation |
| SSO | 单点登录 | Single Sign-On |
| SCIM | 用户身份同步 | System for Cross-domain Identity Management |
| RLS | 行级安全 | Row-Level Security |
| SBOM | 软件物料清单 | Software Bill of Materials |
| RCA | 根因分析 | Root Cause Analysis |
| VCR | 录像回放 | Video Cassette Recorder; metaphorically refers to test recording and replay |
| IAM | 身份与访问管理 | Identity and Access Management |
| SLA | 服务等级协议 | Service Level Agreement |
| SLO | 服务目标 | Service Level Objective |
| SLI | 服务等级指标 | Service Level Indicator |

---

## 37. Protocol, Model & Security Abbreviations | 协议、模型与安全缩写

| English | 中文 | 解释 |
|---------|------|------|
| ADR | 架构决策记录 | Architecture Decision Record; architecture design decision document |
| API | 应用编程接口 | Application Programming Interface; external or inter-module interface surface |
| SDK | 软件开发工具包 | Software Development Kit; derived from authoritative schema |
| DSL | 领域专用语言 | Domain-Specific Language, such as workflow DSL |
| DDL | 数据定义语言 | Data Definition Language; table/index/constraint migration statements |
| WAL | 预写日志 | Write-Ahead Logging; persistence mechanism of SQLite/database |
| MCP | 模型上下文协议 | Model Context Protocol; external capability access protocol |
| HITL | 人工介入 | Human In The Loop; decision link that requires human participation |
| PII | 个人身份信息 | Personally Identifiable Information; requires masking |
| TTL | 存活时间 | Time To Live; validity duration of data or cache |
| DLQ | 死信队列 | Dead Letter Queue; takes over messages or tasks that cannot be processed further |
| HA | 高可用 | High Availability; continuous system availability assurance |
| DR | 容灾恢复 | Disaster Recovery; business recovery capability in disaster scenarios |
| OIDC | 开放身份连接 | OpenID Connect; used for identity authentication federation |
| SSO | 单点登录 | Single Sign-On; one-time authentication for full-link access |
| SCIM | 身份同步协议 | System for Cross-domain Identity Management; user and organization identity synchronization |
| RLS | 行级安全 | Row-Level Security; row-level isolation at the data access layer |
| SBOM | 软件物料清单 | Software Bill of Materials; dependency component list |
| RBAC | 基于角色的访问控制 | Role-Based Access Control; permission management model |
| PKCE | 代码交换证明 | Proof Key for Code Exchange; OAuth extended security mechanism |

---

## 38. Integration & Communication Abbreviations | 集成与通信缩写

| English | 中文 | 解释 |
|---------|------|------|
| RPC | 远程过程调用 | Remote Procedure Call; inter-service communication mode |
| REST | 表述性状态转移 | Representational State Transfer; Web API style |
| GraphQL | 图查询语言 | Graph Query Language; API query language |
| OAuth | 开放授权 | Open Authorization; third-party authorization protocol |
| Webhook | Web 回调 | Web callback; event-driven notification mechanism |
| SSE | 服务器推送事件 | Server-Sent Events; client receives server push |
| TCP | 传输控制协议 | Transmission Control Protocol; reliable connection transport |
| UDP | 用户数据报协议 | User Datagram Protocol; connectionless transport |
| HTTP | 超文本传输协议 | HyperText Transfer Protocol; Web communication |
| HTTPS | 安全超文本传输协议 | HTTP Secure; TLS-encrypted transport |
| DNS | 域名系统 | Domain Name System; domain name resolution |
| CDN | 内容分发网络 | Content Delivery Network; static resource acceleration |
| QoS | 服务质量 | Quality of Service; network performance assurance |

---

## 39. Code-Level Variable Abbreviations | 代码级别变量缩写

| English | 中文 | 解释 |
|---------|------|------|
| id | 标识符 | identifier; unique identifier of an object |
| uid | 用户标识 | user identifier; user identity number |
| pid | 进程标识 | process identifier; operating system process number |
| tid | 线程标识 | thread identifier; operating system thread number |
| sid | 会话标识 | session identifier; unique identifier of an interaction session |
| eid | 执行标识 | execution identifier; execution instance number |
| cid | 关联标识 | correlation identifier; cross-module correlation number |
| ts | 时间戳 | timestamp; records time |
| ctx | 上下文 | context; execution environment information passing |
| cfg | 配置 | config/configuration; runtime parameters |
| opts | 选项 | options; optional parameters |
| args | 参数 | arguments; function/command input |
| env | 环境 | environment; runtime environment variable |
| db | 数据库 | database; persistent storage |
| sql | 查询语言 | structured query language |
| url | 资源定位符 | uniform resource locator |
| uri | 资源标识符 | uniform resource identifier |
| ip | 网络地址 | internet protocol address |
| err | 错误 | error; exception or failure state |
| res | 响应 | response; return result |
| req | 请求 | request; input/call |
| resp | 响应 | response; return data |
| msg | 消息 | message; communication unit |
| evt | 事件 | event; state change notification |
| svc | 服务 | service; business capability unit |
| repo | 仓库 | repository; code or data storage |
| auth | 认证 | authentication; identity verification |
| authz | 授权 | authorization; permission check |
| prop | 属性 | property; object property |
| val | 值 | value; property value |
| idx | 索引 | index; array position or database index |
| len | 长度 | length; quantity or size |
| max | 最大值 | maximum; upper limit |
| min | 最小值 | minimum; lower limit |
| prev | 上一个 | previous; previous state |
| curr | 当前 | current; current state |
| next | 下一个 | next; next state |
| init | 初始化 | initialize; initialization operation |
| def | 默认 | default; default value |
| tmp | 临时 | temporary; temporary variable |
| src | 源 | source; origin |
| dest | 目标 | destination; target location |

---

## 40. Operations & Business Abbreviations | 运维与业务缩写

| English | 中文 | 解释 |
|---------|------|------|
| SLA | 服务等级协议 | Service Level Agreement; externally committed agreement |
| SLO | 服务等级目标 | Service Level Objective; expected goal to achieve |
| SLI | 服务等级指标 | Service Level Indicator; actual measured indicator |
| KPI | 关键绩效指标 | Key Performance Indicator; business measurement indicator |
| OKR | 目标与关键成果 | Objectives and Key Results; goal management framework |
| PMF | 产品-市场匹配 | Product-Market Fit; product-market fit degree |
| ROI | 投资回报率 | Return on Investment; investment income ratio |
| MTTR | 平均恢复时间 | Mean Time To Recovery; average fault recovery time |
| MTBF | 平均故障间隔 | Mean Time Between Failures; average trouble-free runtime |
| RCA | 根因分析 | Root Cause Analysis; incident analysis process |
| RTO | 恢复时间目标 | Recovery Time Objective; fault recovery time goal |
| RPO | 数据回退点目标 | Recovery Point Objective; acceptable data loss window |

---

## 41. Testing Abbreviations | 测试缩写

| English | 中文 | 解释 |
|---------|------|------|
| E2E | 端到端 | End-to-End; complete test or process from entry to result |
| UT | 单元测试 | Unit Test; single function/module test |
| IT | 集成测试 | Integration Test; cross-module collaborative test |
| VCR | 测试录制回放 | Video Cassette Recorder; external call recording/replay mechanism |

---

*This document is a read-only governance reference. If a term conflict is found, the corresponding authoritative contract shall prevail.*

---

## 42. Organization & Control Plane Roles | 组织与控制层角色

| English | 中文 | 解释 |
|---------|------|------|
| `strategic_governor` | 战略总督 | Control plane role for strategic judgment, escalation governance, and organization-level approval (document-defined, not implemented as an independent service in code) |
| `intake_router` | 摄取路由器 | Control plane role for input triage, classification, routing, and budget entry |
| `workflow_planner` | 工作流规划器 | Control plane role for cross-division split, dependency graph, aggregation, and failure escalation |
| `division_lead` | 部门主管 | Control plane role for workflow autonomous orchestration within a division (document-defined, not implemented as an independent service in code) |
| `division` | 事业部 | Business capability domain or division boundary; should not be confused with `tenant` |
| `role` | 角色 | Responsibility definition; not a running instance |
| `agent` | 智能体 | Intelligent execution entity that assumes role responsibilities; should not be confused with `worker` |
| `organization` | 组织 | Enterprise/organization-level boundary |
| `workspace` | 工作空间 | Workspace boundary under an organization; should not be confused with `session` |
| `tenant` | 租户 | Primary boundary for isolation, security, quota, and billing |

---

## 43. Channel & Extension | 渠道与扩展

| English | 中文 | 解释 |
|---------|------|------|
| `channel` | 渠道 | User or system access interface, such as CLI, Web, Telegram, API (note: only telegram/slack/webhook are implemented in code) |
| `channel capability` | 渠道能力 | Capabilities supported by a channel, such as text, button, stream, attachment (note: no corresponding capability enum type is defined in code) |
| `plugin` | 插件 | Installation unit that extends platform capabilities via public SDK or controlled boundary |
| `skill` | 技能 | Reusable orchestration capability for tools or steps |
| `MCP` | 模型上下文协议 | One of the external capability access protocols/extension types (MCP tools are validated via mcp-tool-guard) |
| `recipe` | 配方 | Structured workflow or template definition; can serve as the workflow author input layer |
| `template` | 模板 | Similar to recipe; definition of a structured workflow or step; reusable |
| `provider` | 提供方 | LLM or model capability provider |
| `model` | 模型 | Specific model instance provided by a provider |
| `model profile` | 模型画像 | Metadata of a model, such as capability, limit, price, default parameters |

---

## 44. Domain & Plugin Registry | 领域与插件注册

| English | 中文 | 解释 |
|---------|------|------|
| `domain` | 领域 | Definition of a business capability domain, including workflows, toolBundles, outputContracts, etc. |
| `domain model` | 领域模型 | Structure definition including StepTemplateConfig, WorkflowConfig, ToolBundleConfig, etc. |
| `plugin binding` | 插件绑定 | Association configuration between a domain and a plugin, defining pluginId, pluginType, priority, etc. |
| `PluginSpiType` | 插件SPI类型 | Includes five types: retriever, validator, planner, presenter, adapter |
| `PluginLifecycleState` | 插件生命周期状态 | Includes registered, loaded, active, inactive, unloaded, degraded, disabled |
| `ExternalAdapterPlugin` | 外部适配器插件 | Plugin type that connects external systems (github, jira, notion, figma, etc.) |
| `PluginRuntimeIsolation` | 插件运行时隔离级别 | Includes shared_process, serialized_in_process, forked_process, sandboxed_process, containerized_process |
| `PluginSandboxPolicy` | 插件沙箱策略 | Security configurations such as timeoutMs, allowFilesystemWrite, allowNetworkEgress |

---

## 45. Confusable Term Pairs with Distinctions | 易混淆术语对详解

### permission vs policy | 权限 vs 策略
- **permission（权限）**: Authorization result or static capability boundary. In code, the permission concept is implicitly implemented via PolicyEngine, and there is no independent Permission type definition.
- **policy（策略）**: Adjudication logic and rule system; the code-level entry point for final adjudication of permissions, risk, approval, budget, and runtime constraints.
- **distinction**: Verbal restrictions in prompts should not be treated as a formal policy.

### queue vs lease | 队列 vs 租赁
- **queue（队列）**: Task queuing mechanism that determines the waiting order.
- **lease（租赁）**: Temporary ownership of a specific execution or worker dispatch; used to prevent duplicate execution and determines the current execution right.
- **distinction**: When both exist, they should not replace each other.

### readiness vs production-ready | 就绪度 vs 生产就绪
- **readiness（就绪度）**: Indicates the preparation for reaching a certain gate or the next action.
- **production-ready（生产就绪）**: Indicates that the comprehensive threshold required for production fallback has been reached.
- **distinction**: `Phase 1a ready` must not be misread as `production-ready`.

### signoff vs completion gate | 签过 vs 完成门
- **signoff（签过）**: Review conclusion of the current revision.
- **completion gate（完成门）**: Threshold check that must be executed again before entering coding.
- **distinction**: A single signoff conclusion should not be treated as a permanent pass.

### provider vs model | 提供方 vs 模型
- **provider（提供方）**: Service provider, such as OpenAI, Anthropic.
- **model（模型）**: Specific model instance provided by a provider, such as GPT-4, Claude-3.
- **distinction**: `model profile` is model metadata, not equal to provider profile.

### artifact vs output vs step output | 产物 vs 输出 vs 步骤输出
- **artifact（产物）**: File or binary artifact, typically managed through the artifact store.
- **output（输出）**: Result for the upstream step or the user; may be structured data or text, not necessarily a file.
- **step output（步骤输出）**: Structured result snapshot after a step completes.

### task vs session | 任务 vs 会话
- **task（任务）**: Business work unit; the smallest work commitment object the system exposes to users and business.
- **session（会话）**: Channel interaction session that carries user input, streaming output, and interaction context.
- **distinction**: One session can trigger multiple tasks; one task may also update state across multiple sessions.

### workflow vs execution | 工作流 vs 执行
- **workflow（工作流）**: Structured execution path definition of a task.
- **execution（执行）**: A specific running attempt.
- **distinction**: The same workflow can correspond to multiple execution attempts.

### agent vs worker | 智能体 vs 工作器
- **agent（智能体）**: Emphasizes the role and intelligent entity concept.
- **worker（工作器）**: Emphasizes execution carrier and resource slot.
- **distinction**: `sub-agent` is not synonymous with a remote worker.

---

## 46. Five-Plane Architecture | 五平面架构

| English | 中文 | 解释 |
|---------|------|------|
| P1 Interface Plane | P1 接口平面 | External access layer: API Gateway / Webhook / Scheduler / Console / Ingress; responsible for input validation, identity authentication, rate limiting, and routing |
| P2 Control Plane | P2 控制平面 | Control and governance layer: Policy / Approval / Rollout / Incident / Config; responsible for definition and version governance, approval control, risk guard, release control |
| P3 Orchestration Plane | P3 编排平面 | Orchestration and decision layer: OAPEFLIR Loop / Planner / Routing / Escalation; responsible for deciding what to do, who executes next, and when to pause for human intervention |
| P4 Execution Plane | P4 执行平面 | Unified execution layer: Dispatcher / Workers / Tools / Plugins / Recovery; responsible for actually executing actions, maintaining leases, writing back results, and triggering recovery |
| P5 State & Evidence Plane | P5 状态与证据平面 | State and evidence plane: Truth / Events / Artifacts / Memory / Knowledge / Audit / Projections; responsible for preserving control truth, historical trajectory, recovery support, audit evidence |
| X1 Reliability Fabric | X1 可靠性织网 | Cross-plane horizontal life-support system: AuthN/Z / Sandbox / Circuit Breaker / DLQ / Backpressure; injected into each plane as middleware |
| RequestEnvelope | 请求信封 | Standard request wrapper from P1 -> P2, including requestId / tenantId / taskSpec / priority / traceContext / principal |
| ControlDirective | 控制指令 | Control directive from P2 -> P3/P4, used for mode switching, pause, termination, rollback, quota adjustment |
| ExecutionPlan | 执行计划 | Standard execution plan from P3 -> P4, describing ordered steps and resource constraints |
| ExecutionReceipt | 执行回执 | Execution result return from P4 -> P3/P5, including status / duration / artifacts / telemetry / sideEffects / error |
| StateCommand | 状态命令 | State write command from P3/P4 -> P5, with idempotency guaranteed by CAS |
| EvidenceRecord | 证据记录 | Asynchronous decision evidence write from P3 -> P5 |
| ProjectionUpdate | 投影更新 | Projection change event notification from P5 -> P2 |

---

## 47. OAPEFLIR Stage Types | OAPEFLIR 阶段类型

| English | 中文 | 解释 |
|---------|------|------|
| OapeflirStage | OAPEFLIR 阶段枚举 | State enum of the eight-stage closed loop: `observe / assess / plan / execute / feedback / learn / improve / release / knowledge_promotion` |
| OapeflirStageStatus | OAPEFLIR 阶段状态 | Stage execution status: `completed / skipped` |
| OapeflirStageRecord | 阶段记录 | Records the execution status, duration, reference ID, and reason code of a single stage |
| OapeflirStageTimelineBuilder | 阶段时间线构建器 | Utility class used to build execution timelines of OAPEFLIR stages |
| OapeflirLoopInput | OAPEFLIR 循环输入 | Includes taskId / objective / workflow / feedbackSignals / blockerSummaries / fileRefs / stepOutputs |
| OapeflirLoopResult | OAPEFLIR 循环结果 | Includes observation / assessment / plan / stepOutputs / feedback / learningSignals / learningObjects / rolloutRecord / timeline / outcome / qualityGate / replanDecision |
| OapeflirLoopService | OAPEFLIR 循环服务 | Main service class of the OAPEFLIR closed loop, coordinating the execution of each stage |
| ExecuteBridge | 执行桥接 | Conversion interface from execution plan to dual-channel step output |
| RuntimeExecuteBridge | 运行时执行桥接 | Implementation based on database |
| MockExecuteBridge | 模拟执行桥接 | Mock implementation used for testing |

---

## 48. OAPEFLIR Status Enums | OAPEFLIR 状态枚举

| English | 中文 | 解释 |
|---------|------|------|
| promotion_status | 推广状态 | Lifecycle state of LearningObject: `draft / validated / promoted / retired` |
| candidate_status | 候选状态 | State of ImprovementCandidate: `proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| rollout_status | 发布状态 | State of RolloutRecord: `draft / pending_approval / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable / rejected / rolled_back / paused` |
| rollout_level | 发布级别 | Release grayscale level: `off / suggest / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable` |
| AssessmentPhase | 评估阶段 | Assessment moment: `pre-execution / post-execution` |
| AssessmentComplexity | 评估复杂度 | Task complexity level: `trivial / simple / moderate / complex / critical` |
| AssessmentRisk | 评估风险 | Risk level: `low / medium / high / critical` |
| ExecutionMode | 执行模式 | Execution mode: `auto / supervised / manual` |
| ApprovalLevel | 审批级别 | Approval requirement level: `none / user / admin` |
| FeedbackSource | 反馈来源 | Feedback signal source: `execution / user / hitl / validation / system` |
| FeedbackCategory | 反馈类别 | Feedback signal category: `success / failure / correction / timeout / partial` |
| FeedbackSeverity | 反馈严重性 | Feedback severity: `info / warning / error / critical` |
| PlanStrategy | 计划策略 | Plan generation strategy: `linear / hierarchical / tree_branch / reflexive / goal_driven / resource_constrained / online / replanned` |
| PlanStepStatus | 计划步骤状态 | Step execution status: `pending / running / done / failed / skipped` |
| LearningType | 学习类型 | Learning object type: `failure_pattern / user_correction / recovery_playbook / model_retraining / dataset_gap` |
| ValidatedBy | 验证方式 | Learning object validation method: `none / evidence / human_review / shadow_execution` |
| ImprovementChangeScope | 改进变更范围 | Scope of improvement change: `prompt / policy / model / workflow / tool_config` |
| TaskPhase | 任务阶段 | Current stage of the task: `intake / planning / executing / reviewing / completed` |

---

## 49. Execution Assessment Types | 执行评估类型

| English | 中文 | 解释 |
|---------|------|------|
| ExecutionAssessment | 执行评估 | Complete post-execution assessment of a plan, including outcome classification, quality score, deviation analysis, and replanning suggestions |
| ExecutionOutcome | 执行结果 | Execution outcome type: `completed / completed_with_deviations / repairable / failed / escalated` |
| ExecutionDeviation | 执行偏差 | Workflow deviation from the plan during execution: `skipped / reordered / modified / added / substituted` |
| ExecutionError | 执行错误 | Error encountered during execution, including step ID, error code, message, severity, and recoverability |
| CriterionResult | 标准结果 | Success criterion evaluation result, including pass/fail, actual value, and failure reason |

---

## 50. Recovery & Fault Tolerance | 恢复与容错

| English | 中文 | 解释 |
|---------|------|------|
| runtime repair | 运行时修复 | Mechanism that automatically repairs execution on failure |
| replay | 重放 | Re-execute from a known good state |
| recovery playbook | 恢复手册 | Standardized recovery steps for specific failure modes |
| lease reclaim | 租约回收 | Reclaim execution rights of timed-out workers |
| stalled detection | 停滞检测 | Detect executions that have not made valid progress for a long time |
| auto-rollback | 自动回滚 | Automatically fall back to the previous version when release fails |
| guardrail | 护栏 | Mechanism that protects production from inappropriate changes |
| canary | 金丝雀发布 | Validate the new version with a small traffic before scaling up |
| circuit breaker | 断路器 | Protection mechanism that temporarily blocks calls when the failure rate is too high |

---

*This document is a read-only governance reference. If a term conflict is found, the corresponding authoritative contract shall prevail.*
