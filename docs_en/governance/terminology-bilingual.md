# Terminology Bilingual Glossary | 术语对照table

## Overview | 概述

This document provides a comprehensive Chinese-English bilingual reference for all core terms used in the Automatic Agent Platform. Terms are organized by domain area.

本文档为自动代理平台的全部核心术语提供中文-英文对照参考，按领域分class组织。

---

## 1. Core Objects | 核心对象

| English | 中文 | 解释 |
|---------|------|------|
| task | 任务 | user级工作单元，is系统面向user和业务的最小工作承诺对象 |
| workflow | 工作流 | task 的结构化执lines路径，defines step、relies on、输入输出和failed路径 |
| step | 步骤 | workflow 中的单个执lines步骤 |
| execution | 执lines实例 | 某个 task/workflow 的一iterations具体运lines尝试 |
| attempt | 重试计数 | 对同一 execution 或 step 的重试计数/重入序号 |
| session | 会话 | 渠道交互会话，承载user输入、流式输出和交互上下文 |
| message | 消息 | 一iterations完整消息对象，可contains多个 message part |
| message part | 消息片段 | 消息内部的结构化片段，如文本、tool_use、tool_result、summary |
| artifact | 产物/制品 | 文件型或二进制产物，通常via artifact store manage |
| output | 输出 | 面向上游步骤或user的结果，可为结构化data或文本，不必is文件 |
| step output | 步骤输出 | 某个 step 完成后的结构化结果快照 |
| result envelope | 结果信封 | 对success、部分success、failed、warning、artifact 和 metrics 的统一结果封装 |

---

## 2. OAPEFLIR Terms | OAPEFLIR 术语

| English | 中文 | 解释 |
|---------|------|------|
| OAPEFLIR | OAPEFLIR | Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release 八阶段闭环 |
| stage | 阶段 | OAPEFLIR 闭环中的阶段级Status单元 |
| loop iteration | 闭环迭代 | 一iterations完整或部分闭环迭代的执lines轮iterations |
| TaskSituation | 任务态势 | Observe 输出的事实快照 |
| UnifiedAssessment | 统一评估 | Assess 输出的结构化判断 |
| Plan | 执lines计划 | Plan Hub 的显式执lines计划 |
| FeedbackSignal | 反馈信号 | Execute 之后收集到的结构化反馈信号 |
| LearningObject | 学习对象 | Learn Hub 产出的可复用学习对象 |
| ImprovementCandidate | 改进候选 | Improve Hub 产出的改进候选 |
| RolloutRecord | 发布record | Release 阶段的受控释放record |

---

## 3. Execution & Recovery | 执linesvs恢复

| English | 中文 | 解释 |
|---------|------|------|
| runtime | 运lines时 | 系统实际执lines task / workflow / agent / tool 的运lines层 |
| execution ticket | 执lines票据 | 调度层下发给执lines层的正式执lines单据 |
| lease | 租约 | 某iterations execution 或 worker dispatch 的临时所有权 |
| lease owner | 租约持有者 | 当前持有执lines权的执lines实体 |
| fencing token | 隔离令牌 | 防止旧执lines者回写脏结果的版本令牌 |
| dispatch | 调度分发 | 将任务或执lines权分配到某个执lines承载体 |
| worker | 工作器 | 执lines承载单元，可为本地或远程 |
| sub-agent | 子代理 | 在同一任务上下文中协作的iterations级智能执lines单元 |
| heartbeat | 心跳 | cycle性健康/负载上报 |
| stalled | 停滞 | 进程未必死亡，但在规定time内no有效进展 |
| dead-letter | 死信 | no法自动恢复或不应继续重试的failed落袋record |
| checkpoint | 检查点 | 可恢复边界上的Status快照 |
| partial result | 部分结果 | 任务尚未整体完成，但已有可保留、可审计的阶段性结果 |
| compensation | 补偿 | 对已发生副作用的步骤进lines回滚、对账或人工修复的动作 |

---

## 4. Task Status | 任务Status

| English | 中文 | 解释 |
|---------|------|------|
| queued | 排队中 | Task pre-execution state，已创建但尚未进入调度 |
| pending | 待handle | Task pre-execution state，已创建但尚未进入调度 |
| in_progress | 进lines中 | 正在推进主逻辑（Task Status） |
| awaiting_decision | 等待Decision | Task waiting for approval，等待审批Decision |
| done | completed | Task terminal state，Task success结束 |
| failed | failed | 执linesfailed且当前尝试终止 |
| cancelled | 已取消 | 被显式终止，不再继续 |

---

## 5. Workflow Status | 工作流Status

| English | 中文 | 解释 |
|---------|------|------|
| running | 运lines中 | Workflow 正在推进主逻辑 |
| paused | 已暂停 | 被显式暂停，可恢复 |
| resuming | 恢复中 | Workflow transition state for resuming from pause，从暂停恢复的过渡Status |
| completed | completed | Workflow success结束 |
| failed | failed | Workflow 执linesfailed |
| cancelling | 取消中 | Workflow transient state before cancelled，终止前的过渡Status |
| cancelled | 已取消 | 被显式终止，不再继续 |

---

## 6. Execution Status | 执lines实例Status

| English | 中文 | 解释 |
|---------|------|------|
| created | 已创建 | Execution created state，Execution 已创建 |
| prechecking | 预校验中 | Execution pre-validation phase，执lines前校验阶段 |
| executing | 执lines中 | 正在推进主逻辑（Execution Status） |
| blocked | 阻塞 | 因relies on未满足、审批、策略或资源原因暂时no法继续 |
| succeeded | success | Execution success完成 |
| failed | failed | Execution 执linesfailed |
| cancelled | 已取消 | 被显式终止，不再继续 |
| superseded | 已替代 | Execution replaced by newer execution，被新 Execution 替代 |

---

## 7. Session Status | 会话Status

| English | 中文 | 解释 |
|---------|------|------|
| open | 开放 | Session open state，会话occurrences于开放Status |
| streaming | 流式输出中 | Session streaming state，会话流式输出中 |
| awaiting_user | 等待user | 等待人class或外部系统输入（Session Status） |
| paused | 已暂停 | Session paused，会话被暂停 |
| completed | completed | Session completed，会话success结束 |
| failed | failed | Session failed，会话failed |
| cancelled | 已取消 | Session cancelled，会话被终止 |

---

## 8. Approval Status | 审批Status

| English | 中文 | 解释 |
|---------|------|------|
| requested | 已request | Approval requested，等待人classDecision |
| approved | 已批准 | Approval granted，审批via |
| rejected | 已拒绝 | Approval denied，审批未via |
| expired | 已过期 | Approval timeout，审批timeout |
| cancelled | 已取消 | Approval cancelled，审批被撤销 |

---

## 9. Worker & Dispatch | 工作器vs调度

| English | 中文 | 解释 |
|---------|------|------|
| worker | 工作器 | 执lines承载单元，可为本地或远程 |
| agent | 智能体 | 承担角色职责的智能执lines实体 |
| coordinator | 协调器 | manage任务在 worker 之间分发的调度协调服务 |
| idle | 空闲 | Worker 可accepts新任务 |
| busy | 忙碌 | Worker 正在执lines任务 |
| draining | 排空中 | Worker 正在完成现有任务但不accepts新任务 |
| degraded | 降级 | Worker 能力受限但仍可工作 |
| unavailable | 不可用 | Worker 当前no法accepts任务 |
| quarantined | 隔离 | Worker 被暂时disabled |
| offline | 离线 | Worker connect断开 |
| local | 本地 | Worker 部署在同一进程 |
| remote | 远程 | Worker via桥接connect |
| execution ticket | 执lines票据 | 调度层下发给执lines层的正式执lines单据 |
| dispatch | 调度分发 | 将任务或执lines权分配到某个执lines承载体 |

---

## 10. Lease & Fencing | 租约vs隔离

| English | 中文 | 解释 |
|---------|------|------|
| lease | 租约 | 某iterations execution 或 worker dispatch 的临时所有权 |
| fencing token | 隔离令牌 | 防止旧执lines者回写脏结果的版本令牌 |
| active | 活跃 | Lease 当前有效 |
| expired | 已过期 | Lease 已exceeds过有效期 |
| released | 已释放 | Lease 被主动释放 |
| reclaimed | 已回收 | Lease 被系统回收 |
| handed_over | 已交接 | Lease 被移交给其他 worker |
| stale_write_rejected | 过期writes拒绝 | 因 fencing token 不匹配而拒绝的旧writes |

---

## 11. Message & Event | 消息vs事件

| English | 中文 | 解释 |
|---------|------|------|
| message | 消息 | 一iterations完整消息对象 |
| message part | 消息片段 | 消息内部的结构化片段 |
| inbound | 入站 | 消息方向：user输入 |
| outbound | 出站 | 消息方向：系统输出 |
| system | 系统 | 消息方向：系统通知 |
| event | 事件 | 系统内部的结构化事实通知 |
| tier_1 event | 一级事件 | 必须可靠落库、必须可恢复、不可默默丢失的事件 |
| tier_2 event | 二级事件 | 至少一iterations交付的事件 |
| tier_3 event | 三级事件 | 尽力交付的事件 |
| ack | 确认 | 某消费者已确认handle某事件的record |
| replay | 重放 | 从内存缓冲中补发事件 |
| stream | 流 | 面向渠道/UI 的增量输出流 |
| stream_id | 流标识 | 某条展示流的唯一标识 |

---

## 12. Message Part Types | 消息片段class型

| English | 中文 | 解释 |
|---------|------|------|
| text | 文本 | 文本内容片段 |
| reasoning | 推理 | 推理过程追踪片段 |
| tool_use | 工具call | 工具usesrequest片段 |
| tool_result | 工具结果 | 工具执lines结果片段 |
| summary | 摘要 | 内容摘要片段 |
| artifact_ref | 产物references用 | references用 artifact 的片段 |
| decision_prompt | Decision提示 | Decision提示词片段 |
| agent_ref | 智能体references用 | references用 agent 的片段 |
| subtask_ref | 子任务references用 | references用子任务的片段 |
| retry_record | 重试record | 重试历史片段 |
| step_boundary | 步骤边界 | 步骤边界标记片段 |
| compaction_marker | 压缩标记 | 上下文压缩标记片段 |
| hook_event | 钩子事件 | 钩子触发事件片段 |
| command_execution | 命令执lines | 命令执lines片段 |
| mcp_call | MCP call | Model Context Protocol call片段 |

---

## 13. Step Output Status | 步骤输出Status

| English | 中文 | 解释 |
|---------|------|------|
| succeeded | success | 步骤success完成 |
| failed | failed | 步骤执linesfailed |
| partial_success | 部分success | 步骤部分success，存在部分结果 |
| skipped | 已跳过 | 步骤被跳过 |

---

## 14. Memory | 记忆系统

| English | 中文 | 解释 |
|---------|------|------|
| memory | 记忆 | 可检索的记忆单元 |
| layer_3 | 第三层 | 高频低delay记忆层 |
| layer_5 | 第五层 | 中频中delay记忆层 |
| layer_7 | 第七层 | 低频高delay记忆层 |
| general | 一般 | 一般性记忆内容 |
| fact | 事实 | 事实性记忆内容 |
| episode | 事件 | 事件性记忆内容 |
| rule | 规则 | 规则性记忆内容 |
| decision | Decision | Decision性记忆内容 |
| active | 活跃 | 记忆当前可用 |
| archived | 归档 | 记忆已归档 |
| superseded | 已替代 | 记忆已被新内容替代 |
| trusted | 可信 | 信息来源可信 |
| external | 外部 | 信息来源为外部 |
| untrusted | 不可信 | 信息来源不可信 |

---

## 15. Run Types | 运linesclass型

| English | 中文 | 解释 |
|---------|------|------|
| task_run | 任务运lines | 标准的任务执linesclass型 |
| tool_call | 工具call | 工具call执linesclass型 |
| approval_resume | 审批恢复 | 审批via后恢复执lines |
| replay | 重放 | 回放执lines |

---

## 16. Compensation & Checkpoint | 补偿vs检查点

| English | 中文 | 解释 |
|---------|------|------|
| compensation | 补偿 | 对已发生副作用的步骤进lines回滚、对账或人工修复的动作 |
| idempotent_replay | 幂等重放 | via重放实现补偿的策略 |
| compare_and_swap_write | 比较并交换writes | via CAS writes实现补偿的策略 |
| compensating_action | 补偿动作 | via执lines补偿动作实现回滚的策略 |
| manual_reconciliation_required | 需要人工对账 | 需要人工介入进lines对账修复 |
| checkpoint | 检查点 | 可恢复边界上的Status快照 |
| resume_from_checkpoint | 从检查点恢复 | 从检查点开始恢复执lines的策略 |
| replay_from_start | 从头重放 | 从工作流开始重新执lines的策略 |
| manual_reconciliation | 人工对账 | 需要人工介入进lines修复的策略 |

---

## 17. Termination & Error | 终止vs错误

| English | 中文 | 解释 |
|---------|------|------|
| reasonCode | 原因码 | 终止原因码，以字符串形式record |
| termination_initiator | 终止发起者 | 触发终止的主体：user / system / policy / admin |
| termination_scope | 终止范围 | 终止Impact范围：step / workflow / task / session |
| recoverable | 可恢复 | 终止后isno允许走恢复路径 |
| dead-letter | 死信 | no法自动恢复或不应继续重试的failed落袋record |

---

## 18. Task Priority & Source | 任务优先级vs来源

| English | 中文 | 解释 |
|---------|------|------|
| low | 低 | 低优先级 |
| normal | 普通 | 普通优先级 |
| high | 高 | 高优先级 |
| urgent | 紧急 | 紧急优先级 |
| user | user | 任务来源：userdirectly创建 |
| perception | 感知 | 任务来源：系统感知触发 |
| system | 系统 | 任务来源：系统内部创建 |

---

## 19. Isolation & Placement | 隔离vs部署

| English | 中文 | 解释 |
|---------|------|------|
| standard | 标准 | 标准隔离级别 |
| hardened | 加固 | 加固隔离级别 |
| strict | 严格 | 严格隔离级别 |
| local | 本地 | 工作器部署在同一进程 |
| remote | 远程 | 工作器via桥接connect |

---

## 20. Session Consistency | 会话一致性

| English | 中文 | 解释 |
|---------|------|------|
| connecting | connect中 | 远程会话正在建立connect |
| connected | 已connect | 远程会话已connect |
| reconnecting | 重连中 | 远程会话正在重连 |
| degraded | 降级 | 远程会话能力降级 |
| failed | failed | 远程会话connectfailed |
| viewer_only | only查看 | 会话occurrences于只读观察Status |
| unknown | 未知 | 一致性检查Status未知 |
| passed | via | 一致性检查via |
| mismatch | 不匹配 | 一致性检查发现不匹配 |
| aligned | 对齐 | 工作区Status已synchronous |
| conflict | conflicts | 工作区Status存在conflicts |

---

## 21. Lease Audit Events | 租约审计事件

| English | 中文 | 解释 |
|---------|------|------|
| lease_granted | 租约授予 | 租约被授予 |
| lease_renewed | 租约续期 | 租约被续期 |
| lease_expired | 租约过期 | 租约自然过期 |
| lease_reclaimed | 租约回收 | 租约被系统回收 |
| stale_write_rejected | 过期writes拒绝 | 因令牌不匹配拒绝过期writes |
| lease_released | 租约释放 | 租约被主动释放 |
| lease_handover | 租约交接 | 租约被移交给其他执lines实体 |

---

## 22. Dispatch Rejection Reasons | 调度拒绝原因

| English | 中文 | 解释 |
|---------|------|------|
| worker_unavailable | 工作器不可用 | 工作器当前不可用 |
| worker_quarantined | 工作器被隔离 | 工作器occurrences于隔离Status |
| worker_offline | 工作器离线 | 工作器connect断开 |
| worker_draining | 工作器排空中 | 工作器正在排空 |
| worker_degraded_filtered | 工作器降级被过滤 | 降级工作器被过滤 |
| worker_untrusted | 工作器不可信 | 工作器信任检查failed |
| worker_capacity_full | 工作器容量满 | 工作器已达最大容量 |
| queue_affinity_mismatch | 队列亲和性不匹配 | 队列亲和性要求不满足 |
| missing_capabilities | 缺少能力 | 工作器缺少所需能力 |
| worker_placement_mismatch | 工作器部署位置不匹配 | 本地/远程部署要求不满足 |
| worker_isolation_mismatch | 工作器隔离级别不匹配 | 隔离级别要求不满足 |
| worker_repo_version_mismatch | 工作器版本不匹配 | code仓库版本要求不满足 |
| worker_remote_session_unready | 工作器远程会话未就绪 | 远程会话未准备好 |

---

## 23. Execution Ticket Status | 执lines票据Status

| English | 中文 | 解释 |
|---------|------|------|
| pending | 待认领 | 票据等待被认领 |
| claimed | 已认领 | 票据已被 worker 认领 |
| consumed | 已消费 | 票据已被uses |
| cancelled | 已取消 | 票据已被取消 |
| expired | 已过期 | 票据已过期 |

---

## 24. Operator Actions | 操作员动作

| English | 中文 | 解释 |
|---------|------|------|
| take_over_task | 接管任务 | 操作员接管任务 |
| modify_input | 修改输入 | 操作员修改任务输入 |
| retry_execution | 重试执lines | 操作员触发重试 |
| skip_step | 跳过步骤 | 操作员跳过某个步骤 |
| set_current_step | 设置当前步骤 | 操作员设置当前执lines步骤 |
| switch_worker | 切换工作器 | 操作员切换执lines工作器 |
| write_step_output | writes步骤输出 | 操作员writes步骤输出 |
| complete_task | 完成任务 | 操作员手动完成任务 |

---

## 25. Takeover Session | 接管会话

| English | 中文 | 解释 |
|---------|------|------|
| open | 开放 | 接管会话occurrences于开放Status |
| closed | 已关闭 | 接管会话已结束 |

---

## 26. Evolution & Promotion | 演化vs晋升

| English | 中文 | 解释 |
|---------|------|------|
| pending_approval | 待审批 | 提案等待审批 |
| approved | 已批准 | 提案已批准 |
| rejected | 已拒绝 | 提案已拒绝 |
| applied | 已应用 | 提案已应用 |
| rolled_back | 已回滚 | 提案已回滚 |
| draft | 草稿 | 草稿Status |
| validated | 已验证 | 已via验证 |
| promoted | 已推广 | 已推广 |
| retired | 已退役 | 已停用 |
| shadow | 影子运lines | 影子模式运lines |
| canary_5 | 5% 金丝雀 | 5% 流量金丝雀发布 |
| partial_25 | 25% 分批 | 25% 分批发布 |
| partial_50 | 50% 分批 | 50% 分批发布 |
| partial_75 | 75% 分批 | 75% 分批发布 |
| stable | 稳定 | 稳定版本 |
| shadow_running | 影子运lines中 | 影子模式运lines中 |

---

## 27. Compaction | 上下文压缩

| English | 中文 | 解释 |
|---------|------|------|
| trim | 修剪 | 移除旧的工具结果 |
| summarize | 摘要 | 将内容压缩为关键洞察 |

---

## 28. Event Consumer Ack | 事件消费者确认

| English | 中文 | 解释 |
|---------|------|------|
| pending | 待确认 | 等待消费者确认 |
| acked | 已确认 | 消费者已确认 |
| failed | failed | 确认failed |
| dead_lettered | 死信 | 已移至死信队列 |

---

## 29. Remote Log Levels | 远程日志级别

| English | 中文 | 解释 |
|---------|------|------|
| debug | 调试 | 调试级别日志 |
| info | 信息 | 信息级别日志 |
| warn | 警告 | 警告级别日志 |
| error | 错误 | 错误级别日志 |

---

## 30. Budget Scope | budget范围

| English | 中文 | 解释 |
|---------|------|------|
| task_execution | 任务执lines | 任务执linesbudget |
| compaction | 压缩 | 上下文压缩budget |
| skill_execution | 技能执lines | 技能执linesbudget |
| recovery_retry | 恢复重试 | 恢复重试budget |
| approval_review | 审批审查 | 审批审查budget |

---

## 31. Transition | Status转换

| English | 中文 | 解释 |
|---------|------|------|
| task | 任务 | 任务实体class型 |
| workflow | 工作流 | 工作流实体class型 |
| session | 会话 | 会话实体class型 |
| approval | 审批 | 审批实体class型 |
| execution | 执lines实例 | 执lines实例实体class型 |
| user | user | user触发者 |
| agent | 智能体 | 智能体触发者 |
| system | 系统 | 系统触发者 |
| scheduler | 调度器 | 调度器触发者 |
| admin | manage员 | manage员触发者 |
| webhook | Webhook | Webhook 触发者 |
| recovery | 恢复 | 恢复触发者 |

---

## 32. Quick Reference: Commonly Confused Terms | 快速参考：易混淆术语

### task vs session
- **task**: 业务工作单元
- **session**: 交互会话

### workflow vs execution
- **workflow**: 结构defines
- **execution**: 某iterations运lines尝试

### agent vs worker
- **agent**: 偏职责vs智能体
- **worker**: 偏执lines承载vs资源位

### artifact vs output vs step output
- **artifact**: 偏文件产物
- **output**: 偏结果语义
- **step output**: 偏步骤级结构化快照

### queued vs blocked
- **queued**: 等待调度分配
- **blocked**: 因relies on/审批/策略/资源no法继续

### paused vs awaiting_user
- **paused**: 被显式暂停
- **awaiting_user**: 等待外部输入

### stalled vs offline
- **stalled**: 有进展但timeout
- **offline**: connect断开

### failed vs cancelled
- **failed**: 执linesfailed终止
- **cancelled**: 被显式取消

### done vs completed
- **done**: Task 唯一终端successStatus
- **completed**: Workflow success结束Status

---

## Document Info | 文档信息

- Source: `docs_zh/governance/glossary_and_terminology.md` and `src/platform/contracts/types/`
- Governance Level: 主版本（术语table主版本）
- Last Updated: 2026-04-22

---

## 33. Data & Storage | datavsstorage

| English | 中文 | 解释 |
|---------|------|------|
| Authoritative Store | 权威storage | 对某class事实拥有最终解释权的storage系统，isdata的最终真相来源，不可vs任意cache混用 |
| Transaction Store | 事务storage | 负责任务、Status、审批、事件等事务性data的storage；code中事务性datastorage于 AuthoritativeSqlDatabase |
| Artifact Store | 产物storage | storage文件型、大体积或export型产物的storage，vs transaction store 性质不同 |
| Analytics Store | 分析storage | 面向投影和物化视图的storage，非独立的分析报tablestorage |
| Data Plane | data平面 | 事务层、artifact、analytics、archive、replay 的统一data平面（当前为规划概念） |
| Namespace | 命名空间 | data、artifact 或 tenant 边界下的逻辑命名空间，区别于 OS path |
| Eventual Consistency | 最终一致性 | 允许短暂delay后达到一致的Status，不同于强一致性保证 |
| Reconciliation | 对账修复 | 对Status、事件、worker、locks 等进lines对账和修复的动作 |
| Migration | 迁移 | schema 或storage结构的正式版本迁移，区别于 ad-hoc SQL patch |
| Storage Backend | storage后端 | supported SQLite/PostgreSQL 两种驱动的底层storage抽象 |
| Storage Driver | storage驱动 | SQLite 或 PostgreSQL 两种storagereferences擎驱动class型 |
| Schema Migration | Schema 迁移 | data库结构版本的正式升级或降级过程 |
| Checksum Mismatch | 校验和不匹配 | 迁移版本校验failed，预期vs实际inconsistent |
| Shadow SQLite | 影子 SQLite | PostgreSQL 双跑模式下并lines运lines的 SQLite 影子库 |
| Authoritative Task Store | 权威任务storage | Phase 1a 的任务Status权威storage，委托给 sqlite 或 postgres 实现 |
| Phase 1a Store | Phase 1a storage | 初始稳定核心阶段的任务storage抽象 |
| Read-after-write Consistency | 写后读一致性 | writes完成后立即读取能获取到writes结果的保证 |
| Lease | 租约 | 某iterations execution 或 worker dispatch 的临时所有权，不is永久 ownership |
| Fencing Token | 隔离令牌 | 防止旧执lines者回写脏结果的版本令牌，不is普通 sequence |
| Dead-letter | 死信 | no法自动恢复或不应继续重试的failed落袋record |
| Partial Result | 部分结果 | 任务尚未整体完成，但已有可保留、可审计的阶段性结果 |
| Checkpoint | 检查点 | 可恢复边界上的Status快照，区别于任意临时variable |

---

## 34. Configuration & Version | configurevs版本

| English | 中文 | 解释 |
|---------|------|------|
| Config Bundle | configure包 | 一组一起生效的configure集合，contains bootstrap、gateways、providers、runtime、security、workflows 等层级 |
| Config Version | configure版本 | configure变更后的版本标识，used for篡改检测和cachemanage |
| Config Layer | configure层级 | configure的垂直层级结构，如 platform、tenant、pack、task_type |
| Feature Flag | 特性开关 | 控制能力启停或灰度的开关 |
| Prompt Bundle | Prompt 包 | 一组一起发布、一起版本化的 prompts |
| Config Diff | configure差异 | 两个configure包之间的变化条目，used for drift 检测 |
| Bundle Hash | 包哈希 | 整个configure包的 SHA-256 哈希值 |
| Layer Hash | 层级哈希 | 单个configure层的内容哈希，used for变更检测 |
| Tamper Detection | 篡改检测 | via版本 ID 比对检测未authorization的configure变更 |
| Config Rollout | configure发布 | supported金丝雀策略的configure发布，可分阶段（5%/25%/50%/100%）渐进式推送 |
| Canary Rollout | 金丝雀发布 | 先小比例试运lines再逐步扩大的configure发布策略 |
| Rollback Point | 回滚点 | 可供恢复的configure版本快照record |
| Config Governance Service | configure治理服务 | 负责加载、验证、完整性检查分层configurebundle的服务 |
| Sandbox Policy | 沙箱策略 | 文件path的security验证策略，防止目录遍历攻击 |
| Compatibility Window | 兼容性窗口 | 不同 runtime/SDK/protocol/plugin 之间被正式supported的兼容time区间 |
| Promote Criteria | 晋升标准 | 某模块从可用提升到 platform-ready/production-ready 的证据门槛 |
| Readiness Registry | 就绪注册table | record环境或模块 readiness Status的正式注册面 |
| Evidence Package | 证据包 | used for支撑 promote/signoff/production-ready 判断的一组证据 |
| Production-ready | 生产就绪 | 已达到生产托底所需的综合门槛 |
| Phase 1a Ready | Phase 1a 就绪 | 达到 Phase 1a 稳定核心的最小可用门槛 |

---

## 35. Prompt & Cache | Prompt vscache

| English | 中文 | 解释 |
|---------|------|------|
| Fixed Prefix | 固定前缀 | 跨 agent 共享的 system prompt 固定前缀，defaults to不参vs普通 compaction |
| Domain Block | 领域块 | 同 domain/profile 可复用的 prompt 中间层 |
| Variable Suffix | variable后缀 | 按任务、角色、plan、memory dynamically变化的 prompt 后缀 |
| KV Cache Fixed Prefix | KV cache固定前缀 | based on相同 prefix hash 的预填充cache复用机制 |

---

## 36. Storage Operations | storage运lines机制

| English | 中文 | 解释 |
|---------|------|------|
| Migration Runner | 迁移运lines器 | 负责执linesstorage后端 schema 升级的Statusmanage服务 |
| Schema Status | Schema Status | 当前版本vs预期版本的对比Status |
| Pending Versions | 待执lines版本 | 尚未应用的迁移版本列table |
| Up-to-date | 最新版本 | 当前storage schema completed所有迁移 |
| Dual Run | 双跑模式 | 生产环境 PostgreSQL 必须并lines运lines SQLite 影子库的模式 |

---

## 37. Security & Governance | securityvs治理

| English | 中文 | 解释 |
|---------|------|------|
| Policy Engine | 策略references擎 | 对permission、风险、审批、budget和运lines约束进lines最终裁决的code级入口，is统一的securityDecision中心 |
| HITL (Human In The Loop) | 人工介入 | 需要人class显式参vs的Decision步骤，高风险操作必须via过人工审批才能继续 |
| Approval | 人工审批 | 工作流中需要人class显式确认才能继续的Decision节点 |
| Break-Glass | 紧急放lines | 高风险紧急放linesconfigure标记，critical 风险触发 break-glass approvalclass型，used for紧急bypassing标准流程 |
| Sandbox | 沙箱 | 执lines隔离边界，将不可信code或操作限制在受控环境中运lines |
| Exec Policy | 执lines策略 | 工具/命令执lines的规则集合，defines哪些操作被允许或禁止 |
| Permission | permission | 某主体可见或可用某能力的authorizationStatus，via PolicyEngine 隐式实现 |
| Secret | key/凭证 | key、token、凭证等敏感机密信息，includes API Key、OAuth Token、data库密码等 |
| Secret Masking | key脱敏 | 在日志和展示中遮盖敏感key信息的方法，防止凭证泄露 |
| Data Classification | data分级 | data敏感度分级规则，includes public/internal/confidential/restricted 四个级别 |
| Audit Evidence | 审计证据 | 可追溯、可验证、不可轻易抵赖的lines为证据，used for合规和责任认定 |
| Field Encryption | 字段encryption | 对特定字段进linesencryption保护，确保敏感data在storage和传输中的security |
| Network Egress Policy | 出站network策略 | 控制和审计从系统向外网发起的networkrequest策略 |
| Outbound URL Policy | 出站URL策略 | 对外部 HTTP request的目标 URL 进lines过滤和限制的规则 |
| Kill Switch | 熔断开关 | 紧急情况下全面disabled系统功能的开关，一旦激活所有操作将被拒绝 |
| Budget Guard | budget防护 | 监控和控制任务执lines成本的机制，防止exceeds出budget |
| Risk Category | 风险class别 | PolicyEngine 评估的风险class型，includes destructive/irreversible/prod_affecting 等 |
| PII (Personally Identifiable Information) | 个人身份信息 | 可识别个人的信息，如邮箱、电话、SSN、信用卡号等 |
| Secret Lease | key租约 | key的time限访问authorization，控制key的有效期和uses范围 |
| Secret Rotation | key轮换 | 定期更新key以降低泄露风险的运维实践 |
| CVE Intelligence | CVE情报 | 已知security漏洞情报服务，追踪和评估系统受漏洞Impact程度 |
| Policy Decision Request | 策略Decisionrequest | contains任务ID、主体ID、动作、风险class别等上下文的策略评估request |
| Policy Decision Result | 策略Decision结果 | 策略references擎返回的Decision结果，includes allow/deny/escalate_for_approval |
| Data Classification Level | data分级级别 | includes public/internal/confidential/restricted 四个敏感度级别 |
| Data Handling Dimension | datahandle维度 | data流动的场景维度，includes prompt/logs/memory/artifact/cross_worker/debug |
| Handling Decision | handleDecision | based ondata分级和handle维度做出的允许/拒绝/脱敏/审计决定 |
| PII Detection | PII检测 | uses正则模式识别内容中的个人身份信息 |
| PII Annotation | PII标注 | 在内容中标记检测到的 PII 位置和脱敏形式 |
| Secret Management Service | keymanage服务 | 统一manage所有key生命cycle、轮换和访问的服务 |
| Managed Secret Provider | 托管key提供者 | 从 Vault/KMS/Secret Manager 等获取key的提供者 |
| Env Secret Provider | 环境variablekey提供者 | 从环境variable读取key的提供者 |
| External Secret Provider | 外部key提供者 | 从外部keymanage系统获取key的提供者 |
| Audit Integrity | 审计完整性 | 确保审计record不被篡改的完整性保护机制 |
| Network Egress Audit | 出站network审计 | record和审查所有对外networkrequest的审计机制 |
| Trusted Context Scanner | 可信上下文扫描器 | 扫描和验证可信上下文configure的组件 |
| File Freshness | 文件新鲜度 | 检查文件isno过期或需要更新的机制 |
| CVE Intelligence Service | CVE情报服务 | 跟踪评估已知security漏洞Impact的情报服务 |
| Approval Service | 审批服务 | handle人工审批request和Decision的服务 |
| Approval Request | 审批request | 发送给人工审批者的审批任务 |
| Approval Decision | 审批Decision | 审批者做出的批准或拒绝决定 |
| Idempotent | 幂等性 | 同一操作repeats执lines结果一致的特性 |

---

## 38. Testing & Stabilization | 测试vs稳定化

| English | 中文 | 解释 |
|---------|------|------|
| Stable Core | 稳定核心 | 为先达到可稳定运lines而刻意收缩后的最小能力范围，确保核心功能可靠 |
| Golden Task | 黄金任务 | 作为版本回归基线的固定代table任务，used for验证系统基本功能未退化 |
| Fixture | 测试固件 | 预置的固定输入/输出样本，used for稳定测试和 VCR 回放 |
| VCR (Video Cassette Recorder) | VCR录制回放 | 对外部 LLM call做录制/回放的测试机制，实现确定性测试 |
| Unit Test | 单元测试 | 面向单function、单模块、单对象的细粒度测试 |
| Integration Test | 集成测试 | 跨模块协同的测试，验证多个组件之间的交互正确性 |
| E2E (End-to-End) | 端到端测试 | 从入口到结果的完整流程测试，覆盖整个系统链路 |
| Chaos Test | 混沌测试 | 主动注入故障以验证恢复vs韧性的测试，如注入networkdelay、服务宕机 |
| Soak Test | 浸泡测试 | 长time持续运lines的稳定性测试，验证系统在长期负载下的table现 |
| Recovery Drill | 恢复演练 | 针对崩溃、断连、锁conflicts、重启等场景的恢复能力演练 |
| Chaos Smoke | 混沌冒烟测试 | 在系统启动时验证故障检测和修复能力的快速端到端测试 |
| Admission Control | 准入控制 | 系统在过载前进lines拒绝、delay或降级的保护机制 |
| Readiness | 就绪度 | 某阶段、模块或环境isno达到进入下一动作的准备Status |
| Stable Validation | 稳定验证 | 运lines黄金任务并检查data库完整性和备份往返的验证流程 |
| Stable Gate | 稳定门禁 | 环境升级到下一阶段必须via的质量门槛 |
| Golden Task Inventory | 黄金任务清单 | 必须覆盖的任务class别集合，includes coding/research/content/data 等 |
| VCR Replay Mode | VCR回放模式 | includes fixture_only/vcr_replay/vcr_record 三种模式，控制isno允许实际call |
| Drift Detection | 漂移检测 | 对比当前运lines结果vs基线，检测性能或lines为异常 |
| Regression Detection | 回归检测 | 发现新code导致已有功能退化的测试方法 |
| Stable Runtime Validator | 运lines时稳定验证器 | 运lines黄金任务并检查data库完整性和备份有效性的核心模块 |
| Stable Acceptance Line | 稳定验收线 | 环境晋升到生产就绪Status必须达到的质量标准线 |
| Stable Release Gate | 发布门禁 | 版本发布前必须via的稳定性和质量检查 |
| Stable Release Package | 稳定发布包 | via过验证、可used for正式部署的版本产物 |
| Stable Evidence Campaign | 证据收集活动 | 为支撑 promote/signoff 判断而收集的一组证据包 |
| Stable Evidence Bundle | 证据包 | contains测试结果、基线对比、回归分析等支撑发布Decision的证据集合 |
| Stable Evidence Sequence | 证据序列 | 按time顺序组织的稳定性证据record |
| Stable Migration Compatibility Rehearsal | 迁移兼容性演练 | 验证系统在不同版本间迁移兼容性的排练 |
| Stable Gray Release Rehearsal | 灰度发布演练 | 验证灰度发布机制可靠性的排练 |
| Stable Rolling Upgrade Rehearsal | 滚动升级演练 | 验证滚动升级过程可靠性的排练 |
| Stable Concurrency Rehearsal | concurrent演练 | 验证系统在concurrent负载下稳定运lines能力的排练 |
| Stable Backup Restore Rehearsal | 备份恢复演练 | 验证data备份和恢复流程可靠性的排练 |
| Stable DB Queue Disconnect Rehearsal | data库队列断连演练 | 验证data库vs队列connect中断场景下系统lines为的排练 |
| Stable DB Writability Rehearsal | data库writes演练 | 验证data库writes能力在故障场景下可恢复的排练 |
| Stable Dispatch Rehearsal | 调度演练 | 验证任务调度机制在异常条件下正常工作的排练 |
| Stable Dispatch Reconciliation Rehearsal | 调度对账演练 | 验证调度层vs执lines层Status一致的排练 |
| Stable Event Replay Rehearsal | 事件重放演练 | 验证事件重放机制可靠性的排练 |
| Stable Lease Rehearsal | 租约演练 | 验证任务租约机制在故障场景下正确释放和续约的排练 |
| Stable Queue Delivery Rehearsal | 队列投递演练 | 验证消息队列投递可靠性的排练 |
| Stable Runtime Soak Runner | 运lines时浸泡运lines器 | 长time持续运lines测试以验证稳定性的运lines器 |
| Stable Worker Handshake Rehearsal | Worker握手演练 | 验证 Worker 注册和心跳机制可靠性的排练 |
| Stable Worker Writeback Rehearsal | Worker回写演练 | 验证 Worker 结果回写机制可靠性的排练 |
| Stable Cross-Division Recovery Drill | 跨部门恢复演练 | 针对跨部门协作场景的灾难恢复演练 |
| Stable Maintenance Rehearsal | 维护演练 | 系统维护期间可用性保障能力的排练 |
| Prompt Injection Guard | 提示词注入防护 | 检测和阻止恶意提示词注入攻击的防护机制 |
| Prompt Injection Red Team | 提示词注入红队 | 针对提示词注入攻击的security测试团队 |
| Environment Readiness | 环境就绪度 | 环境达到可投入生产uses所需满足的条件 |
| Environment Promotion | 环境晋升 | 环境从当前阶段升级到下一阶段的过程 |
| Drill Type | 演练class型 | includes backup_restore/rolling_upgrade/maintenance_drain/tenant_gray_rollout/regional_failover/worker_reassignment/queue_repair 等 |
| Golden Task Latency Band | 黄金任务delay带 | 任务预期的delay范围，includes interactive/extended |
| Golden Task Case | 黄金任务用例 | 具体的黄金任务defines，containsrequest、元data、预期结果 |
| Golden Task Run Result | 黄金任务运lines结果 | 黄金任务执lines后的实际结果和viaStatus |
| Golden Task Class | 黄金任务class别 | 必须覆盖的任务class型，includes coding/research/content/data/cross_division/high_risk_approval/crash_recovery |
| VCR Replay Fixture | VCR回放固件 | 录制保存的request/response对，used for测试回放 |
| VCR Request Fingerprint | VCRrequest指纹 | request的 SHA-256 哈希值，used for唯一标识录制 |

---

## 39. Abbreviations | 缩写词

| English | 中文 | 解释 |
|---------|------|------|
| ADR | ArchitectureDecisionrecord | Architecture Decision Record，record重要ArchitectureDecision |
| API | 应用编程接口 | Application Programming Interface |
| SDK | 软件开发工具包 | Software Development Kit |
| DSL | 领域专用语言 | Domain-Specific Language |
| DDL | datadefines语言 | Data Definition Language |
| WAL | 预写日志 | Write-Ahead Logging |
| HITL | 人工介入 | Human In The Loop |
| PII | 个人身份信息 | Personally Identifiable Information |
| TTL | 生存time | Time To Live |
| DLQ | 死信队列 | Dead Letter Queue |
| HA | 高可用 | High Availability |
| DR | 灾难恢复 | Disaster Recovery |
| OIDC | OpenIDconnect | OpenID Connect，used for身份authentication联邦 |
| SSO | 单点登录 | Single Sign-On |
| SCIM | user身份synchronous | System for Cross-domain Identity Management |
| RLS | lines级security | Row-Level Security |
| SBOM | 软件物料清单 | Software Bill of Materials |
| RCA | Root Cause分析 | Root Cause Analysis |
| VCR | 录像回放 | Video Cassette Recorder，借指测试录制回放 |
| IAM | 身份vs访问manage | Identity and Access Management |
| SLA | 服务等级协议 | Service Level Agreement |
| SLO | 服务目标 | Service Level Objective |
| SLI | 服务等级指标 | Service Level Indicator |

---

## 37. Protocol, Model & Security Abbreviations | 协议、模型vssecurity缩写

| English | 中文 | 解释 |
|---------|------|------|
| ADR | ArchitectureDecisionrecord | Architecture Decision Record，Architecture设计Decision文档 |
| API | 应用编程接口 | Application Programming Interface，对外或模块间Interface Plane |
| SDK | 软件开发工具包 | Software Development Kit，由 authoritative schema 派生 |
| DSL | 领域专用语言 | Domain-Specific Language，如 workflow DSL |
| DDL | datadefines语言 | Data Definition Language，建table/索references/约束迁移语句 |
| WAL | 预写日志 | Write-Ahead Logging，SQLite/data库的持久化机制 |
| MCP | 模型上下文协议 | Model Context Protocol，外部能力接入协议 |
| HITL | 人工介入 | Human In The Loop，需要人class参vs的Decision环节 |
| PII | 个人身份信息 | Personally Identifiable Information，需脱敏handle |
| TTL | 存活time | Time To Live，data或cache的有效时长 |
| DLQ | 死信队列 | Dead Letter Queue，承接no法继续handle的消息或任务 |
| HA | 高可用 | High Availability，系统持续可用性保障 |
| DR | 容灾恢复 | Disaster Recovery，灾难场景下的业务恢复能力 |
| OIDC | 开放身份connect | OpenID Connect，used for身份authentication联邦 |
| SSO | 单点登录 | Single Sign-On，一iterationsauthentication全链路通lines |
| SCIM | 身份synchronous协议 | System for Cross-domain Identity Management，uservs组织身份synchronous |
| RLS | lines级security | Row-Level Security，data访问层面的lines级隔离 |
| SBOM | 软件物料清单 | Software Bill of Materials，relies on组件清单 |
| RBAC | based on角色的访问控制 | Role-Based Access Control，permissionmanage模型 |
| PKCE | code交换证明 | Proof Key for Code Exchange，OAuth 扩展security机制 |

---

## 38. Integration & Communication Abbreviations | 集成vscommunication缩写

| English | 中文 | 解释 |
|---------|------|------|
| RPC | 远程过程call | Remote Procedure Call，服务间communication模式 |
| REST | table述性Status转移 | Representational State Transfer，Web API 风格 |
| GraphQL | 图查询语言 | Graph Query Language，API 查询语言 |
| OAuth | 开放authorization | Open Authorization，第三方authorization协议 |
| Webhook | Web 回调 | Web callback，事件驱动通知机制 |
| SSE | 服务器推送事件 | Server-Sent Events，客户端接收服务端推送 |
| TCP | 传输控制协议 | Transmission Control Protocol，connect可靠传输 |
| UDP | userdata报协议 | User Datagram Protocol，noconnect传输 |
| HTTP | exceeds文本传输协议 | HyperText Transfer Protocol，Web communication |
| HTTPS | securityexceeds文本传输协议 | HTTP Secure，TLS encryption传输 |
| DNS | 域名系统 | Domain Name System，域名解析 |
| CDN | 内容分发network | Content Delivery Network，静态资源加速 |
| QoS | 服务质量 | Quality of Service，network性能保障 |

---

## 39. Code-Level Variable Abbreviations | code级别variable缩写

| English | 中文 | 解释 |
|---------|------|------|
| id | 标识符 | identifier，对象唯一标识 |
| uid | user标识 | user identifier，user身份# |
| pid | 进程标识 | process identifier，操作系统进程# |
| tid | 线程标识 | thread identifier，操作系统线程# |
| sid | 会话标识 | session identifier，一iterations交互会话唯一标识 |
| eid | 执lines标识 | execution identifier，执lines实例# |
| cid | 关联标识 | correlation identifier，跨模块关联# |
| ts | time戳 | timestamp，recordtime |
| ctx | 上下文 | context，执lines环境信息传递 |
| cfg | configure | config/configuration，运lines时参数 |
| opts | 选项 | options，optional参数 |
| args | 参数 | arguments，function/命令输入 |
| env | 环境 | environment，运lines环境variable |
| db | data库 | database，持久化storage |
| sql | 查询语言 | structured query language |
| url | 资源定位符 | uniform resource locator |
| uri | 资源标识符 | uniform resource identifier |
| ip | networkaddress | internet protocol address |
| err | 错误 | error，异常或failedStatus |
| res | response | response，返回结果 |
| req | request | request，输入/call |
| resp | response | response，返回data |
| msg | 消息 | message，communication单元 |
| evt | 事件 | event，Status变更通知 |
| svc | 服务 | service，业务能力单元 |
| repo | 仓库 | repository，code或datastorage |
| auth | authentication | authentication，身份验证 |
| authz | authorization | authorization，permission校验 |
| prop | 属性 | property，对象属性 |
| val | 值 | value，属性值 |
| idx | 索references | index，数组位置或data库索references |
| len | 长度 | length，count或大小 |
| max | 最大值 | maximum，upper limit |
| min | 最小值 | minimum，lower limit |
| prev | 上一个 | previous，前一个Status |
| curr | 当前 | current，当前Status |
| next | 下一个 | next，下一个Status |
| init | 初始化 | initialize，初始化操作 |
| def | defaults to | default，defaults to值 |
| tmp | 临时 | temporary，临时variable |
| src | 源 | source，来源 |
| dest | 目标 | destination，目标位置 |

---

## 40. Operations & Business Abbreviations | 运维vs业务缩写

| English | 中文 | 解释 |
|---------|------|------|
| SLA | 服务等级协议 | Service Level Agreement，对外承诺协议 |
| SLO | 服务等级目标 | Service Level Objective，期望达成目标 |
| SLI | 服务等级指标 | Service Level Indicator，实际测量指标 |
| KPI | 关键绩效指标 | Key Performance Indicator，业务衡量指标 |
| OKR | 目标vs关键成果 | Objectives and Key Results，目标manage框架 |
| PMF | 产品-市场匹配 | Product-Market Fit，产品市场契合度 |
| ROI | 投资回报率 | Return on Investment，投资收益比 |
| MTTR | 平均恢复time | Mean Time To Recovery，平均故障恢复时长 |
| MTBF | 平均故障间隔 | Mean Time Between Failures，平均no故障运lines时长 |
| RCA | Root Cause分析 | Root Cause Analysis，事故分析流程 |
| RTO | 恢复time目标 | Recovery Time Objective，故障恢复时长目标 |
| RPO | data回退点目标 | Recovery Point Objective，可acceptsdata丢失窗口 |

---

## 41. Testing Abbreviations | 测试缩写

| English | 中文 | 解释 |
|---------|------|------|
| E2E | 端到端 | End-to-End，从入口到结果的完整测试或流程 |
| UT | 单元测试 | Unit Test，单function/模块测试 |
| IT | 集成测试 | Integration Test，跨模块协同测试 |
| VCR | 测试录制回放 | Video Cassette Recorder，外部call录制/回放机制 |

---

*本文档为只读治理参考，如发现术语conflicts以对应 authoritative contract 为准。*

---

## 42. Organization & Control Plane Roles | 组织vs控制层角色

| English | 中文 | 解释 |
|---------|------|------|
| `strategic_governor` | 战略总督 | 战略判断、升级治理、组织级审批的控制层角色（文档defines，code中未实现为独立服务） |
| `intake_router` | 摄取路由器 | 输入分诊、分class、路由、budget入口的控制层角色 |
| `workflow_planner` | 工作流规划器 | 跨事业部拆分、relies on图、聚合、failed升级的控制层角色 |
| `division_lead` | 部门主管 | 事业部内 workflow 自治编排的控制层角色（文档defines，code中未实现为独立服务） |
| `division` | 事业部 | 业务能力域或事业部边界，不应vs `tenant` 混用 |
| `role` | 角色 | 职责defines，不is运lines实例 |
| `agent` | 智能体 | 承担角色职责的智能执lines实体，不应vs `worker` 混用 |
| `organization` | 组织 | 企业/组织级边界 |
| `workspace` | 工作空间 | 组织下的工作空间边界，不应vs `session` 混用 |
| `tenant` | 租户 | 隔离、security、配额和计费的主边界 |

---

## 43. Channel & Extension | 渠道vs扩展

| English | 中文 | 解释 |
|---------|------|------|
| `channel` | 渠道 | user或系统接入界面，如 CLI、Web、Telegram、API（注：code中only实现 telegram/slack/webhook） |
| `channel capability` | 渠道能力 | 某渠道supported的能力，如 text、button、stream、attachment（注意：code中no对应的能力枚举class型defines） |
| `plugin` | 插件 | via公共 SDK 或受控边界扩展平台能力的安装单元 |
| `skill` | 技能 | 对工具或步骤的可复用编排能力 |
| `MCP` | 模型上下文协议 | 外部能力接入协议/扩展class型之一（MCP工具via mcp-tool-guard 验证） |
| `recipe` | 配方 | 结构化工作流或模板defines，可作为 workflow 作者输入层 |
| `template` | 模板 | vs recipe class似，结构化工作流或步骤的defines，可复用 |
| `provider` | 提供方 | LLM 或模型能力提供方 |
| `model` | 模型 | provider 提供的具体模型实例 |
| `model profile` | 模型画像 | 某模型的能力、限制、价格、defaults to参数等元data |

---

## 44. Domain & Plugin Registry | 领域vs插件注册

| English | 中文 | 解释 |
|---------|------|------|
| `domain` | 领域 | 业务能力域的defines，contains workflows、toolBundles、outputContracts 等 |
| `domain model` | 领域模型 | contains StepTemplateConfig、WorkflowConfig、ToolBundleConfig 等的结构defines |
| `plugin binding` | 插件绑定 | 领域vs插件的关联configure，defines pluginId、pluginType、priority 等 |
| `PluginSpiType` | 插件SPIclass型 | includes retriever、validator、planner、presenter、adapter 五种 |
| `PluginLifecycleState` | 插件生命cycleStatus | includes registered、loaded、active、inactive、unloaded、degraded、disabled |
| `ExternalAdapterPlugin` | 外部适配器插件 | connect外部系统（github、jira、notion、figma 等）的插件class型 |
| `PluginRuntimeIsolation` | 插件运lines时隔离级别 | includes shared_process、serialized_in_process、forked_process、sandboxed_process、containerized_process |
| `PluginSandboxPolicy` | 插件沙箱策略 | timeoutMs、allowFilesystemWrite、allowNetworkEgress 等securityconfigure |

---

## 45. Confusable Term Pairs with Distinctions | 易混淆术语对详解

### permission vs policy | permission vs 策略
- **permission（permission）**: authorization结果或静态能力边界。code中 permission 概念via PolicyEngine 隐式实现，no独立的 Permission class型defines。
- **policy（策略）**: 裁决逻辑vs规则体系，对permission、风险、审批、budget和运lines约束进lines最终裁决的code级入口。
- **区分**: 不应把 prompt 中的口头限制当作正式 policy。

### queue vs lease | 队列 vs 租赁
- **queue（队列）**: 决定等待顺序的任务排队机制。
- **lease（租赁）**: 某iterations execution 或 worker dispatch 的临时所有权，used for防止repeats执lines，决定当前执lines权。
- **区分**: 两者都存在时，不应互相替代。

### readiness vs production-ready | 就绪度 vs 生产就绪
- **readiness（就绪度）**: table示达到某个 gate 或下一动作的准备度。
- **production-ready（生产就绪）**: table示已达到生产托底所需的综合门槛。
- **区分**: `Phase 1a ready` 不得被误读为 `production-ready`。

### signoff vs completion gate | 签过 vs 完成门
- **signoff（签过）**: 当前 revision 的评审Conclusion。
- **completion gate（完成门）**: 进入 coding 前必须再iterations执lines的门槛检查。
- **区分**: 不应把一iterations signoff Conclusion当作永久通lines证。

### provider vs model | 提供方 vs 模型
- **provider（提供方）**: 服务提供方，如 OpenAI、Anthropic。
- **model（模型）**: provider 提供的具体模型实例，如 GPT-4、Claude-3。
- **区分**: `model profile` is模型元data，不等于 provider profile。

### artifact vs output vs step output | 产物 vs 输出 vs 步骤输出
- **artifact（产物）**: 文件型或二进制产物，通常via artifact store manage。
- **output（输出）**: 面向上游步骤或user的结果，可为结构化data或文本，不必is文件。
- **step output（步骤输出）**: 某个 step 完成后的结构化结果快照。

### task vs session | 任务 vs 会话
- **task（任务）**: 业务工作单元，is系统面向user和业务的最小工作承诺对象。
- **session（会话）**: 渠道交互会话，承载user输入、流式输出和交互上下文。
- **区分**: 一个 session 可以触发多个 task；一个 task 也可能跨多个 session 更新Status。

### workflow vs execution | 工作流 vs 执lines
- **workflow（工作流）**: task 的结构化执lines路径defines。
- **execution（执lines）**: 某iterations运lines尝试。
- **区分**: 同一 workflow 可以对应多个 execution attempt。

### agent vs worker | 智能体 vs 工作器
- **agent（智能体）**: 偏职责vs智能体概念。
- **worker（工作器）**: 偏执lines承载vs资源位。
- **区分**: `sub-agent` 不is远程 worker 的同义词。

---

## 46. Five-Plane Architecture | Five-PlaneArchitecture

| English | 中文 | 解释 |
|---------|------|------|
| P1 Interface Plane | P1 接口平面 | 对外接入层：API Gateway / Webhook / Scheduler / Console / Ingress，负责输入校验、身份authentication、限流、路由 |
| P2 Control Plane | P2 控制平面 | 控制vs治理层：Policy / Approval / Rollout / Incident / Config，负责definesvs版本治理、审批控制、风险守卫、发布控制 |
| P3 Orchestration Plane | P3 编排平面 | 编排vsDecision层：OAPEFLIR Loop / Planner / Routing / Escalation，负责决定做什么、下一步谁执lines、何时暂停转人工 |
| P4 Execution Plane | P4 执lines平面 | 统一执lines层：Dispatcher / Workers / Tools / Plugins / Recovery，负责真正执lines动作、维护 lease、结果回写、触发恢复 |
| P5 State & Evidence Plane | P5 Statusvs证据平面 | Statusvs证据平面：Truth / Events / Artifacts / Memory / Knowledge / Audit / Projections，负责保存控制真相、历史轨迹、恢复支撑、审计证据 |
| X1 Reliability Fabric | X1 可靠性织网 | 跨平面横切生命supported系统：AuthN/Z / Sandbox / Circuit Breaker / DLQ / Backpressure，以 middleware 形式注入各平面 |
| RequestEnvelope | request信封 | P1 → P2 的标准request封装，contains requestId / tenantId / taskSpec / priority / traceContext / principal |
| ControlDirective | 控制指令 | P2 → P3/P4 的控制指令，used for模式切换、暂停、终止、回滚、配额调整 |
| ExecutionPlan | 执lines计划 | P3 → P4 的标准执lines计划，Description有序步骤vs资源约束 |
| ExecutionReceipt | 执lines回执 | P4 → P3/P5 的执lines结果回报，contains status / duration / artifacts / telemetry / sideEffects / error |
| StateCommand | Status命令 | P3/P4 → P5 的Statuswrites指令，based on CAS 保证幂等 |
| EvidenceRecord | 证据record | P3 → P5 的异步Decision证据writes |
| ProjectionUpdate | 投影更新 | P5 → P2 的投影变化事件通知 |

---

## 47. OAPEFLIR Stage Types | OAPEFLIR 阶段class型

| English | 中文 | 解释 |
|---------|------|------|
| OapeflirStage | OAPEFLIR 阶段枚举 | 八阶段闭环的Status枚举：`observe / assess / plan / execute / feedback / learn / improve / release / knowledge_promotion` |
| OapeflirStageStatus | OAPEFLIR 阶段Status | 阶段执linesStatus：`completed / skipped` |
| OapeflirStageRecord | 阶段record | record单个阶段的执linesStatus、耗时、references用 ID 和原因码 |
| OapeflirStageTimelineBuilder | 阶段time线构建器 | used for构建 OAPEFLIR 各阶段执linestime线的工具class |
| OapeflirLoopInput | OAPEFLIR 循环输入 | contains taskId / objective / workflow / feedbackSignals / blockerSummaries / fileRefs / stepOutputs |
| OapeflirLoopResult | OAPEFLIR 循环结果 | contains observation / assessment / plan / stepOutputs / feedback / learningSignals / learningObjects / rolloutRecord / timeline / outcome / qualityGate / replanDecision |
| OapeflirLoopService | OAPEFLIR 循环服务 | OAPEFLIR 闭环的主服务class，协调各阶段的执lines |
| ExecuteBridge | 执lines桥接 | 执lines计划到双通道步骤输出的转换接口 |
| RuntimeExecuteBridge | 运lines时执lines桥接 | based ondata库的实现 |
| MockExecuteBridge | 模拟执lines桥接 | used for测试的模拟实现 |

---

## 48. OAPEFLIR Status Enums | OAPEFLIR Status枚举

| English | 中文 | 解释 |
|---------|------|------|
| promotion_status | 推广Status | LearningObject 的生命cycleStatus：`draft / validated / promoted / retired` |
| candidate_status | 候选Status | ImprovementCandidate 的Status：`proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| rollout_status | 发布Status | RolloutRecord 的Status：`draft / pending_approval / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable / rejected / rolled_back / paused` |
| rollout_level | 发布级别 | 发布灰度等级：`off / suggest / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable` |
| AssessmentPhase | 评估阶段 | 评估时刻：`pre-execution / post-execution` |
| AssessmentComplexity | 评估复杂度 | 任务复杂度等级：`trivial / simple / moderate / complex / critical` |
| AssessmentRisk | 评估风险 | 风险等级：`low / medium / high / critical` |
| ExecutionMode | 执lines模式 | 执lines模式：`auto / supervised / manual` |
| ApprovalLevel | 审批级别 | 审批要求级别：`none / user / admin` |
| FeedbackSource | 反馈来源 | 反馈信号来源：`execution / user / hitl / validation / system` |
| FeedbackCategory | 反馈class别 | 反馈信号class别：`success / failure / correction / timeout / partial` |
| FeedbackSeverity | 反馈严重性 | 反馈严重程度：`info / warning / error / critical` |
| PlanStrategy | 计划策略 | 计划生成策略：`linear / hierarchical / tree_branch / reflexive / goal_driven / resource_constrained / online / replanned` |
| PlanStepStatus | 计划步骤Status | 步骤执linesStatus：`pending / running / done / failed / skipped` |
| LearningType | 学习class型 | 学习对象class型：`failure_pattern / user_correction / recovery_playbook / model_retraining / dataset_gap` |
| ValidatedBy | 验证方式 | 学习对象验证方式：`none / evidence / human_review / shadow_execution` |
| ImprovementChangeScope | 改进变更范围 | 改进变更的作用域：`prompt / policy / model / workflow / tool_config` |
| TaskPhase | 任务阶段 | 任务当前所occurrences阶段：`intake / planning / executing / reviewing / completed` |

---

## 49. Execution Assessment Types | 执lines评估class型

| English | 中文 | 解释 |
|---------|------|------|
| ExecutionAssessment | 执lines评估 | 完整的计划执lines后评估，contains结果分class、质量评分、偏差分析、重规划Recommendation |
| ExecutionOutcome | 执lines结果 | 执lines结果class型：`completed / completed_with_deviations / repairable / failed / escalated` |
| ExecutionDeviation | 执lines偏差 | 执lines期间vs计划的工作流偏差：`skipped / reordered / modified / added / substituted` |
| ExecutionError | 执lines错误 | 执lines期间遇到的错误，contains步骤 ID、错误码、消息、严重性和可恢复性 |
| CriterionResult | 标准结果 | success标准评估结果，containsisnovia、实际值和failed原因 |

---

## 50. Recovery & Fault Tolerance | 恢复vs容错

| English | 中文 | 解释 |
|---------|------|------|
| runtime repair | 运lines时修复 | 故障时自动修复执lines的机制 |
| replay | 重放 | 从已知良好Status重新执lines |
| recovery playbook | 恢复手册 | 针对特定failed模式的标准化恢复步骤 |
| lease reclaim | 租约回收 | 回收timeout工作器的执lines权 |
| stalled detection | 停滞检测 | 检测长timeno有效进展的执lines |
| auto-rollback | 自动回滚 | 发布failed时自动回退到上一版本 |
| guardrail | 护栏 | 保护生产环境免受不当变更Impact的机制 |
| canary | 金丝雀发布 | 小流量验证新版本后再扩大 |
| circuit breaker | 断路器 | failed率过高时暂时阻断call的保护机制 |

---

*本文档为只读治理参考，如发现术语conflicts以对应 authoritative contract 为准。*
