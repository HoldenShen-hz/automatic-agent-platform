# Terminology Bilingual Glossary | 术语对照表

## Overview | 概述

This document provides a comprehensive Chinese-English bilingual reference for all core terms used in the Automatic Agent Platform. Terms are organized by domain area.

本文档为自动代理平台的全部核心术语提供中文-英文对照参考，按领域分类组织。

---

## 1. Core Objects | 核心对象

| English | 中文 | 解释 |
|---------|------|------|
| task | 任务 | User-level work unit, the smallest work commitment object the system presents to users and business |
| workflow | 工作流 | Structured execution path for a task, defining steps, dependencies, inputs/outputs, and failure paths |
| step | 步骤 | Single execution step within a workflow |
| execution | 执行实例 | A specific runtime attempt of a task/workflow |
| attempt | 重试计数 | Retry count/re-entry sequence for the same execution or step |
| session | 会话 | Channel interaction session, carrying user input, streaming output, and interaction context |
| message | 消息 | A complete message object, may contain multiple message parts |
| message part | 消息片段 | Structured fragment within a message, such as text, tool_use, tool_result, summary |
| artifact | 产物/制品 | File or binary product, typically managed through artifact store |
| output | 输出 | Result oriented to upstream steps or users, may be structured data or text, not necessarily a file |
| step output | 步骤输出 | Structured result snapshot after a step completes |
| result envelope | 结果信封 | Unified result encapsulation for success, partial success, failure, warnings, artifacts, and metrics |

---

## 2. OAPEFLIR Terms | OAPEFLIR 术语

| English | 中文 | 解释 |
|---------|------|------|
| OAPEFLIR | OAPEFLIR | Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release eight-stage closed loop |
| stage | 阶段 | Stage-level status unit within the OAPEFLIR closed loop |
| loop iteration | 闭环迭代 | Execution round of a complete or partial closed-loop iteration |
| TaskSituation | 任务态势 | Fact snapshot output by Observe |
| UnifiedAssessment | 统一评估 | Structured judgment output by Assess |
| Plan | 执行计划 | Explicit execution plan from Plan Hub |
| FeedbackSignal | 反馈信号 | Structured feedback signal collected after Execute |
| LearningObject | 学习对象 | Reusable learning object produced by Learn Hub |
| ImprovementCandidate | 改进候选 | Improvement candidate produced by Improve Hub |
| RolloutRecord | 发布记录 | Controlled release record from Release stage |

---

## 3. Execution & Recovery | 执行与恢复

| English | 中文 | 解释 |
|---------|------|------|
| runtime | 运行时 | The layer that actually executes task/workflow/agent/tool |
| execution ticket | 执行票据 | Formal execution document issued from scheduler to execution layer |
| lease | 租约 | Temporary ownership of an execution or worker dispatch |
| lease owner | 租约持有者 | The execution entity currently holding execution rights |
| fencing token | 隔离令牌 | Version token to prevent old executors from writing dirty results |
| dispatch | 调度分发 | Assigning a task or execution rights to some execution carrier |
| worker | 工作器 | Execution carrier unit, may be local or remote |
| sub-agent | 子代理 | Secondary intelligent execution unit collaborating within the same task context |
| heartbeat | 心跳 | Periodic health/load reporting |
| stalled | 停滞 | Process may not be dead but has no effective progress within specified time |
| dead-letter | 死信 | Failure pocket record that cannot be automatically recovered or should not continue retrying |
| checkpoint | 检查点 | State snapshot at recoverable boundary |
| partial result | 部分结果 | Task not yet fully complete, but has retainable and auditable阶段性 results |
| compensation | 补偿 | Action to rollback, reconcile, or manually repair steps that have already occurred side effects |

---

## 4. Task Status | 任务状态

| English | 中文 | 解释 |
|---------|------|------|
| queued | 排队中 | Task pre-execution state, created but not yet entered scheduling |
| pending | 待处理 | Task pre-execution state, created but not yet entered scheduling |
| in_progress | 进行中 | Main logic actively advancing (Task status) |
| awaiting_decision | 等待决策 | Task waiting for approval |
| done | 已完成 | Task terminal state, Task successfully ended |
| failed | 失败 | Execution failed and current attempt terminated |
| cancelled | 已取消 | Explicitly terminated, no longer continuing |

---

## 5. Workflow Status | 工作流状态

| English | 中文 | 解释 |
|---------|------|------|
| running | 运行中 | Workflow main logic actively advancing |
| paused | 已暂停 | Explicitly paused, resumable |
| resuming | 恢复中 | Workflow transition state for resuming from pause |
| completed | 已完成 | Workflow successfully ended |
| failed | 失败 | Workflow execution failed |
| cancelling | 取消中 | Workflow transient state before cancelled |
| cancelled | 已取消 | Explicitly terminated, no longer continuing |

---

## 6. Execution Status | 执行实例状态

| English | 中文 | 解释 |
|---------|------|------|
| created | 已创建 | Execution created state |
| prechecking | 预校验中 | Execution pre-validation phase |
| executing | 执行中 | Main logic actively advancing (Execution status) |
| blocked | 阻塞 | Temporarily unable to continue due to unmet dependencies, approval, policy, or resource reasons |
| succeeded | 成功 | Execution successfully completed |
| failed | 失败 | Execution failed |
| cancelled | 已取消 | Explicitly terminated, no longer continuing |
| superseded | 已替代 | Execution replaced by newer execution |

---

## 7. Session Status | 会话状态

| English | 中文 | 解释 |
|---------|------|------|
| open | 开放 | Session open state, session is in open state |
| streaming | 流式输出中 | Session streaming state, in session streaming output |
| awaiting_user | 等待用户 | Waiting for human or external system input (Session status) |
| paused | 已暂停 | Session paused |
| completed | 已完成 | Session completed, successfully ended |
| failed | 失败 | Session failed |
| cancelled | 已取消 | Session cancelled, terminated |

---

## 8. Approval Status | 审批状态

| English | 中文 | 解释 |
|---------|------|------|
| requested | 已请求 | Approval requested, waiting for human decision |
| approved | 已批准 | Approval granted |
| rejected | 已拒绝 | Approval denied |
| expired | 已过期 | Approval timeout |
| cancelled | 已取消 | Approval cancelled |

---

## 9. Worker & Dispatch | 工作器与调度

| English | 中文 | 解释 |
|---------|------|------|
| worker | 工作器 | Execution carrier unit, may be local or remote |
| agent | 智能体 | Intelligent execution entity that assumes role responsibilities |
| coordinator | 协调器 | Scheduling coordination service that manages task distribution among workers |
| idle | 空闲 | Worker can accept new tasks |
| busy | 忙碌 | Worker is executing tasks |
| draining | 排空中 | Worker is completing existing tasks but not accepting new ones |
| degraded | 降级 | Worker capability limited but still operational |
| unavailable | 不可用 | Worker currently unable to accept tasks |
| quarantined | 隔离 | Worker temporarily disabled |
| offline | 离线 | Worker connection disconnected |
| local | 本地 | Worker deployed in same process |
| remote | 远程 | Worker connected via bridge |
| execution ticket | 执行票据 | Formal execution document issued from scheduler to execution layer |
| dispatch | 调度分发 | Assigning a task or execution rights to some execution carrier |

---

## 10. Lease & Fencing | 租约与隔离

| English | 中文 | 解释 |
|---------|------|------|
| lease | 租约 | Temporary ownership of an execution or worker dispatch |
| fencing token | 隔离令牌 | Version token to prevent old executors from writing dirty results |
| active | 活跃 | Lease currently valid |
| expired | 已过期 | Lease has exceeded validity period |
| released | 已释放 | Lease actively released |
| reclaimed | 已回收 | Lease reclaimed by system |
| handed_over | 已交接 | Lease handed over to another worker |
| stale_write_rejected | 过期写入拒绝 | Old write rejected due to fencing token mismatch |

---

## 11. Message & Event | 消息与事件

| English | 中文 | 解释 |
|---------|------|------|
| message | 消息 | A complete message object |
| message part | 消息片段 | Structured fragment within a message |
| inbound | 入站 | Message direction: user input |
| outbound | 出站 | Message direction: system output |
| system | 系统 | Message direction: system notification |
| event | 事件 | Structured fact notification within the system |
| tier_1 event | 一级事件 | Must be reliably persisted, must be recoverable, must not be silently lost |
| tier_2 event | 二级事件 | At-least-once delivery events |
| tier_3 event | 三级事件 | Best-effort delivery events |
| ack | 确认 | Record that a consumer has confirmed processing an event |
| replay | 重放 | Re-send events from memory buffer |
| stream | 流 | Incremental output stream for channels/UI |
| stream_id | 流标识 | Unique identifier for a display stream |

---

## 12. Message Part Types | 消息片段类型

| English | 中文 | 解释 |
|---------|------|------|
| text | 文本 | Text content fragment |
| reasoning | 推理 | Reasoning process tracking fragment |
| tool_use | 工具调用 | Tool usage request fragment |
| tool_result | 工具结果 | Tool execution result fragment |
| summary | 摘要 | Content summary fragment |
| artifact_ref | 产物引用 | Fragment that references an artifact |
| decision_prompt | 决策提示 | Decision prompt fragment |
| agent_ref | 智能体引用 | Fragment that references an agent |
| subtask_ref | 子任务引用 | Fragment that references a subtask |
| retry_record | 重试记录 | Retry history fragment |
| step_boundary | 步骤边界 | Step boundary marker fragment |
| compaction_marker | 压缩标记 | Context compaction marker fragment |
| hook_event | 钩子事件 | Hook trigger event fragment |
| command_execution | 命令执行 | Command execution fragment |
| mcp_call | MCP 调用 | Model Context Protocol call fragment |

---

## 13. Step Output Status | 步骤输出状态

| English | 中文 | 解释 |
|---------|------|------|
| succeeded | 成功 | Step completed successfully |
| failed | 失败 | Step execution failed |
| partial_success | 部分成功 | Step partially successful, partial results exist |
| skipped | 已跳过 | Step was skipped |

---

## 14. Memory | 记忆系统

| English | 中文 | 解释 |
|---------|------|------|
| memory | 记忆 | Retrievable memory unit |
| layer_3 | 第三层 | High-frequency low-latency memory layer |
| layer_5 | 第五层 | Medium-frequency medium-latency memory layer |
| layer_7 | 第七层 | Low-frequency high-latency memory layer |
| general | 一般 | General memory content |
| fact | 事实 | Factual memory content |
| episode | 事件 | Episodic memory content |
| rule | 规则 | Rule-based memory content |
| decision | 决策 | Decision memory content |
| active | 活跃 | Memory currently available |
| archived | 归档 | Memory has been archived |
| superseded | 已替代 | Memory has been superseded by new content |
| trusted | 可信 | Information source is trusted |
| external | 外部 | Information source is external |
| untrusted | 不可信 | Information source is not trusted |

---

## 15. Run Types | 运行类型

| English | 中文 | 解释 |
|---------|------|------|
| task_run | 任务运行 | Standard task execution type |
| tool_call | 工具调用 | Tool call execution type |
| approval_resume | 审批恢复 | Resume execution after approval granted |
| replay | 重放 | Replay execution |

---

## 16. Compensation & Checkpoint | 补偿与检查点

| English | 中文 | 解释 |
|---------|------|------|
| compensation | 补偿 | Action to rollback, reconcile, or manually repair steps that have already occurred side effects |
| idempotent_replay | 幂等重放 | Strategy of achieving compensation through replay |
| compare_and_swap_write | 比较并交换写入 | Strategy of achieving compensation through CAS write |
| compensating_action | 补偿动作 | Strategy of achieving rollback through executing compensating actions |
| manual_reconciliation_required | 需要人工对账 | Requires manual intervention for reconciliation repair |
| checkpoint | 检查点 | State snapshot at recoverable boundary |
| resume_from_checkpoint | 从检查点恢复 | Strategy of resuming execution from checkpoint |
| replay_from_start | 从头重放 | Strategy of re-executing from workflow start |
| manual_reconciliation | 人工对账 | Strategy requiring manual intervention for repair |

---

## 17. Termination & Error | 终止与错误

| English | 中文 | 解释 |
|---------|------|------|
| reasonCode | 原因码 | Termination reason code, recorded as string |
| termination_initiator | 终止发起者 | Entity that triggered termination: user / system / policy / admin |
| termination_scope | 终止范围 | Termination impact scope: step / workflow / task / session |
| recoverable | 可恢复 | Whether recovery path is allowed after termination |
| dead-letter | 死信 | Failure pocket record that cannot be automatically recovered or should not continue retrying |

---

## 18. Task Priority & Source | 任务优先级与来源

| English | 中文 | 解释 |
|---------|------|------|
| low | 低 | Low priority |
| normal | 普通 | Normal priority |
| high | 高 | High priority |
| urgent | 紧急 | Urgent priority |
| user | 用户 | Task source: directly created by user |
| perception | 感知 | Task source: triggered by system perception |
| system | 系统 | Task source: created internally by system |

---

## 19. Isolation & Placement | 隔离与部署

| English | 中文 | 解释 |
|---------|------|------|
| standard | 标准 | Standard isolation level |
| hardened | 加固 | Hardened isolation level |
| strict | 严格 | Strict isolation level |
| local | 本地 | Worker deployed in same process |
| remote | 远程 | Worker connected via bridge |

---

## 20. Session Consistency | 会话一致性

| English | 中文 | 解释 |
|---------|------|------|
| connecting | 连接中 | Remote session is establishing connection |
| connected | 已连接 | Remote session has connected |
| reconnecting | 重连中 | Remote session is reconnecting |
| degraded | 降级 | Remote session capability degraded |
| failed | 失败 | Remote session connection failed |
| viewer_only | 仅查看 | Session in read-only observation state |
| unknown | 未知 | Consistency check status unknown |
| passed | 通过 | Consistency check passed |
| mismatch | 不匹配 | Consistency check found mismatch |
| aligned | 对齐 | Workspace state synchronized |
| conflict | 冲突 | Workspace state has conflicts |

---

## 21. Lease Audit Events | 租约审计事件

| English | 中文 | 解释 |
|---------|------|------|
| lease_granted | 租约授予 | Lease was granted |
| lease_renewed | 租约续期 | Lease was renewed |
| lease_expired | 租约过期 | Lease naturally expired |
| lease_reclaimed | 租约回收 | Lease was reclaimed by system |
| stale_write_rejected | 过期写入拒绝 | Stale write rejected due to token mismatch |
| lease_released | 租约释放 | Lease was actively released |
| lease_handover | 租约交接 | Lease was handed over to another execution entity |

---

## 22. Dispatch Rejection Reasons | 调度拒绝原因

| English | 中文 | 解释 |
|---------|------|------|
| worker_unavailable | 工作器不可用 | Worker currently unavailable |
| worker_quarantined | 工作器被隔离 | Worker is in quarantine state |
| worker_offline | 工作器离线 | Worker connection disconnected |
| worker_draining | 工作器排空中 | Worker is draining |
| worker_degraded_filtered | 工作器降级被过滤 | Degraded worker filtered |
| worker_untrusted | 工作器不可信 | Worker trust check failed |
| worker_capacity_full | 工作器容量满 | Worker at maximum capacity |
| queue_affinity_mismatch | 队列亲和性不匹配 | Queue affinity requirement not met |
| missing_capabilities | 缺少能力 | Worker missing required capabilities |
| worker_placement_mismatch | 工作器部署位置不匹配 | Local/remote deployment requirement not met |
| worker_isolation_mismatch | 工作器隔离级别不匹配 | Isolation level requirement not met |
| worker_repo_version_mismatch | 工作器版本不匹配 | Code repository version requirement not met |
| worker_remote_session_unready | 工作器远程会话未就绪 | Remote session not ready |

---

## 23. Execution Ticket Status | 执行票据状态

| English | 中文 | 解释 |
|---------|------|------|
| pending | 待认领 | Ticket waiting to be claimed |
| claimed | 已认领 | Ticket has been claimed by worker |
| consumed | 已消费 | Ticket has been used |
| cancelled | 已取消 | Ticket has been cancelled |
| expired | 已过期 | Ticket has expired |

---

## 24. Operator Actions | 操作员动作

| English | 中文 | 解释 |
|---------|------|------|
| take_over_task | 接管任务 | Operator takes over task |
| modify_input | 修改输入 | Operator modifies task input |
| retry_execution | 重试执行 | Operator triggers retry |
| skip_step | 跳过步骤 | Operator skips a step |
| set_current_step | 设置当前步骤 | Operator sets current execution step |
| switch_worker | 切换工作器 | Operator switches execution worker |
| write_step_output | 写入步骤输出 | Operator writes step output |
| complete_task | 完成任务 | Operator manually completes task |

---

## 25. Takeover Session | 接管会话

| English | 中文 | 解释 |
|---------|------|------|
| open | 开放 | Takeover session in open state |
| closed | 已关闭 | Takeover session has ended |

---

## 26. Evolution & Promotion | 演化与晋升

| English | 中文 | 解释 |
|---------|------|------|
| pending_approval | 待审批 | Proposal waiting for approval |
| approved | 已批准 | Proposal approved |
| rejected | 已拒绝 | Proposal rejected |
| applied | 已应用 | Proposal applied |
| rolled_back | 已回滚 | Proposal rolled back |
| draft | 草稿 | Draft state |
| validated | 已验证 | Validated |
| promoted | 已推广 | Promoted |
| retired | 已退役 | Retired |
| shadow | 影子运行 | Shadow mode operation |
| canary_5 | 5% 金丝雀 | 5% traffic canary release |
| partial_25 | 25% 分批 | 25% phased release |
| partial_50 | 50% 分批 | 50% phased release |
| partial_75 | 75% 分批 | 75% phased release |
| stable | 稳定 | Stable version |
| shadow_running | 影子运行中 | Shadow mode running |

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
| pending | 待确认 | Waiting for consumer acknowledgment |
| acked | 已确认 | Consumer has acknowledged |
| failed | 失败 | Acknowledgment failed |
| dead_lettered | 死信 | Moved to dead letter queue |

---

## 29. Remote Log Levels | 远程日志级别

| English | 中文 | 解释 |
|---------|------|------|
| debug | 调试 | Debug level log |
| info | 信息 | Info level log |
| warn | 警告 | Warning level log |
| error | 错误 | Error level log |

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
- **execution**: A runtime attempt

### agent vs worker
- **agent**: Leans toward responsibility and intelligent entity concept
- **worker**: Leans toward execution carrier and resource slot

### artifact vs output vs step output
- **artifact**: Leans toward file products
- **output**: Leans toward result semantics
- **step output**: Leans toward step-level structured snapshot

### queued vs blocked
- **queued**: Waiting for scheduling allocation
- **blocked**: Cannot continue due to dependencies/approval/policy/resources

### paused vs awaiting_user
- **paused**: Explicitly paused
- **awaiting_user**: Waiting for external input

### stalled vs offline
- **stalled**: Has progress but timed out
- **offline**: Connection disconnected

### failed vs cancelled
- **failed**: Execution failed and terminated
- **cancelled**: Explicitly cancelled

### done vs completed
- **done**: Task's only terminal success state
- **completed**: Workflow successfully ended state

---

## Document Info | 文档信息

- Source: `docs_zh/governance/glossary_and_terminology.md` and `src/platform/contracts/types/`
- Governance Level: 主版本（术语表主版本）
- Last Updated: 2026-04-22

---

## 33. Data & Storage | 数据与存储

| English | 中文 | 解释 |
|---------|------|------|
| Authoritative Store | 权威存储 | Storage that has final interpretation authority for a certain type of fact, the final source of truth for data, must not be confused with any cache |
| Transaction Store | 事务存储 | Storage responsible for transactional data such as tasks, status, approvals, events; in code, transactional data is stored in AuthoritativeSqlDatabase |
| Artifact Store | 产物存储 | Storage for file-based, large-volume, or export-type products, different nature from transaction store |
| Analytics Store | 分析存储 | Storage oriented toward projections and materialized views, not independent analytical reporting storage |
| Data Plane | 数据平面 | Unified data plane for transaction layer, artifact, analytics, archive, replay (currently a planning concept) |
| Namespace | 命名空间 | Logical namespace under data, artifact, or tenant boundary, different from OS path |
| Eventual Consistency | 最终一致性 | State that allows brief delay before reaching consistency, different from strong consistency guarantee |
| Reconciliation | 对账修复 | Action to reconcile and repair status, events, workers, locks, etc. |
| Migration | 迁移 | Formal version migration of schema or storage structure, different from ad-hoc SQL patch |
| Storage Backend | 存储后端 | Underlying storage abstraction supporting SQLite/PostgreSQL two drivers |
| Storage Driver | 存储驱动 | SQLite or PostgreSQL two storage engine driver types |
| Schema Migration | Schema 迁移 | Formal upgrade or downgrade process for database schema version |
| Checksum Mismatch | 校验和不匹配 | Migration version checksum failed, expected vs actual mismatch |
| Shadow SQLite | 影子 SQLite | SQLite shadow library running in parallel in PostgreSQL dual-run mode |
| Authoritative Task Store | 权威任务存储 | Phase 1a authoritative task status storage, delegated to sqlite or postgres implementation |
| Phase 1a Store | Phase 1a 存储 | Task storage abstraction for initial stable core phase |
| Read-after-write Consistency | 写后读一致性 | Guarantee that writing followed by immediate reading can retrieve the written result |
| Lease | 租约 | Temporary ownership of an execution or worker dispatch, not permanent ownership |
| Fencing Token | 隔离令牌 | Version token to prevent old executors from writing dirty results, not ordinary sequence |
| Dead-letter | 死信 | Failure pocket record that cannot be automatically recovered or should not continue retrying |
| Partial Result | 部分结果 | Task not yet fully complete, but has retainable and auditable阶段性 results |
| Checkpoint | 检查点 | State snapshot at recoverable boundary, different from any temporary variable |

---

## 34. Configuration & Version | 配置与版本

| English | 中文 | 解释 |
|---------|------|------|
| Config Bundle | 配置包 | A set of configurations that take effect together, containing levels such as bootstrap, gateways, providers, runtime, security, workflows |
| Config Version | 配置版本 | Version identifier after configuration change, used for tamper detection and cache management |
| Config Layer | 配置层级 | Vertical hierarchy of configuration, such as platform, tenant, pack, task_type |
| Feature Flag | 特性开关 | Switch for controlling capability enable/disable or gradual rollout |
| Prompt Bundle | Prompt 包 | A set of prompts that are released and versioned together |
| Config Diff | 配置差异 | Change entries between two config bundles, used for drift detection |
| Bundle Hash | 包哈希 | SHA-256 hash of entire config bundle |
| Layer Hash | 层级哈希 | Content hash of single config layer, used for change detection |
| Tamper Detection | 篡改检测 | Detecting unauthorized configuration changes through version ID comparison |
| Config Rollout | 配置发布 | Config release supporting canary strategy, can be gradually pushed in phases (5%/25%/50%/100%) |
| Canary Rollout | 金丝雀发布 | Config release strategy of first trialing at small scale then gradually expanding |
| Rollback Point | 回滚点 | Recoverable config version snapshot record |
| Config Governance Service | 配置治理服务 | Service responsible for loading, validating, and integrity checking layered config bundles |
| Sandbox Policy | 沙箱策略 | Security validation policy for file path access, preventing directory traversal attacks |
| Compatibility Window | 兼容性窗口 | Formally supported compatibility interval between different runtimes/SDKs/protocols/plugins |
| Promote Criteria | 晋升标准 | Evidence threshold for a module to be elevated from available to platform-ready/production-ready |
| Readiness Registry | 就绪注册表 | Formal registration surface for recording environment or module readiness status |
| Evidence Package | 证据包 | A set of evidence for supporting promote/signoff/production-ready judgments |
| Production-ready | 生产就绪 | Having reached the comprehensive threshold required for production support |
| Phase 1a Ready | Phase 1a 就绪 | Having reached the minimum usable threshold for Phase 1a stable core |

---

## 35. Prompt & Cache | Prompt 与缓存

| English | 中文 | 解释 |
|---------|------|------|
| Fixed Prefix | 固定前缀 | System prompt fixed prefix shared across agents, not participating in normal compaction by default |
| Domain Block | 领域块 | Reusable prompt intermediate layer for same domain/profile |
| Variable Suffix | 变量后缀 | Prompt suffix that dynamically changes by task, role, plan, memory |
| KV Cache Fixed Prefix | KV 缓存固定前缀 | Prefill cache reuse mechanism based on same prefix hash |

---

## 36. Storage Operations | 存储运行机制

| English | 中文 | 解释 |
|---------|------|------|
| Migration Runner | 迁移运行器 | State management service responsible for executing storage backend schema upgrades |
| Schema Status | Schema 状态 | Comparison status between current version and expected version |
| Pending Versions | 待执行版本 | List of migration versions not yet applied |
| Up-to-date | 最新版本 | Current storage schema has completed all migrations |
| Dual Run | 双跑模式 | Mode where production PostgreSQL must run SQLite shadow library in parallel |

---

## 37. Security & Governance | 安全与治理

| English | 中文 | 解释 |
|---------|------|------|
| Policy Engine | 策略引擎 | Code-level entry point for final adjudication of permissions, risk, approval, budget, and runtime constraints, unified security decision center |
| HITL (Human In The Loop) | 人工介入 | Decision step requiring explicit human participation; high-risk operations must go through human approval to continue |
| Approval | 人工审批 | Decision node in workflow that requires explicit human confirmation to continue |
| Break-Glass | 紧急放行 | High-risk emergency release configuration tag; critical risk triggers break-glass approval type, used for emergency bypass of standard process |
| Sandbox | 沙箱 | Execution isolation boundary, limiting untrusted code or operations to run in a controlled environment |
| Exec Policy | 执行策略 | Rule set for tool/command execution, defining which operations are allowed or prohibited |
| Permission | 权限 | Authorization state where a subject can see or use a capability, implicitly implemented through PolicyEngine |
| Secret | 密钥/凭证 | Sensitive credential information such as keys, tokens, credentials, including API Key, OAuth Token, database password, etc. |
| Secret Masking | 密钥脱敏 | Method of masking sensitive credential information in logs and displays, preventing credential leakage |
| Data Classification | 数据分级 | Data sensitivity classification rules, including public/internal/confidential/restricted four levels |
| Audit Evidence | 审计证据 | Traceable, verifiable, not easily repudiated behavioral evidence, used for compliance and liability determination |
| Field Encryption | 字段加密 | Encryption protection for specific fields, ensuring sensitive data security in storage and transmission |
| Network Egress Policy | 出站网络策略 | Policy controlling and auditing network requests initiated from the system to external networks |
| Outbound URL Policy | 出站URL策略 | Rules for filtering and restricting target URLs for external HTTP requests |
| Kill Switch | 熔断开关 | Switch for comprehensively disabling system functions in emergencies; once activated, all operations will be rejected |
| Budget Guard | 预算防护 | Mechanism for monitoring and controlling task execution costs, preventing budget overruns |
| Risk Category | 风险类别 | Risk types evaluated by PolicyEngine, including destructive/irreversible/prod_affecting, etc. |
| PII (Personally Identifiable Information) | 个人身份信息 | Personally identifiable information such as email, phone, SSN, credit card number, etc. |
| Secret Lease | 密钥租约 | Time-limited access authorization for keys, controlling key validity period and usage scope |
| Secret Rotation | 密钥轮换 | Operational practice of regularly updating keys to reduce leakage risk |
| CVE Intelligence | CVE情报 | Known security vulnerability intelligence service, tracking and evaluating the degree of system impact from vulnerabilities |
| Policy Decision Request | 策略决策请求 | Policy evaluation request containing context such as task ID, subject ID, action, risk category |
| Policy Decision Result | 策略决策结果 | Decision result returned by policy engine, including allow/deny/escalate_for_approval |
| Data Classification Level | 数据分级级别 | Including public/internal/confidential/restricted four sensitivity levels |
| Data Handling Dimension | 数据处理维度 | Scenario dimension of data flow, including prompt/logs/memory/artifact/cross_worker/debug |
| Handling Decision | 处理决策 | Allow/deny/mask/audit decision made based on data classification and handling dimension |
| PII Detection | PII检测 | Using regex patterns to identify personally identifiable information in content |
| PII Annotation | PII标注 | Marking detected PII locations and masking forms in content |
| Secret Management Service | 密钥管理服务 | Unified service for managing all key lifecycle, rotation, and access |
| Managed Secret Provider | 托管密钥提供者 | Provider that obtains keys from Vault/KMS/Secret Manager |
| Env Secret Provider | 环境变量密钥提供者 | Provider that reads keys from environment variables |
| External Secret Provider | 外部密钥提供者 | Provider that obtains keys from external key management system |
| Audit Integrity | 审计完整性 | Integrity protection mechanism ensuring audit records are not tampered with |
| Network Egress Audit | 出站网络审计 | Audit mechanism for recording and reviewing all external network requests |
| Trusted Context Scanner | 可信上下文扫描器 | Component for scanning and verifying trusted context configuration |
| File Freshness | 文件新鲜度 | Mechanism for checking if files are expired or need updating |
| CVE Intelligence Service | CVE情报服务 | Intelligence service for tracking and evaluating known security vulnerability impact |
| Approval Service | 审批服务 | Service for processing human approval requests and decisions |
| Approval Request | 审批请求 | Approval task sent to human approvers |
| Approval Decision | 审批决策 | Approval or rejection decision made by approver |
| Idempotent | 幂等性 | Characteristic of consistent results when the same operation is executed multiple times |

---

## 38. Testing & Stabilization | 测试与稳定化

| English | 中文 | 解释 |
|---------|------|------|
| Stable Core | 稳定核心 | Minimum capability scope deliberately shrunk to first achieve stable operation, ensuring core functions are reliable |
| Golden Task | 黄金任务 | Fixed representative task used as version regression baseline, for verifying that system basic functions have not degraded |
| Fixture | 测试固件 | Pre-configured fixed input/output samples for stable testing and VCR playback |
| VCR (Video Cassette Recorder) | VCR录制回放 | Testing mechanism for recording/playback of external LLM calls, achieving deterministic testing |
| Unit Test | 单元测试 | Fine-grained testing oriented to single functions, modules, or objects |
| Integration Test | 集成测试 | Testing of cross-module collaboration, verifying interaction correctness between multiple components |
| E2E (End-to-End) | 端到端测试 | Complete flow testing from entry to result, covering the entire system chain |
| Chaos Test | 混沌测试 | Testing that actively injects faults to verify recovery and resilience, such as injecting network latency, service downtime |
| Soak Test | 浸泡测试 | Long-duration continuous operation stability testing, verifying system behavior under long-term load |
| Recovery Drill | 恢复演练 | Recovery capability drills for scenarios such as crashes, disconnections, lock conflicts, restarts |
| Chaos Smoke | 混沌冒烟测试 | Quick end-to-end test that verifies fault detection and repair capabilities at system startup |
| Admission Control | 准入控制 | Protection mechanism for the system to admit, delay, or degrade before overload |
| Readiness | 就绪度 | Whether a stage, module, or environment has reached readiness for the next action |
| Stable Validation | 稳定验证 | Validation process of running golden tasks and checking database integrity and backup round-trip |
| Stable Gate | 稳定门禁 | Quality threshold that must be passed for environment to upgrade to next stage |
| Golden Task Inventory | 黄金任务清单 | Set of task categories that must be covered, including coding/research/content/data, etc. |
| VCR Replay Mode | VCR回放模式 | Including fixture_only/vcr_replay/vcr_record three modes, controlling whether actual calls are allowed |
| Drift Detection | 漂移检测 | Comparing current running results with baseline to detect performance or behavior anomalies |
| Regression Detection | 回归检测 | Testing method for discovering new code causing existing functionality degradation |
| Stable Runtime Validator | 运行时稳定验证器 | Core module that runs golden tasks and checks database integrity and backup validity |
| Stable Acceptance Line | 稳定验收线 | Quality standard line that must be reached for environment to be promoted to production-ready state |
| Stable Release Gate | 发布门禁 | Stability and quality checks that must be passed before version release |
| Stable Release Package | 稳定发布包 | Verified version product that can be used for formal deployment |
| Stable Evidence Campaign | 证据收集活动 | Set of evidence packages collected to support promote/signoff judgments |
| Stable Evidence Bundle | 证据包 | Evidence collection containing test results, baseline comparison, regression analysis, etc. to support release decisions |
| Stable Evidence Sequence | 证据序列 | Stability evidence records organized in chronological order |
| Stable Migration Compatibility Rehearsal | 迁移兼容性演练 | Rehearsal for verifying system migration compatibility between different versions |
| Stable Gray Release Rehearsal | 灰度发布演练 | Rehearsal for verifying reliability of gray release mechanism |
| Stable Rolling Upgrade Rehearsal | 滚动升级演练 | Rehearsal for verifying reliability of rolling upgrade process |
| Stable Concurrency Rehearsal | 并发演练 | Rehearsal for verifying system stable operation capability under concurrent load |
| Stable Backup Restore Rehearsal | 备份恢复演练 | Rehearsal for verifying data backup and restore process reliability |
| Stable DB Queue Disconnect Rehearsal | 数据库队列断连演练 | Rehearsal for verifying system behavior when database and queue connection is interrupted |
| Stable DB Writability Rehearsal | 数据库写入演练 | Rehearsal for verifying database writability can be recovered in fault scenarios |
| Stable Dispatch Rehearsal | 调度演练 | Rehearsal for verifying task scheduling mechanism works correctly under abnormal conditions |
| Stable Dispatch Reconciliation Rehearsal | 调度对账演练 | Rehearsal for verifying state consistency between scheduling layer and execution layer |
| Stable Event Replay Rehearsal | 事件重放演练 | Rehearsal for verifying event replay mechanism reliability |
| Stable Lease Rehearsal | 租约演练 | Rehearsal for verifying task lease mechanism correctly releases and renews in fault scenarios |
| Stable Queue Delivery Rehearsal | 队列投递演练 | Rehearsal for verifying message queue delivery reliability |
| Stable Runtime Soak Runner | 运行时浸泡运行器 | Runner for long-duration continuous testing to verify stability |
| Stable Worker Handshake Rehearsal | Worker握手演练 | Rehearsal for verifying Worker registration and heartbeat mechanism reliability |
| Stable Worker Writeback Rehearsal | Worker回写演练 | Rehearsal for verifying Worker result writeback mechanism reliability |
| Stable Cross-Division Recovery Drill | 跨部门恢复演练 | Disaster recovery drill for cross-division collaboration scenarios |
| Stable Maintenance Rehearsal | 维护演练 | Rehearsal for availability guarantee capability during system maintenance |
| Prompt Injection Guard | 提示词注入防护 | Protection mechanism for detecting and blocking malicious prompt injection attacks |
| Prompt Injection Red Team | 提示词注入红队 | Security testing team for prompt injection attacks |
| Environment Readiness | 环境就绪度 | Conditions that must be met for environment to be ready for production use |
| Environment Promotion | 环境晋升 | Process of environment upgrading from current stage to next stage |
| Drill Type | 演练类型 | Including backup_restore/rolling_upgrade/maintenance_drain/tenant_gray_rollout/regional_failover/worker_reassignment/queue_repair, etc. |
| Golden Task Latency Band | 黄金任务延迟带 | Expected latency range for tasks, including interactive/extended |
| Golden Task Case | 黄金任务用例 | Specific golden task definition, containing request, metadata, expected result |
| Golden Task Run Result | 黄金任务运行结果 | Actual result and pass status after golden task execution |
| Golden Task Class | 黄金任务类别 | Task types that must be covered, including coding/research/content/data/cross_division/high_risk_approval/crash_recovery |
| VCR Replay Fixture | VCR回放固件 | Recorded request/response pairs saved for test playback |
| VCR Request Fingerprint | VCR请求指纹 | SHA-256 hash of request, used for uniquely identifying recording |

---

## 39. Abbreviations | 缩写词

| English | 中文 | 解释 |
|---------|------|------|
| ADR | 架构决策记录 | Architecture Decision Record, recording important architectural decisions |
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
| OIDC | OpenID连接 | OpenID Connect, for identity authentication federation |
| SSO | 单点登录 | Single Sign-On |
| SCIM | 用户身份同步 | System for Cross-domain Identity Management |
| RLS | 行级安全 | Row-Level Security |
| SBOM | 软件物料清单 | Software Bill of Materials |
| RCA | 根因分析 | Root Cause Analysis |
| VCR | 录像回放 | Video Cassette Recorder, referring to test recording playback |
| IAM | 身份与访问管理 | Identity and Access Management |
| SLA | 服务等级协议 | Service Level Agreement |
| SLO | 服务目标 | Service Level Objective |
| SLI | 服务等级指标 | Service Level Indicator |

---

## 40. Protocol, Model & Security Abbreviations | 协议、模型与安全缩写

| English | 中文 | 解释 |
|---------|------|------|
| ADR | 架构决策记录 | Architecture Decision Record, architectural design decision document |
| API | 应用编程接口 | Application Programming Interface, external or inter-module interface surface |
| SDK | 软件开发工具包 | Software Development Kit, derived from authoritative schema |
| DSL | 领域专用语言 | Domain-Specific Language, such as workflow DSL |
| DDL | 数据定义语言 | Data Definition Language, table/index/constraint migration statements |
| WAL | 预写日志 | Write-Ahead Logging, SQLite/database persistence mechanism |
| MCP | 模型上下文协议 | Model Context Protocol, external capability access protocol |
| HITL | 人工介入 | Human In The Loop, decision环节 requiring human participation |
| PII | 个人身份信息 | Personally Identifiable Information, requires masking |
| TTL | 存活时间 | Time To Live, validity duration for data or cache |
| DLQ | 死信队列 | Dead Letter Queue, receiving messages or tasks that cannot continue processing |
| HA | 高可用 | High Availability, system continuous availability guarantee |
| DR | 容灾恢复 | Disaster Recovery, business recovery capability in disaster scenarios |
| OIDC | 开放身份连接 | OpenID Connect, for identity authentication federation |
| SSO | 单点登录 | Single Sign-On, single authentication for entire chain access |
| SCIM | 身份同步协议 | System for Cross-domain Identity Management, user and organization identity synchronization |
| RLS | 行级安全 | Row-Level Security, data access layer row-level isolation |
| SBOM | 软件物料清单 | Software Bill of Materials, dependency component list |
| RBAC | 基于角色的访问控制 | Role-Based Access Control, permission management model |
| PKCE | 代码交换证明 | Proof Key for Code Exchange, OAuth extension security mechanism |

---

## 41. Integration & Communication Abbreviations | 集成与通信缩写

| English | 中文 | 解释 |
|---------|------|------|
| RPC | 远程过程调用 | Remote Procedure Call, inter-service communication pattern |
| REST | 表述性状态转移 | Representational State Transfer, Web API style |
| GraphQL | 图查询语言 | Graph Query Language, API query language |
| OAuth | 开放授权 | Open Authorization, third-party authorization protocol |
| Webhook | Web 回调 | Web callback, event-driven notification mechanism |
| SSE | 服务器推送事件 | Server-Sent Events, client receiving server push |
| TCP | 传输控制协议 | Transmission Control Protocol, reliable connection transmission |
| UDP | 用户数据报协议 | User Datagram Protocol, connectionless transmission |
| HTTP | 超文本传输协议 | HyperText Transfer Protocol, Web communication |
| HTTPS | 安全超文本传输协议 | HTTP Secure, TLS encrypted transmission |
| DNS | 域名系统 | Domain Name System, domain name resolution |
| CDN | 内容分发网络 | Content Delivery Network, static resource acceleration |
| QoS | 服务质量 | Quality of Service, network performance guarantee |

---

## 42. Code-Level Variable Abbreviations | 代码级别变量缩写

| English | 中文 | 解释 |
|---------|------|------|
| id | 标识符 | identifier, unique identifier for object |
| uid | 用户标识 | user identifier, user identity number |
| pid | 进程标识 | process identifier, operating system process number |
| tid | 线程标识 | thread identifier, operating system thread number |
| sid | 会话标识 | session identifier, unique identifier for an interaction session |
| eid | 执行标识 | execution identifier, execution instance number |
| cid | 关联标识 | correlation identifier, cross-module correlation number |
| ts | 时间戳 | timestamp, recorded time |
| ctx | 上下文 | context, execution environment information transfer |
| cfg | 配置 | config/configuration, runtime parameters |
| opts | 选项 | options, optional parameters |
| args | 参数 | arguments, function/command input |
| env | 环境 | environment, runtime environment variables |
| db | 数据库 | database, persistent storage |
| sql | 查询语言 | structured query language |
| url | 资源定位符 | uniform resource locator |
| uri | 资源标识符 | uniform resource identifier |
| ip | 网络地址 | internet protocol address |
| err | 错误 | error, exception or failure state |
| res | 响应 | response, return result |
| req | 请求 | request, input/call |
| resp | 响应 | response, returned data |
| msg | 消息 | message, communication unit |
| evt | 事件 | event, status change notification |
| svc | 服务 | service, business capability unit |
| repo | 仓库 | repository, code or data storage |
| auth | 认证 | authentication, identity verification |
| authz | 授权 | authorization, permission verification |
| prop | 属性 | property, object property |
| val | 值 | value, property value |
| idx | 索引 | index, array position or database index |
| len | 长度 | length, quantity or size |
| max | 最大值 | maximum, upper limit |
| min | 最小值 | minimum, lower limit |
| prev | 上一个 | previous, previous state |
| curr | 当前 | current, current state |
| next | 下一个 | next, next state |
| init | 初始化 | initialize, initialization operation |
| def | 默认 | default, default value |
| tmp | 临时 | temporary, temporary variable |
| src | 源 | source, source |
| dest | 目标 | destination, destination location |

---

## 43. Operations & Business Abbreviations | 运维与业务缩写

| English | 中文 | 解释 |
|---------|------|------|
| SLA | 服务等级协议 | Service Level Agreement, externally committed agreement |
| SLO | 服务等级目标 | Service Level Objective, expected achievement target |
| SLI | 服务等级指标 | Service Level Indicator, actual measured indicator |
| KPI | 关键绩效指标 | Key Performance Indicator, business measurement indicator |
| OKR | 目标与关键成果 | Objectives and Key Results, goal management framework |
| PMF | 产品-市场匹配 | Product-Market Fit, product market fit |
| ROI | 投资回报率 | Return on Investment, investment return ratio |
| MTTR | 平均恢复时间 | Mean Time To Recovery, average failure recovery time |
| MTBF | 平均故障间隔 | Mean Time Between Failures, average fault-free runtime |
| RCA | 根因分析 | Root Cause Analysis, incident analysis process |
| RTO | 恢复时间目标 | Recovery Time Objective, failure recovery time target |
| RPO | 数据回退点目标 | Recovery Point Objective, acceptable data loss window |

---

## 44. Testing Abbreviations | 测试缩写

| English | 中文 | 解释 |
|---------|------|------|
| E2E | 端到端 | End-to-End, complete testing or process from entry to result |
| UT | 单元测试 | Unit Test, single function/module testing |
| IT | 集成测试 | Integration Test, cross-module collaboration testing |
| VCR | 测试录制回放 | Video Cassette Recorder, external call recording/playback mechanism |

---

*This document is a read-only governance reference; in case of terminology conflicts, the corresponding authoritative contract takes precedence.*

---

## 45. Organization & Control Plane Roles | 组织与控制层角色

| English | 中文 | 解释 |
|---------|------|------|
| `strategic_governor` | 战略总督 | Control plane role for strategic judgment, escalation governance, organizational-level approval (documented definition, not implemented as independent service in code) |
| `intake_router` | 摄取路由器 | Control plane role for input triage, classification, routing, budget entry |
| `workflow_planner` | 工作流规划器 | Control plane role for cross-division splitting, dependency graph, aggregation, failure escalation |
| `division_lead` | 部门主管 | Control plane role for in-division workflow autonomous orchestration (documented definition, not implemented as independent service in code) |
| `division` | 事业部 | Business capability domain or division boundary, should not be confused with `tenant` |
| `role` | 角色 | Responsibility definition, not a runtime instance |
| `agent` | 智能体 | Intelligent execution entity that assumes role responsibilities, should not be confused with `worker` |
| `organization` | 组织 | Enterprise/organizational boundary |
| `workspace` | 工作空间 | Workspace boundary under an organization, should not be confused with `session` |
| `tenant` | 租户 | Primary boundary for isolation, security, quota, and billing |

---

## 46. Channel & Extension | 渠道与扩展

| English | 中文 | 解释 |
|---------|------|------|
| `channel` | 渠道 | User or system interface, such as CLI, Web, Telegram, API (Note: only telegram/slack/webhook implemented in code) |
| `channel capability` | 渠道能力 | Capabilities supported by a channel, such as text, button, stream, attachment (Note: no corresponding capability enum type definition exists in code) |
| `plugin` | 插件 | Installable unit that extends platform capabilities through public SDK or controlled boundaries |
| `skill` | 技能 | Reusable orchestration capability for tools or steps |
| `MCP` | 模型上下文协议 | One of the external capability access protocols/extension types (MCP tools validated via mcp-tool-guard) |
| `recipe` | 配方 | Structured workflow or template definition, usable as workflow author input layer |
| `template` | 模板 | Similar to recipe, structured workflow or step definition, reusable |
| `provider` | 提供方 | LLM or model capability provider |
| `model` | 模型 | Specific model instance provided by provider |
| `model profile` | 模型画像 | Metadata for a model's capabilities, limitations, pricing, default parameters, etc. |

---

## 47. Domain & Plugin Registry | 领域与插件注册

| English | 中文 | 解释 |
|---------|------|------|
| `domain` | 领域 | Definition of business capability domain, containing workflows, toolBundles, outputContracts, etc. |
| `domain model` | 领域模型 | Structure definition containing StepTemplateConfig, WorkflowConfig, ToolBundleConfig, etc. |
| `plugin binding` | 插件绑定 | Association configuration between domain and plugin, defining pluginId, pluginType, priority, etc. |
| `PluginSpiType` | 插件SPI类型 | Including retriever, validator, planner, presenter, adapter five types |
| `PluginLifecycleState` | 插件生命周期状态 | Including registered, loaded, active, inactive, unloaded, degraded, disabled |
| `ExternalAdapterPlugin` | 外部适配器插件 | Plugin type for connecting external systems (github, jira, notion, figma, etc.) |
| `PluginRuntimeIsolation` | 插件运行时隔离级别 | Including shared_process, serialized_in_process, forked_process, sandboxed_process, containerized_process |
| `PluginSandboxPolicy` | 插件沙箱策略 | Security configuration such as timeoutMs, allowFilesystemWrite, allowNetworkEgress, etc. |

---

## 48. Confusable Term Pairs with Distinctions | 易混淆术语对详解

### permission vs policy | 权限 vs 策略
- **permission（权限）**: Authorization result or static capability boundary. Permission concept in code is implicitly implemented through PolicyEngine, no independent Permission type definition exists.
- **policy（策略）**: Adjudication logic and rule system, code-level entry point for final adjudication of permissions, risk, approval, budget, and runtime constraints.
- **Distinction**: Descriptive limitations in prompts should not be treated as formal policy.

### queue vs lease | 队列 vs 租赁
- **queue（队列）**: Task queuing mechanism that determines waiting order.
- **lease（租赁）**: Temporary ownership of an execution or worker dispatch, used to prevent duplicate execution, determining current execution rights.
- **Distinction**: When both exist, they should not replace each other.

### readiness vs production-ready | 就绪度 vs 生产就绪
- **readiness（就绪度）**: Indicates reaching a gate or readiness for the next action.
- **production-ready（生产就绪）**: Indicates reaching the comprehensive threshold required for production support.
- **Distinction**: `Phase 1a ready` must not be misinterpreted as `production-ready`.

### signoff vs completion gate | 签过 vs 完成门
- **signoff（签过）**: Review conclusion for the current revision.
- **completion gate（完成门）**: Threshold check that must be re-executed before entering coding.
- **Distinction**: A single signoff conclusion should not be treated as a permanent pass.

### provider vs model | 提供方 vs 模型
- **provider（提供方）**: Service provider, such as OpenAI, Anthropic.
- **model（模型）**: Specific model instance provided by provider, such as GPT-4, Claude-3.
- **Distinction**: `model profile` is model metadata, not equal to provider profile.

### artifact vs output vs step output | 产物 vs 输出 vs 步骤输出
- **artifact（产物）**: File or binary product, typically managed through artifact store.
- **output（输出）**: Result oriented to upstream steps or users, may be structured data or text, not necessarily a file.
- **step output（步骤输出）**: Structured result snapshot after a step completes.

### task vs session | 任务 vs 会话
- **task（任务）**: Business work unit, the smallest work commitment object the system presents to users and business.
- **session（会话）**: Channel interaction session, carrying user input, streaming output, and interaction context.
- **Distinction**: One session may trigger multiple tasks; one task may also update state across multiple sessions.

### workflow vs execution | 工作流 vs 执行
- **workflow（工作流）**: Structured execution path definition for a task.
- **execution（执行）**: A runtime attempt.
- **Distinction**: The same workflow may have multiple execution attempts.

### agent vs worker | 智能体 vs 工作器
- **agent（智能体）**: Leans toward responsibility and intelligent entity concept.
- **worker（工作器）**: Leans toward execution carrier and resource slot.
- **Distinction**: `sub-agent` is not a synonym for remote worker.

---

## 49. Five-Plane Architecture | 五平面架构

| English | 中文 | 解释 |
|---------|------|------|
| P1 Interface Plane | P1 接口平面 | External ingress layer: API Gateway / Webhook / Scheduler / Console / Ingress, responsible for input validation, identity authentication, rate limiting, routing |
| P2 Control Plane | P2 控制平面 | Control and governance layer: Policy / Approval / Rollout / Incident / Config, responsible for definition and version governance, approval control, risk guard, release control |
| P3 Orchestration Plane | P3 编排平面 | Orchestration and decision layer: OAPEFLIR Loop / Planner / Routing / Escalation, responsible for deciding what to do, who executes next, when to pause and transfer to human |
| P4 Execution Plane | P4 执行平面 | Unified execution layer: Dispatcher / Workers / Tools / Plugins / Recovery, responsible for actually executing actions, maintaining leases, writing results, triggering recovery |
| P5 State & Evidence Plane | P5 状态与证据平面 | State and evidence plane: Truth / Events / Artifacts / Memory / Knowledge / Audit / Projections, responsible for preserving control truth, historical traces, recovery support, audit evidence |
| X1 Reliability Fabric | X1 可靠性织网 | Cross-plane cross-cutting life support system: AuthN/Z / Sandbox / Circuit Breaker / DLQ / Backpressure, injected into each plane as middleware |
| RequestEnvelope | 请求信封 | Standard request envelope from P1 → P2, containing requestId / tenantId / taskSpec / priority / traceContext / principal |
| ControlDirective | 控制指令 | Control directive from P2 → P3/P4, used for mode switching, pausing, termination, rollback, quota adjustment |
| ExecutionPlan | 执行计划 | Standard execution plan from P3 → P4, describing ordered steps and resource constraints |
| ExecutionReceipt | 执行回执 | Execution result return from P4 → P3/P5, containing status / duration / artifacts / telemetry / sideEffects / error |
| StateCommand | 状态命令 | State write instruction from P3/P4 → P5, based on CAS to ensure idempotency |
| EvidenceRecord | 证据记录 | Asynchronous decision evidence write from P3 → P5 |
| ProjectionUpdate | 投影更新 | Projection change event notification from P5 → P2 |

---

## 50. OAPEFLIR Stage Types | OAPEFLIR 阶段类型

| English | 中文 | 解释 |
|---------|------|------|
| OapeflirStage | OAPEFLIR 阶段枚举 | Eight-stage closed-loop status enum: `observe / assess / plan / execute / feedback / learn / improve / release / knowledge_promotion` |
| OapeflirStageStatus | OAPEFLIR 阶段状态 | Stage execution status: `completed / skipped` |
| OapeflirStageRecord | 阶段记录 | Records single stage execution status, duration, reference ID, and reason code |
| OapeflirStageTimelineBuilder | 阶段时间线构建器 | Tool class for building OAPEFLIR each stage execution timeline |
| OapeflirLoopInput | OAPEFLIR 循环输入 | Contains taskId / objective / workflow / feedbackSignals / blockerSummaries / fileRefs / stepOutputs |
| OapeflirLoopResult | OAPEFLIR 循环结果 | Contains observation / assessment / plan / stepOutputs / feedback / learningSignals / learningObjects / rolloutRecord / timeline / outcome / qualityGate / replanDecision |
| OapeflirLoopService | OAPEFLIR 循环服务 | Main service class for OAPEFLIR closed loop, coordinating each stage execution |
| ExecuteBridge | 执行桥接 | Conversion interface from execution plan to dual-channel step output |
| RuntimeExecuteBridge | 运行时执行桥接 | Database-based implementation |
| MockExecuteBridge | 模拟执行桥接 | Mock implementation for testing |

---

## 51. OAPEFLIR Status Enums | OAPEFLIR 状态枚举

| English | 中文 | 解释 |
|---------|------|------|
| promotion_status | 推广状态 | LearningObject lifecycle status: `draft / validated / promoted / retired` |
| candidate_status | 候选状态 | ImprovementCandidate status: `proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| rollout_status | 发布状态 | RolloutRecord status: `draft / pending_approval / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable / rejected / rolled_back / paused` |
| rollout_level | 发布级别 | Release gray-level: `off / suggest / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable` |
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
| TaskPhase | 任务阶段 | Current task phase: `intake / planning / executing / reviewing / completed` |

---

## 52. Execution Assessment Types | 执行评估类型

| English | 中文 | 解释 |
|---------|------|------|
| ExecutionAssessment | 执行评估 | Complete post-plan execution assessment, containing result classification, quality score, deviation analysis, replan suggestions |
| ExecutionOutcome | 执行结果 | Execution result type: `completed / completed_with_deviations / repairable / failed / escalated` |
| ExecutionDeviation | 执行偏差 | Workflow deviation during execution: `skipped / reordered / modified / added / substituted` |
| ExecutionError | 执行错误 | Error encountered during execution, containing step ID, error code, message, severity, and recoverability |
| CriterionResult | 标准结果 | Success criteria evaluation result, containing pass/fail, actual value, and failure reason |

---

## 53. Recovery & Fault Tolerance | 恢复与容错

| English | 中文 | 解释 |
|---------|------|------|
| runtime repair | 运行时修复 | Mechanism for automatically repairing execution on fault |
| replay | 重放 | Re-execute from known good state |
| recovery playbook | 恢复手册 | Standardized recovery steps for specific failure patterns |
| lease reclaim | 租约回收 | Reclaim execution rights from timed-out workers |
| stalled detection | 停滞检测 | Detect executions with long no-effective-progress |
| auto-rollback | 自动回滚 | Automatically rollback to previous version on release failure |
| guardrail | 护栏 | Mechanism protecting production environment from improper changes |
| canary | 金丝雀发布 | First validate new version with small traffic, then expand |
| circuit breaker | 断路器 | Protection mechanism that temporarily blocks calls when failure rate is too high |

---

*This document is a read-only governance reference; in case of terminology conflicts, the corresponding authoritative contract takes precedence.*
