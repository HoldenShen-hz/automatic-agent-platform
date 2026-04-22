# Terminology Bilingual Glossary | 术语对照表

## Overview | 概述

This document provides a comprehensive Chinese-English bilingual reference for all core terms used in the Automatic Agent Platform. Terms are organized by domain area.

本文档为自动代理平台的全部核心术语提供中文-英文对照参考，按领域分类组织。

---

## 1. Core Objects | 核心对象

| English | 中文 | 解释 |
|---------|------|------|
| task | 任务 | 用户级工作单元，是系统面向用户和业务的最小工作承诺对象 |
| workflow | 工作流 | task 的结构化执行路径，定义 step、依赖、输入输出和失败路径 |
| step | 步骤 | workflow 中的单个执行步骤 |
| execution | 执行实例 | 某个 task/workflow 的一次具体运行尝试 |
| attempt | 重试计数 | 对同一 execution 或 step 的重试计数/重入序号 |
| session | 会话 | 渠道交互会话，承载用户输入、流式输出和交互上下文 |
| message | 消息 | 一次完整消息对象，可包含多个 message part |
| message part | 消息片段 | 消息内部的结构化片段，如文本、tool_use、tool_result、summary |
| artifact | 产物/制品 | 文件型或二进制产物，通常通过 artifact store 管理 |
| output | 输出 | 面向上游步骤或用户的结果，可为结构化数据或文本，不必是文件 |
| step output | 步骤输出 | 某个 step 完成后的结构化结果快照 |
| result envelope | 结果信封 | 对成功、部分成功、失败、warning、artifact 和 metrics 的统一结果封装 |

---

## 2. OAPEFLIR Terms | OAPEFLIR 术语

| English | 中文 | 解释 |
|---------|------|------|
| OAPEFLIR | OAPEFLIR | Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release 八阶段闭环 |
| stage | 阶段 | OAPEFLIR 闭环中的阶段级状态单元 |
| loop iteration | 闭环迭代 | 一次完整或部分闭环迭代的执行轮次 |
| TaskSituation | 任务态势 | Observe 输出的事实快照 |
| UnifiedAssessment | 统一评估 | Assess 输出的结构化判断 |
| Plan | 执行计划 | Plan Hub 的显式执行计划 |
| FeedbackSignal | 反馈信号 | Execute 之后收集到的结构化反馈信号 |
| LearningObject | 学习对象 | Learn Hub 产出的可复用学习对象 |
| ImprovementCandidate | 改进候选 | Improve Hub 产出的改进候选 |
| RolloutRecord | 发布记录 | Release 阶段的受控释放记录 |

---

## 3. Execution & Recovery | 执行与恢复

| English | 中文 | 解释 |
|---------|------|------|
| runtime | 运行时 | 系统实际执行 task / workflow / agent / tool 的运行层 |
| execution ticket | 执行票据 | 调度层下发给执行层的正式执行单据 |
| lease | 租约 | 某次 execution 或 worker dispatch 的临时所有权 |
| lease owner | 租约持有者 | 当前持有执行权的执行实体 |
| fencing token | 隔离令牌 | 防止旧执行者回写脏结果的版本令牌 |
| dispatch | 调度分发 | 将任务或执行权分配到某个执行承载体 |
| worker | 工作器 | 执行承载单元，可为本地或远程 |
| sub-agent | 子代理 | 在同一任务上下文中协作的次级智能执行单元 |
| heartbeat | 心跳 | 周期性健康/负载上报 |
| stalled | 停滞 | 进程未必死亡，但在规定时间内无有效进展 |
| dead-letter | 死信 | 无法自动恢复或不应继续重试的失败落袋记录 |
| checkpoint | 检查点 | 可恢复边界上的状态快照 |
| partial result | 部分结果 | 任务尚未整体完成，但已有可保留、可审计的阶段性结果 |
| compensation | 补偿 | 对已发生副作用的步骤进行回滚、对账或人工修复的动作 |

---

## 4. Task Status | 任务状态

| English | 中文 | 解释 |
|---------|------|------|
| queued | 排队中 | Task pre-execution state，已创建但尚未进入调度 |
| pending | 待处理 | Task pre-execution state，已创建但尚未进入调度 |
| in_progress | 进行中 | 正在推进主逻辑（Task 状态） |
| awaiting_decision | 等待决策 | Task waiting for approval，等待审批决策 |
| done | 已完成 | Task terminal state，Task 成功结束 |
| failed | 失败 | 执行失败且当前尝试终止 |
| cancelled | 已取消 | 被显式终止，不再继续 |

---

## 5. Workflow Status | 工作流状态

| English | 中文 | 解释 |
|---------|------|------|
| running | 运行中 | Workflow 正在推进主逻辑 |
| paused | 已暂停 | 被显式暂停，可恢复 |
| resuming | 恢复中 | Workflow transition state for resuming from pause，从暂停恢复的过渡状态 |
| completed | 已完成 | Workflow 成功结束 |
| failed | 失败 | Workflow 执行失败 |
| cancelling | 取消中 | Workflow transient state before cancelled，终止前的过渡状态 |
| cancelled | 已取消 | 被显式终止，不再继续 |

---

## 6. Execution Status | 执行实例状态

| English | 中文 | 解释 |
|---------|------|------|
| created | 已创建 | Execution created state，Execution 已创建 |
| prechecking | 预校验中 | Execution pre-validation phase，执行前校验阶段 |
| executing | 执行中 | 正在推进主逻辑（Execution 状态） |
| blocked | 阻塞 | 因依赖未满足、审批、策略或资源原因暂时无法继续 |
| succeeded | 成功 | Execution 成功完成 |
| failed | 失败 | Execution 执行失败 |
| cancelled | 已取消 | 被显式终止，不再继续 |
| superseded | 已替代 | Execution replaced by newer execution，被新 Execution 替代 |

---

## 7. Session Status | 会话状态

| English | 中文 | 解释 |
|---------|------|------|
| open | 开放 | Session open state，会话处于开放状态 |
| streaming | 流式输出中 | Session streaming state，会话流式输出中 |
| awaiting_user | 等待用户 | 等待人类或外部系统输入（Session 状态） |
| paused | 已暂停 | Session paused，会话被暂停 |
| completed | 已完成 | Session completed，会话成功结束 |
| failed | 失败 | Session failed，会话失败 |
| cancelled | 已取消 | Session cancelled，会话被终止 |

---

## 8. Approval Status | 审批状态

| English | 中文 | 解释 |
|---------|------|------|
| requested | 已请求 | Approval requested，等待人类决策 |
| approved | 已批准 | Approval granted，审批通过 |
| rejected | 已拒绝 | Approval denied，审批未通过 |
| expired | 已过期 | Approval timeout，审批超时 |
| cancelled | 已取消 | Approval cancelled，审批被撤销 |

---

## 9. Worker & Dispatch | 工作器与调度

| English | 中文 | 解释 |
|---------|------|------|
| worker | 工作器 | 执行承载单元，可为本地或远程 |
| agent | 智能体 | 承担角色职责的智能执行实体 |
| coordinator | 协调器 | 管理任务在 worker 之间分发的调度协调服务 |
| idle | 空闲 | Worker 可接受新任务 |
| busy | 忙碌 | Worker 正在执行任务 |
| draining | 排空中 | Worker 正在完成现有任务但不接受新任务 |
| degraded | 降级 | Worker 能力受限但仍可工作 |
| unavailable | 不可用 | Worker 当前无法接受任务 |
| quarantined | 隔离 | Worker 被暂时禁用 |
| offline | 离线 | Worker 连接断开 |
| local | 本地 | Worker 部署在同一进程 |
| remote | 远程 | Worker 通过桥接连接 |
| execution ticket | 执行票据 | 调度层下发给执行层的正式执行单据 |
| dispatch | 调度分发 | 将任务或执行权分配到某个执行承载体 |

---

## 10. Lease & Fencing | 租约与隔离

| English | 中文 | 解释 |
|---------|------|------|
| lease | 租约 | 某次 execution 或 worker dispatch 的临时所有权 |
| fencing token | 隔离令牌 | 防止旧执行者回写脏结果的版本令牌 |
| active | 活跃 | Lease 当前有效 |
| expired | 已过期 | Lease 已超过有效期 |
| released | 已释放 | Lease 被主动释放 |
| reclaimed | 已回收 | Lease 被系统回收 |
| handed_over | 已交接 | Lease 被移交给其他 worker |
| stale_write_rejected | 过期写入拒绝 | 因 fencing token 不匹配而拒绝的旧写入 |

---

## 11. Message & Event | 消息与事件

| English | 中文 | 解释 |
|---------|------|------|
| message | 消息 | 一次完整消息对象 |
| message part | 消息片段 | 消息内部的结构化片段 |
| inbound | 入站 | 消息方向：用户输入 |
| outbound | 出站 | 消息方向：系统输出 |
| system | 系统 | 消息方向：系统通知 |
| event | 事件 | 系统内部的结构化事实通知 |
| tier_1 event | 一级事件 | 必须可靠落库、必须可恢复、不可默默丢失的事件 |
| tier_2 event | 二级事件 | 至少一次交付的事件 |
| tier_3 event | 三级事件 | 尽力交付的事件 |
| ack | 确认 | 某消费者已确认处理某事件的记录 |
| replay | 重放 | 从内存缓冲中补发事件 |
| stream | 流 | 面向渠道/UI 的增量输出流 |
| stream_id | 流标识 | 某条展示流的唯一标识 |

---

## 12. Message Part Types | 消息片段类型

| English | 中文 | 解释 |
|---------|------|------|
| text | 文本 | 文本内容片段 |
| reasoning | 推理 | 推理过程追踪片段 |
| tool_use | 工具调用 | 工具使用请求片段 |
| tool_result | 工具结果 | 工具执行结果片段 |
| summary | 摘要 | 内容摘要片段 |
| artifact_ref | 产物引用 | 引用 artifact 的片段 |
| decision_prompt | 决策提示 | 决策提示词片段 |
| agent_ref | 智能体引用 | 引用 agent 的片段 |
| subtask_ref | 子任务引用 | 引用子任务的片段 |
| retry_record | 重试记录 | 重试历史片段 |
| step_boundary | 步骤边界 | 步骤边界标记片段 |
| compaction_marker | 压缩标记 | 上下文压缩标记片段 |
| hook_event | 钩子事件 | 钩子触发事件片段 |
| command_execution | 命令执行 | 命令执行片段 |
| mcp_call | MCP 调用 | Model Context Protocol 调用片段 |

---

## 13. Step Output Status | 步骤输出状态

| English | 中文 | 解释 |
|---------|------|------|
| succeeded | 成功 | 步骤成功完成 |
| failed | 失败 | 步骤执行失败 |
| partial_success | 部分成功 | 步骤部分成功，存在部分结果 |
| skipped | 已跳过 | 步骤被跳过 |

---

## 14. Memory | 记忆系统

| English | 中文 | 解释 |
|---------|------|------|
| memory | 记忆 | 可检索的记忆单元 |
| layer_3 | 第三层 | 高频低延迟记忆层 |
| layer_5 | 第五层 | 中频中延迟记忆层 |
| layer_7 | 第七层 | 低频高延迟记忆层 |
| general | 一般 | 一般性记忆内容 |
| fact | 事实 | 事实性记忆内容 |
| episode | 事件 | 事件性记忆内容 |
| rule | 规则 | 规则性记忆内容 |
| decision | 决策 | 决策性记忆内容 |
| active | 活跃 | 记忆当前可用 |
| archived | 归档 | 记忆已归档 |
| superseded | 已替代 | 记忆已被新内容替代 |
| trusted | 可信 | 信息来源可信 |
| external | 外部 | 信息来源为外部 |
| untrusted | 不可信 | 信息来源不可信 |

---

## 15. Run Types | 运行类型

| English | 中文 | 解释 |
|---------|------|------|
| task_run | 任务运行 | 标准的任务执行类型 |
| tool_call | 工具调用 | 工具调用执行类型 |
| approval_resume | 审批恢复 | 审批通过后恢复执行 |
| replay | 重放 | 回放执行 |

---

## 16. Compensation & Checkpoint | 补偿与检查点

| English | 中文 | 解释 |
|---------|------|------|
| compensation | 补偿 | 对已发生副作用的步骤进行回滚、对账或人工修复的动作 |
| idempotent_replay | 幂等重放 | 通过重放实现补偿的策略 |
| compare_and_swap_write | 比较并交换写入 | 通过 CAS 写入实现补偿的策略 |
| compensating_action | 补偿动作 | 通过执行补偿动作实现回滚的策略 |
| manual_reconciliation_required | 需要人工对账 | 需要人工介入进行对账修复 |
| checkpoint | 检查点 | 可恢复边界上的状态快照 |
| resume_from_checkpoint | 从检查点恢复 | 从检查点开始恢复执行的策略 |
| replay_from_start | 从头重放 | 从工作流开始重新执行的策略 |
| manual_reconciliation | 人工对账 | 需要人工介入进行修复的策略 |

---

## 17. Termination & Error | 终止与错误

| English | 中文 | 解释 |
|---------|------|------|
| reasonCode | 原因码 | 终止原因码，以字符串形式记录 |
| termination_initiator | 终止发起者 | 触发终止的主体：user / system / policy / admin |
| termination_scope | 终止范围 | 终止影响范围：step / workflow / task / session |
| recoverable | 可恢复 | 终止后是否允许走恢复路径 |
| dead-letter | 死信 | 无法自动恢复或不应继续重试的失败落袋记录 |

---

## 18. Task Priority & Source | 任务优先级与来源

| English | 中文 | 解释 |
|---------|------|------|
| low | 低 | 低优先级 |
| normal | 普通 | 普通优先级 |
| high | 高 | 高优先级 |
| urgent | 紧急 | 紧急优先级 |
| user | 用户 | 任务来源：用户直接创建 |
| perception | 感知 | 任务来源：系统感知触发 |
| system | 系统 | 任务来源：系统内部创建 |

---

## 19. Isolation & Placement | 隔离与部署

| English | 中文 | 解释 |
|---------|------|------|
| standard | 标准 | 标准隔离级别 |
| hardened | 加固 | 加固隔离级别 |
| strict | 严格 | 严格隔离级别 |
| local | 本地 | 工作器部署在同一进程 |
| remote | 远程 | 工作器通过桥接连接 |

---

## 20. Session Consistency | 会话一致性

| English | 中文 | 解释 |
|---------|------|------|
| connecting | 连接中 | 远程会话正在建立连接 |
| connected | 已连接 | 远程会话已连接 |
| reconnecting | 重连中 | 远程会话正在重连 |
| degraded | 降级 | 远程会话能力降级 |
| failed | 失败 | 远程会话连接失败 |
| viewer_only | 仅查看 | 会话处于只读观察状态 |
| unknown | 未知 | 一致性检查状态未知 |
| passed | 通过 | 一致性检查通过 |
| mismatch | 不匹配 | 一致性检查发现不匹配 |
| aligned | 对齐 | 工作区状态已同步 |
| conflict | 冲突 | 工作区状态存在冲突 |

---

## 21. Lease Audit Events | 租约审计事件

| English | 中文 | 解释 |
|---------|------|------|
| lease_granted | 租约授予 | 租约被授予 |
| lease_renewed | 租约续期 | 租约被续期 |
| lease_expired | 租约过期 | 租约自然过期 |
| lease_reclaimed | 租约回收 | 租约被系统回收 |
| stale_write_rejected | 过期写入拒绝 | 因令牌不匹配拒绝过期写入 |
| lease_released | 租约释放 | 租约被主动释放 |
| lease_handover | 租约交接 | 租约被移交给其他执行实体 |

---

## 22. Dispatch Rejection Reasons | 调度拒绝原因

| English | 中文 | 解释 |
|---------|------|------|
| worker_unavailable | 工作器不可用 | 工作器当前不可用 |
| worker_quarantined | 工作器被隔离 | 工作器处于隔离状态 |
| worker_offline | 工作器离线 | 工作器连接断开 |
| worker_draining | 工作器排空中 | 工作器正在排空 |
| worker_degraded_filtered | 工作器降级被过滤 | 降级工作器被过滤 |
| worker_untrusted | 工作器不可信 | 工作器信任检查失败 |
| worker_capacity_full | 工作器容量满 | 工作器已达最大容量 |
| queue_affinity_mismatch | 队列亲和性不匹配 | 队列亲和性要求不满足 |
| missing_capabilities | 缺少能力 | 工作器缺少所需能力 |
| worker_placement_mismatch | 工作器部署位置不匹配 | 本地/远程部署要求不满足 |
| worker_isolation_mismatch | 工作器隔离级别不匹配 | 隔离级别要求不满足 |
| worker_repo_version_mismatch | 工作器版本不匹配 | 代码仓库版本要求不满足 |
| worker_remote_session_unready | 工作器远程会话未就绪 | 远程会话未准备好 |

---

## 23. Execution Ticket Status | 执行票据状态

| English | 中文 | 解释 |
|---------|------|------|
| pending | 待认领 | 票据等待被认领 |
| claimed | 已认领 | 票据已被 worker 认领 |
| consumed | 已消费 | 票据已被使用 |
| cancelled | 已取消 | 票据已被取消 |
| expired | 已过期 | 票据已过期 |

---

## 24. Operator Actions | 操作员动作

| English | 中文 | 解释 |
|---------|------|------|
| take_over_task | 接管任务 | 操作员接管任务 |
| modify_input | 修改输入 | 操作员修改任务输入 |
| retry_execution | 重试执行 | 操作员触发重试 |
| skip_step | 跳过步骤 | 操作员跳过某个步骤 |
| set_current_step | 设置当前步骤 | 操作员设置当前执行步骤 |
| switch_worker | 切换工作器 | 操作员切换执行工作器 |
| write_step_output | 写入步骤输出 | 操作员写入步骤输出 |
| complete_task | 完成任务 | 操作员手动完成任务 |

---

## 25. Takeover Session | 接管会话

| English | 中文 | 解释 |
|---------|------|------|
| open | 开放 | 接管会话处于开放状态 |
| closed | 已关闭 | 接管会话已结束 |

---

## 26. Evolution & Promotion | 演化与晋升

| English | 中文 | 解释 |
|---------|------|------|
| pending_approval | 待审批 | 提案等待审批 |
| approved | 已批准 | 提案已批准 |
| rejected | 已拒绝 | 提案已拒绝 |
| applied | 已应用 | 提案已应用 |
| rolled_back | 已回滚 | 提案已回滚 |
| draft | 草稿 | 草稿状态 |
| validated | 已验证 | 已通过验证 |
| promoted | 已推广 | 已推广 |
| retired | 已退役 | 已停用 |
| shadow | 影子运行 | 影子模式运行 |
| canary_5 | 5% 金丝雀 | 5% 流量金丝雀发布 |
| partial_25 | 25% 分批 | 25% 分批发布 |
| partial_50 | 50% 分批 | 50% 分批发布 |
| partial_75 | 75% 分批 | 75% 分批发布 |
| stable | 稳定 | 稳定版本 |
| shadow_running | 影子运行中 | 影子模式运行中 |

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
| failed | 失败 | 确认失败 |
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

## 30. Budget Scope | 预算范围

| English | 中文 | 解释 |
|---------|------|------|
| task_execution | 任务执行 | 任务执行预算 |
| compaction | 压缩 | 上下文压缩预算 |
| skill_execution | 技能执行 | 技能执行预算 |
| recovery_retry | 恢复重试 | 恢复重试预算 |
| approval_review | 审批审查 | 审批审查预算 |

---

## 31. Transition | 状态转换

| English | 中文 | 解释 |
|---------|------|------|
| task | 任务 | 任务实体类型 |
| workflow | 工作流 | 工作流实体类型 |
| session | 会话 | 会话实体类型 |
| approval | 审批 | 审批实体类型 |
| execution | 执行实例 | 执行实例实体类型 |
| user | 用户 | 用户触发者 |
| agent | 智能体 | 智能体触发者 |
| system | 系统 | 系统触发者 |
| scheduler | 调度器 | 调度器触发者 |
| admin | 管理员 | 管理员触发者 |
| webhook | Webhook | Webhook 触发者 |
| recovery | 恢复 | 恢复触发者 |

---

## 32. Quick Reference: Commonly Confused Terms | 快速参考：易混淆术语

### task vs session
- **task**: 业务工作单元
- **session**: 交互会话

### workflow vs execution
- **workflow**: 结构定义
- **execution**: 某次运行尝试

### agent vs worker
- **agent**: 偏职责与智能体
- **worker**: 偏执行承载与资源位

### artifact vs output vs step output
- **artifact**: 偏文件产物
- **output**: 偏结果语义
- **step output**: 偏步骤级结构化快照

### queued vs blocked
- **queued**: 等待调度分配
- **blocked**: 因依赖/审批/策略/资源无法继续

### paused vs awaiting_user
- **paused**: 被显式暂停
- **awaiting_user**: 等待外部输入

### stalled vs offline
- **stalled**: 有进展但超时
- **offline**: 连接断开

### failed vs cancelled
- **failed**: 执行失败终止
- **cancelled**: 被显式取消

### done vs completed
- **done**: Task 唯一终端成功状态
- **completed**: Workflow 成功结束状态

---

## Document Info | 文档信息

- Source: `docs_zh/governance/glossary_and_terminology.md` and `src/platform/contracts/types/`
- Governance Level: 主版本（术语表主版本）
- Last Updated: 2026-04-22

---

## 33. Data & Storage | 数据与存储

| English | 中文 | 解释 |
|---------|------|------|
| Authoritative Store | 权威存储 | 对某类事实拥有最终解释权的存储系统，是数据的最终真相来源，不可与任意缓存混用 |
| Transaction Store | 事务存储 | 负责任务、状态、审批、事件等事务性数据的存储；代码中事务性数据存储于 AuthoritativeSqlDatabase |
| Artifact Store | 产物存储 | 存储文件型、大体积或导出型产物的存储，与 transaction store 性质不同 |
| Analytics Store | 分析存储 | 面向投影和物化视图的存储，非独立的分析报表存储 |
| Data Plane | 数据平面 | 事务层、artifact、analytics、archive、replay 的统一数据平面（当前为规划概念） |
| Namespace | 命名空间 | 数据、artifact 或 tenant 边界下的逻辑命名空间，区别于 OS path |
| Eventual Consistency | 最终一致性 | 允许短暂延迟后达到一致的状态，不同于强一致性保证 |
| Reconciliation | 对账修复 | 对状态、事件、worker、locks 等进行对账和修复的动作 |
| Migration | 迁移 | schema 或存储结构的正式版本迁移，区别于 ad-hoc SQL patch |
| Storage Backend | 存储后端 | 支持 SQLite/PostgreSQL 两种驱动的底层存储抽象 |
| Storage Driver | 存储驱动 | SQLite 或 PostgreSQL 两种存储引擎驱动类型 |
| Schema Migration | Schema 迁移 | 数据库结构版本的正式升级或降级过程 |
| Checksum Mismatch | 校验和不匹配 | 迁移版本校验失败，预期与实际不一致 |
| Shadow SQLite | 影子 SQLite | PostgreSQL 双跑模式下并行运行的 SQLite 影子库 |
| Authoritative Task Store | 权威任务存储 | Phase 1a 的任务状态权威存储，委托给 sqlite 或 postgres 实现 |
| Phase 1a Store | Phase 1a 存储 | 初始稳定核心阶段的任务存储抽象 |
| Read-after-write Consistency | 写后读一致性 | 写入完成后立即读取能获取到写入结果的保证 |
| Lease | 租约 | 某次 execution 或 worker dispatch 的临时所有权，不是永久 ownership |
| Fencing Token | 隔离令牌 | 防止旧执行者回写脏结果的版本令牌，不是普通 sequence |
| Dead-letter | 死信 | 无法自动恢复或不应继续重试的失败落袋记录 |
| Partial Result | 部分结果 | 任务尚未整体完成，但已有可保留、可审计的阶段性结果 |
| Checkpoint | 检查点 | 可恢复边界上的状态快照，区别于任意临时变量 |

---

## 34. Configuration & Version | 配置与版本

| English | 中文 | 解释 |
|---------|------|------|
| Config Bundle | 配置包 | 一组一起生效的配置集合，包含 bootstrap、gateways、providers、runtime、security、workflows 等层级 |
| Config Version | 配置版本 | 配置变更后的版本标识，用于篡改检测和缓存管理 |
| Config Layer | 配置层级 | 配置的垂直层级结构，如 platform、tenant、pack、task_type |
| Feature Flag | 特性开关 | 控制能力启停或灰度的开关 |
| Prompt Bundle | Prompt 包 | 一组一起发布、一起版本化的 prompts |
| Config Diff | 配置差异 | 两个配置包之间的变化条目，用于 drift 检测 |
| Bundle Hash | 包哈希 | 整个配置包的 SHA-256 哈希值 |
| Layer Hash | 层级哈希 | 单个配置层的内容哈希，用于变更检测 |
| Tamper Detection | 篡改检测 | 通过版本 ID 比对检测未授权的配置变更 |
| Config Rollout | 配置发布 | 支持金丝雀策略的配置发布，可分阶段（5%/25%/50%/100%）渐进式推送 |
| Canary Rollout | 金丝雀发布 | 先小比例试运行再逐步扩大的配置发布策略 |
| Rollback Point | 回滚点 | 可供恢复的配置版本快照记录 |
| Config Governance Service | 配置治理服务 | 负责加载、验证、完整性检查分层配置bundle的服务 |
| Sandbox Policy | 沙箱策略 | 文件路径访问的安全验证策略，防止目录遍历攻击 |
| Compatibility Window | 兼容性窗口 | 不同 runtime/SDK/protocol/plugin 之间被正式支持的兼容时间区间 |
| Promote Criteria | 晋升标准 | 某模块从可用提升到 platform-ready/production-ready 的证据门槛 |
| Readiness Registry | 就绪注册表 | 记录环境或模块 readiness 状态的正式注册面 |
| Evidence Package | 证据包 | 用于支撑 promote/signoff/production-ready 判断的一组证据 |
| Production-ready | 生产就绪 | 已达到生产托底所需的综合门槛 |
| Phase 1a Ready | Phase 1a 就绪 | 达到 Phase 1a 稳定核心的最小可用门槛 |

---

## 35. Prompt & Cache | Prompt 与缓存

| English | 中文 | 解释 |
|---------|------|------|
| Fixed Prefix | 固定前缀 | 跨 agent 共享的 system prompt 固定前缀，默认不参与普通 compaction |
| Domain Block | 领域块 | 同 domain/profile 可复用的 prompt 中间层 |
| Variable Suffix | 变量后缀 | 按任务、角色、plan、memory 动态变化的 prompt 后缀 |
| KV Cache Fixed Prefix | KV 缓存固定前缀 | 基于相同 prefix hash 的预填充缓存复用机制 |

---

## 36. Storage Operations | 存储运行机制

| English | 中文 | 解释 |
|---------|------|------|
| Migration Runner | 迁移运行器 | 负责执行存储后端 schema 升级的状态管理服务 |
| Schema Status | Schema 状态 | 当前版本与预期版本的对比状态 |
| Pending Versions | 待执行版本 | 尚未应用的迁移版本列表 |
| Up-to-date | 最新版本 | 当前存储 schema 已完成所有迁移 |
| Dual Run | 双跑模式 | 生产环境 PostgreSQL 必须并行运行 SQLite 影子库的模式 |

---

## 37. Security & Governance | 安全与治理

| English | 中文 | 解释 |
|---------|------|------|
| Policy Engine | 策略引擎 | 对权限、风险、审批、预算和运行约束进行最终裁决的代码级入口，是统一的安全决策中心 |
| HITL (Human In The Loop) | 人工介入 | 需要人类显式参与的决策步骤，高风险操作必须经过人工审批才能继续 |
| Approval | 人工审批 | 工作流中需要人类显式确认才能继续的决策节点 |
| Break-Glass | 紧急放行 | 高风险紧急放行配置标记，critical 风险触发 break-glass 审批类型，用于紧急绕过标准流程 |
| Sandbox | 沙箱 | 执行隔离边界，将不可信代码或操作限制在受控环境中运行 |
| Exec Policy | 执行策略 | 工具/命令执行的规则集合，定义哪些操作被允许或禁止 |
| Permission | 权限 | 某主体可见或可用某能力的授权状态，通过 PolicyEngine 隐式实现 |
| Secret | 密钥/凭证 | 密钥、token、凭证等敏感机密信息，包括 API Key、OAuth Token、数据库密码等 |
| Secret Masking | 密钥脱敏 | 在日志和展示中遮盖敏感密钥信息的方法，防止凭证泄露 |
| Data Classification | 数据分级 | 数据敏感度分级规则，包括 public/internal/confidential/restricted 四个级别 |
| Audit Evidence | 审计证据 | 可追溯、可验证、不可轻易抵赖的行为证据，用于合规和责任认定 |
| Field Encryption | 字段加密 | 对特定字段进行加密保护，确保敏感数据在存储和传输中的安全 |
| Network Egress Policy | 出站网络策略 | 控制和审计从系统向外网发起的网络请求策略 |
| Outbound URL Policy | 出站URL策略 | 对外部 HTTP 请求的目标 URL 进行过滤和限制的规则 |
| Kill Switch | 熔断开关 | 紧急情况下全面禁用系统功能的开关，一旦激活所有操作将被拒绝 |
| Budget Guard | 预算防护 | 监控和控制任务执行成本的机制，防止超出预算 |
| Risk Category | 风险类别 | PolicyEngine 评估的风险类型，包括 destructive/irreversible/prod_affecting 等 |
| PII (Personally Identifiable Information) | 个人身份信息 | 可识别个人的信息，如邮箱、电话、SSN、信用卡号等 |
| Secret Lease | 密钥租约 | 密钥的时间限访问授权，控制密钥的有效期和使用范围 |
| Secret Rotation | 密钥轮换 | 定期更新密钥以降低泄露风险的运维实践 |
| CVE Intelligence | CVE情报 | 已知安全漏洞情报服务，追踪和评估系统受漏洞影响程度 |
| Policy Decision Request | 策略决策请求 | 包含任务ID、主体ID、动作、风险类别等上下文的策略评估请求 |
| Policy Decision Result | 策略决策结果 | 策略引擎返回的决策结果，包括 allow/deny/escalate_for_approval |
| Data Classification Level | 数据分级级别 | 包括 public/internal/confidential/restricted 四个敏感度级别 |
| Data Handling Dimension | 数据处理维度 | 数据流动的场景维度，包括 prompt/logs/memory/artifact/cross_worker/debug |
| Handling Decision | 处理决策 | 基于数据分级和处理维度做出的允许/拒绝/脱敏/审计决定 |
| PII Detection | PII检测 | 使用正则模式识别内容中的个人身份信息 |
| PII Annotation | PII标注 | 在内容中标记检测到的 PII 位置和脱敏形式 |
| Secret Management Service | 密钥管理服务 | 统一管理所有密钥生命周期、轮换和访问的服务 |
| Managed Secret Provider | 托管密钥提供者 | 从 Vault/KMS/Secret Manager 等获取密钥的提供者 |
| Env Secret Provider | 环境变量密钥提供者 | 从环境变量读取密钥的提供者 |
| External Secret Provider | 外部密钥提供者 | 从外部密钥管理系统获取密钥的提供者 |
| Audit Integrity | 审计完整性 | 确保审计记录不被篡改的完整性保护机制 |
| Network Egress Audit | 出站网络审计 | 记录和审查所有对外网络请求的审计机制 |
| Trusted Context Scanner | 可信上下文扫描器 | 扫描和验证可信上下文配置的组件 |
| File Freshness | 文件新鲜度 | 检查文件是否过期或需要更新的机制 |
| CVE Intelligence Service | CVE情报服务 | 跟踪评估已知安全漏洞影响的情报服务 |
| Approval Service | 审批服务 | 处理人工审批请求和决策的服务 |
| Approval Request | 审批请求 | 发送给人工审批者的审批任务 |
| Approval Decision | 审批决策 | 审批者做出的批准或拒绝决定 |
| Idempotent | 幂等性 | 同一操作重复执行结果一致的特性 |

---

## 38. Testing & Stabilization | 测试与稳定化

| English | 中文 | 解释 |
|---------|------|------|
| Stable Core | 稳定核心 | 为先达到可稳定运行而刻意收缩后的最小能力范围，确保核心功能可靠 |
| Golden Task | 黄金任务 | 作为版本回归基线的固定代表任务，用于验证系统基本功能未退化 |
| Fixture | 测试固件 | 预置的固定输入/输出样本，用于稳定测试和 VCR 回放 |
| VCR (Video Cassette Recorder) | VCR录制回放 | 对外部 LLM 调用做录制/回放的测试机制，实现确定性测试 |
| Unit Test | 单元测试 | 面向单函数、单模块、单对象的细粒度测试 |
| Integration Test | 集成测试 | 跨模块协同的测试，验证多个组件之间的交互正确性 |
| E2E (End-to-End) | 端到端测试 | 从入口到结果的完整流程测试，覆盖整个系统链路 |
| Chaos Test | 混沌测试 | 主动注入故障以验证恢复与韧性的测试，如注入网络延迟、服务宕机 |
| Soak Test | 浸泡测试 | 长时间持续运行的稳定性测试，验证系统在长期负载下的表现 |
| Recovery Drill | 恢复演练 | 针对崩溃、断连、锁冲突、重启等场景的恢复能力演练 |
| Chaos Smoke | 混沌冒烟测试 | 在系统启动时验证故障检测和修复能力的快速端到端测试 |
| Admission Control | 准入控制 | 系统在过载前进行拒绝、延迟或降级的保护机制 |
| Readiness | 就绪度 | 某阶段、模块或环境是否达到进入下一动作的准备状态 |
| Stable Validation | 稳定验证 | 运行黄金任务并检查数据库完整性和备份往返的验证流程 |
| Stable Gate | 稳定门禁 | 环境升级到下一阶段必须通过的质量门槛 |
| Golden Task Inventory | 黄金任务清单 | 必须覆盖的任务类别集合，包括 coding/research/content/data 等 |
| VCR Replay Mode | VCR回放模式 | 包括 fixture_only/vcr_replay/vcr_record 三种模式，控制是否允许实际调用 |
| Drift Detection | 漂移检测 | 对比当前运行结果与基线，检测性能或行为异常 |
| Regression Detection | 回归检测 | 发现新代码导致已有功能退化的测试方法 |
| Stable Runtime Validator | 运行时稳定验证器 | 运行黄金任务并检查数据库完整性和备份有效性的核心模块 |
| Stable Acceptance Line | 稳定验收线 | 环境晋升到生产就绪状态必须达到的质量标准线 |
| Stable Release Gate | 发布门禁 | 版本发布前必须通过的稳定性和质量检查 |
| Stable Release Package | 稳定发布包 | 经过验证、可用于正式部署的版本产物 |
| Stable Evidence Campaign | 证据收集活动 | 为支撑 promote/signoff 判断而收集的一组证据包 |
| Stable Evidence Bundle | 证据包 | 包含测试结果、基线对比、回归分析等支撑发布决策的证据集合 |
| Stable Evidence Sequence | 证据序列 | 按时间顺序组织的稳定性证据记录 |
| Stable Migration Compatibility Rehearsal | 迁移兼容性演练 | 验证系统在不同版本间迁移兼容性的排练 |
| Stable Gray Release Rehearsal | 灰度发布演练 | 验证灰度发布机制可靠性的排练 |
| Stable Rolling Upgrade Rehearsal | 滚动升级演练 | 验证滚动升级过程可靠性的排练 |
| Stable Concurrency Rehearsal | 并发演练 | 验证系统在并发负载下稳定运行能力的排练 |
| Stable Backup Restore Rehearsal | 备份恢复演练 | 验证数据备份和恢复流程可靠性的排练 |
| Stable DB Queue Disconnect Rehearsal | 数据库队列断连演练 | 验证数据库与队列连接中断场景下系统行为的排练 |
| Stable DB Writability Rehearsal | 数据库写入演练 | 验证数据库写入能力在故障场景下可恢复的排练 |
| Stable Dispatch Rehearsal | 调度演练 | 验证任务调度机制在异常条件下正常工作的排练 |
| Stable Dispatch Reconciliation Rehearsal | 调度对账演练 | 验证调度层与执行层状态一致的排练 |
| Stable Event Replay Rehearsal | 事件重放演练 | 验证事件重放机制可靠性的排练 |
| Stable Lease Rehearsal | 租约演练 | 验证任务租约机制在故障场景下正确释放和续约的排练 |
| Stable Queue Delivery Rehearsal | 队列投递演练 | 验证消息队列投递可靠性的排练 |
| Stable Runtime Soak Runner | 运行时浸泡运行器 | 长时间持续运行测试以验证稳定性的运行器 |
| Stable Worker Handshake Rehearsal | Worker握手演练 | 验证 Worker 注册和心跳机制可靠性的排练 |
| Stable Worker Writeback Rehearsal | Worker回写演练 | 验证 Worker 结果回写机制可靠性的排练 |
| Stable Cross-Division Recovery Drill | 跨部门恢复演练 | 针对跨部门协作场景的灾难恢复演练 |
| Stable Maintenance Rehearsal | 维护演练 | 系统维护期间可用性保障能力的排练 |
| Prompt Injection Guard | 提示词注入防护 | 检测和阻止恶意提示词注入攻击的防护机制 |
| Prompt Injection Red Team | 提示词注入红队 | 针对提示词注入攻击的安全测试团队 |
| Environment Readiness | 环境就绪度 | 环境达到可投入生产使用所需满足的条件 |
| Environment Promotion | 环境晋升 | 环境从当前阶段升级到下一阶段的过程 |
| Drill Type | 演练类型 | 包括 backup_restore/rolling_upgrade/maintenance_drain/tenant_gray_rollout/regional_failover/worker_reassignment/queue_repair 等 |
| Golden Task Latency Band | 黄金任务延迟带 | 任务预期的延迟范围，包括 interactive/extended |
| Golden Task Case | 黄金任务用例 | 具体的黄金任务定义，包含请求、元数据、预期结果 |
| Golden Task Run Result | 黄金任务运行结果 | 黄金任务执行后的实际结果和通过状态 |
| Golden Task Class | 黄金任务类别 | 必须覆盖的任务类型，包括 coding/research/content/data/cross_division/high_risk_approval/crash_recovery |
| VCR Replay Fixture | VCR回放固件 | 录制保存的请求/响应对，用于测试回放 |
| VCR Request Fingerprint | VCR请求指纹 | 请求的 SHA-256 哈希值，用于唯一标识录制 |

---

## 39. Abbreviations | 缩写词

| English | 中文 | 解释 |
|---------|------|------|
| ADR | 架构决策记录 | Architecture Decision Record，记录重要架构决策 |
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
| OIDC | OpenID连接 | OpenID Connect，用于身份认证联邦 |
| SSO | 单点登录 | Single Sign-On |
| SCIM | 用户身份同步 | System for Cross-domain Identity Management |
| RLS | 行级安全 | Row-Level Security |
| SBOM | 软件物料清单 | Software Bill of Materials |
| RCA | 根因分析 | Root Cause Analysis |
| VCR | 录像回放 | Video Cassette Recorder，借指测试录制回放 |
| IAM | 身份与访问管理 | Identity and Access Management |
| SLA | 服务等级协议 | Service Level Agreement |
| SLO | 服务目标 | Service Level Objective |
| SLI | 服务等级指标 | Service Level Indicator |

---

## 37. Protocol, Model & Security Abbreviations | 协议、模型与安全缩写

| English | 中文 | 解释 |
|---------|------|------|
| ADR | 架构决策记录 | Architecture Decision Record，架构设计决策文档 |
| API | 应用编程接口 | Application Programming Interface，对外或模块间接口面 |
| SDK | 软件开发工具包 | Software Development Kit，由 authoritative schema 派生 |
| DSL | 领域专用语言 | Domain-Specific Language，如 workflow DSL |
| DDL | 数据定义语言 | Data Definition Language，建表/索引/约束迁移语句 |
| WAL | 预写日志 | Write-Ahead Logging，SQLite/数据库的持久化机制 |
| MCP | 模型上下文协议 | Model Context Protocol，外部能力接入协议 |
| HITL | 人工介入 | Human In The Loop，需要人类参与的决策环节 |
| PII | 个人身份信息 | Personally Identifiable Information，需脱敏处理 |
| TTL | 存活时间 | Time To Live，数据或缓存的有效时长 |
| DLQ | 死信队列 | Dead Letter Queue，承接无法继续处理的消息或任务 |
| HA | 高可用 | High Availability，系统持续可用性保障 |
| DR | 容灾恢复 | Disaster Recovery，灾难场景下的业务恢复能力 |
| OIDC | 开放身份连接 | OpenID Connect，用于身份认证联邦 |
| SSO | 单点登录 | Single Sign-On，一次认证全链路通行 |
| SCIM | 身份同步协议 | System for Cross-domain Identity Management，用户与组织身份同步 |
| RLS | 行级安全 | Row-Level Security，数据访问层面的行级隔离 |
| SBOM | 软件物料清单 | Software Bill of Materials，依赖组件清单 |
| RBAC | 基于角色的访问控制 | Role-Based Access Control，权限管理模型 |
| PKCE | 代码交换证明 | Proof Key for Code Exchange，OAuth 扩展安全机制 |

---

## 38. Integration & Communication Abbreviations | 集成与通信缩写

| English | 中文 | 解释 |
|---------|------|------|
| RPC | 远程过程调用 | Remote Procedure Call，服务间通信模式 |
| REST | 表述性状态转移 | Representational State Transfer，Web API 风格 |
| GraphQL | 图查询语言 | Graph Query Language，API 查询语言 |
| OAuth | 开放授权 | Open Authorization，第三方授权协议 |
| Webhook | Web 回调 | Web callback，事件驱动通知机制 |
| SSE | 服务器推送事件 | Server-Sent Events，客户端接收服务端推送 |
| TCP | 传输控制协议 | Transmission Control Protocol，连接可靠传输 |
| UDP | 用户数据报协议 | User Datagram Protocol，无连接传输 |
| HTTP | 超文本传输协议 | HyperText Transfer Protocol，Web 通信 |
| HTTPS | 安全超文本传输协议 | HTTP Secure，TLS 加密传输 |
| DNS | 域名系统 | Domain Name System，域名解析 |
| CDN | 内容分发网络 | Content Delivery Network，静态资源加速 |
| QoS | 服务质量 | Quality of Service，网络性能保障 |

---

## 39. Code-Level Variable Abbreviations | 代码级别变量缩写

| English | 中文 | 解释 |
|---------|------|------|
| id | 标识符 | identifier，对象唯一标识 |
| uid | 用户标识 | user identifier，用户身份编号 |
| pid | 进程标识 | process identifier，操作系统进程编号 |
| tid | 线程标识 | thread identifier，操作系统线程编号 |
| sid | 会话标识 | session identifier，一次交互会话唯一标识 |
| eid | 执行标识 | execution identifier，执行实例编号 |
| cid | 关联标识 | correlation identifier，跨模块关联编号 |
| ts | 时间戳 | timestamp，记录时间 |
| ctx | 上下文 | context，执行环境信息传递 |
| cfg | 配置 | config/configuration，运行时参数 |
| opts | 选项 | options，可选参数 |
| args | 参数 | arguments，函数/命令输入 |
| env | 环境 | environment，运行环境变量 |
| db | 数据库 | database，持久化存储 |
| sql | 查询语言 | structured query language |
| url | 资源定位符 | uniform resource locator |
| uri | 资源标识符 | uniform resource identifier |
| ip | 网络地址 | internet protocol address |
| err | 错误 | error，异常或失败状态 |
| res | 响应 | response，返回结果 |
| req | 请求 | request，输入/调用 |
| resp | 响应 | response，返回数据 |
| msg | 消息 | message，通信单元 |
| evt | 事件 | event，状态变更通知 |
| svc | 服务 | service，业务能力单元 |
| repo | 仓库 | repository，代码或数据存储 |
| auth | 认证 | authentication，身份验证 |
| authz | 授权 | authorization，权限校验 |
| prop | 属性 | property，对象属性 |
| val | 值 | value，属性值 |
| idx | 索引 | index，数组位置或数据库索引 |
| len | 长度 | length，数量或大小 |
| max | 最大值 | maximum，上限 |
| min | 最小值 | minimum，下限 |
| prev | 上一个 | previous，前一个状态 |
| curr | 当前 | current，当前状态 |
| next | 下一个 | next，下一个状态 |
| init | 初始化 | initialize，初始化操作 |
| def | 默认 | default，默认值 |
| tmp | 临时 | temporary，临时变量 |
| src | 源 | source，来源 |
| dest | 目标 | destination，目标位置 |

---

## 40. Operations & Business Abbreviations | 运维与业务缩写

| English | 中文 | 解释 |
|---------|------|------|
| SLA | 服务等级协议 | Service Level Agreement，对外承诺协议 |
| SLO | 服务等级目标 | Service Level Objective，期望达成目标 |
| SLI | 服务等级指标 | Service Level Indicator，实际测量指标 |
| KPI | 关键绩效指标 | Key Performance Indicator，业务衡量指标 |
| OKR | 目标与关键成果 | Objectives and Key Results，目标管理框架 |
| PMF | 产品-市场匹配 | Product-Market Fit，产品市场契合度 |
| ROI | 投资回报率 | Return on Investment，投资收益比 |
| MTTR | 平均恢复时间 | Mean Time To Recovery，平均故障恢复时长 |
| MTBF | 平均故障间隔 | Mean Time Between Failures，平均无故障运行时长 |
| RCA | 根因分析 | Root Cause Analysis，事故分析流程 |
| RTO | 恢复时间目标 | Recovery Time Objective，故障恢复时长目标 |
| RPO | 数据回退点目标 | Recovery Point Objective，可接受数据丢失窗口 |

---

## 41. Testing Abbreviations | 测试缩写

| English | 中文 | 解释 |
|---------|------|------|
| E2E | 端到端 | End-to-End，从入口到结果的完整测试或流程 |
| UT | 单元测试 | Unit Test，单函数/模块测试 |
| IT | 集成测试 | Integration Test，跨模块协同测试 |
| VCR | 测试录制回放 | Video Cassette Recorder，外部调用录制/回放机制 |

---

*本文档为只读治理参考，如发现术语冲突以对应 authoritative contract 为准。*

---

## 42. Organization & Control Plane Roles | 组织与控制层角色

| English | 中文 | 解释 |
|---------|------|------|
| `strategic_governor` | 战略总督 | 战略判断、升级治理、组织级审批的控制层角色（文档定义，代码中未实现为独立服务） |
| `intake_router` | 摄取路由器 | 输入分诊、分类、路由、预算入口的控制层角色 |
| `workflow_planner` | 工作流规划器 | 跨事业部拆分、依赖图、聚合、失败升级的控制层角色 |
| `division_lead` | 部门主管 | 事业部内 workflow 自治编排的控制层角色（文档定义，代码中未实现为独立服务） |
| `division` | 事业部 | 业务能力域或事业部边界，不应与 `tenant` 混用 |
| `role` | 角色 | 职责定义，不是运行实例 |
| `agent` | 智能体 | 承担角色职责的智能执行实体，不应与 `worker` 混用 |
| `organization` | 组织 | 企业/组织级边界 |
| `workspace` | 工作空间 | 组织下的工作空间边界，不应与 `session` 混用 |
| `tenant` | 租户 | 隔离、安全、配额和计费的主边界 |

---

## 43. Channel & Extension | 渠道与扩展

| English | 中文 | 解释 |
|---------|------|------|
| `channel` | 渠道 | 用户或系统接入界面，如 CLI、Web、Telegram、API（注：代码中仅实现 telegram/slack/webhook） |
| `channel capability` | 渠道能力 | 某渠道支持的能力，如 text、button、stream、attachment（注意：代码中无对应的能力枚举类型定义） |
| `plugin` | 插件 | 通过公共 SDK 或受控边界扩展平台能力的安装单元 |
| `skill` | 技能 | 对工具或步骤的可复用编排能力 |
| `MCP` | 模型上下文协议 | 外部能力接入协议/扩展类型之一（MCP工具通过 mcp-tool-guard 验证） |
| `recipe` | 配方 | 结构化工作流或模板定义，可作为 workflow 作者输入层 |
| `template` | 模板 | 与 recipe 类似，结构化工作流或步骤的定义，可复用 |
| `provider` | 提供方 | LLM 或模型能力提供方 |
| `model` | 模型 | provider 提供的具体模型实例 |
| `model profile` | 模型画像 | 某模型的能力、限制、价格、默认参数等元数据 |

---

## 44. Domain & Plugin Registry | 领域与插件注册

| English | 中文 | 解释 |
|---------|------|------|
| `domain` | 领域 | 业务能力域的定义，包含 workflows、toolBundles、outputContracts 等 |
| `domain model` | 领域模型 | 包含 StepTemplateConfig、WorkflowConfig、ToolBundleConfig 等的结构定义 |
| `plugin binding` | 插件绑定 | 领域与插件的关联配置，定义 pluginId、pluginType、priority 等 |
| `PluginSpiType` | 插件SPI类型 | 包括 retriever、validator、planner、presenter、adapter 五种 |
| `PluginLifecycleState` | 插件生命周期状态 | 包括 registered、loaded、active、inactive、unloaded、degraded、disabled |
| `ExternalAdapterPlugin` | 外部适配器插件 | 连接外部系统（github、jira、notion、figma 等）的插件类型 |
| `PluginRuntimeIsolation` | 插件运行时隔离级别 | 包括 shared_process、serialized_in_process、forked_process、sandboxed_process、containerized_process |
| `PluginSandboxPolicy` | 插件沙箱策略 | timeoutMs、allowFilesystemWrite、allowNetworkEgress 等安全配置 |

---

## 45. Confusable Term Pairs with Distinctions | 易混淆术语对详解

### permission vs policy | 权限 vs 策略
- **permission（权限）**: 授权结果或静态能力边界。代码中 permission 概念通过 PolicyEngine 隐式实现，无独立的 Permission 类型定义。
- **policy（策略）**: 裁决逻辑与规则体系，对权限、风险、审批、预算和运行约束进行最终裁决的代码级入口。
- **区分**: 不应把 prompt 中的口头限制当作正式 policy。

### queue vs lease | 队列 vs 租赁
- **queue（队列）**: 决定等待顺序的任务排队机制。
- **lease（租赁）**: 某次 execution 或 worker dispatch 的临时所有权，用于防止重复执行，决定当前执行权。
- **区分**: 两者都存在时，不应互相替代。

### readiness vs production-ready | 就绪度 vs 生产就绪
- **readiness（就绪度）**: 表示达到某个 gate 或下一动作的准备度。
- **production-ready（生产就绪）**: 表示已达到生产托底所需的综合门槛。
- **区分**: `Phase 1a ready` 不得被误读为 `production-ready`。

### signoff vs completion gate | 签过 vs 完成门
- **signoff（签过）**: 当前 revision 的评审结论。
- **completion gate（完成门）**: 进入 coding 前必须再次执行的门槛检查。
- **区分**: 不应把一次 signoff 结论当作永久通行证。

### provider vs model | 提供方 vs 模型
- **provider（提供方）**: 服务提供方，如 OpenAI、Anthropic。
- **model（模型）**: provider 提供的具体模型实例，如 GPT-4、Claude-3。
- **区分**: `model profile` 是模型元数据，不等于 provider profile。

### artifact vs output vs step output | 产物 vs 输出 vs 步骤输出
- **artifact（产物）**: 文件型或二进制产物，通常通过 artifact store 管理。
- **output（输出）**: 面向上游步骤或用户的结果，可为结构化数据或文本，不必是文件。
- **step output（步骤输出）**: 某个 step 完成后的结构化结果快照。

### task vs session | 任务 vs 会话
- **task（任务）**: 业务工作单元，是系统面向用户和业务的最小工作承诺对象。
- **session（会话）**: 渠道交互会话，承载用户输入、流式输出和交互上下文。
- **区分**: 一个 session 可以触发多个 task；一个 task 也可能跨多个 session 更新状态。

### workflow vs execution | 工作流 vs 执行
- **workflow（工作流）**: task 的结构化执行路径定义。
- **execution（执行）**: 某次运行尝试。
- **区分**: 同一 workflow 可以对应多个 execution attempt。

### agent vs worker | 智能体 vs 工作器
- **agent（智能体）**: 偏职责与智能体概念。
- **worker（工作器）**: 偏执行承载与资源位。
- **区分**: `sub-agent` 不是远程 worker 的同义词。

---

## 46. Five-Plane Architecture | 五平面架构

| English | 中文 | 解释 |
|---------|------|------|
| P1 Interface Plane | P1 接口平面 | 对外接入层：API Gateway / Webhook / Scheduler / Console / Ingress，负责输入校验、身份认证、限流、路由 |
| P2 Control Plane | P2 控制平面 | 控制与治理层：Policy / Approval / Rollout / Incident / Config，负责定义与版本治理、审批控制、风险守卫、发布控制 |
| P3 Orchestration Plane | P3 编排平面 | 编排与决策层：OAPEFLIR Loop / Planner / Routing / Escalation，负责决定做什么、下一步谁执行、何时暂停转人工 |
| P4 Execution Plane | P4 执行平面 | 统一执行层：Dispatcher / Workers / Tools / Plugins / Recovery，负责真正执行动作、维护 lease、结果回写、触发恢复 |
| P5 State & Evidence Plane | P5 状态与证据平面 | 状态与证据平面：Truth / Events / Artifacts / Memory / Knowledge / Audit / Projections，负责保存控制真相、历史轨迹、恢复支撑、审计证据 |
| X1 Reliability Fabric | X1 可靠性织网 | 跨平面横切生命支持系统：AuthN/Z / Sandbox / Circuit Breaker / DLQ / Backpressure，以 middleware 形式注入各平面 |
| RequestEnvelope | 请求信封 | P1 → P2 的标准请求封装，包含 requestId / tenantId / taskSpec / priority / traceContext / principal |
| ControlDirective | 控制指令 | P2 → P3/P4 的控制指令，用于模式切换、暂停、终止、回滚、配额调整 |
| ExecutionPlan | 执行计划 | P3 → P4 的标准执行计划，描述有序步骤与资源约束 |
| ExecutionReceipt | 执行回执 | P4 → P3/P5 的执行结果回报，包含 status / duration / artifacts / telemetry / sideEffects / error |
| StateCommand | 状态命令 | P3/P4 → P5 的状态写入指令，基于 CAS 保证幂等 |
| EvidenceRecord | 证据记录 | P3 → P5 的异步决策证据写入 |
| ProjectionUpdate | 投影更新 | P5 → P2 的投影变化事件通知 |

---

## 47. OAPEFLIR Stage Types | OAPEFLIR 阶段类型

| English | 中文 | 解释 |
|---------|------|------|
| OapeflirStage | OAPEFLIR 阶段枚举 | 八阶段闭环的状态枚举：`observe / assess / plan / execute / feedback / learn / improve / release / knowledge_promotion` |
| OapeflirStageStatus | OAPEFLIR 阶段状态 | 阶段执行状态：`completed / skipped` |
| OapeflirStageRecord | 阶段记录 | 记录单个阶段的执行状态、耗时、引用 ID 和原因码 |
| OapeflirStageTimelineBuilder | 阶段时间线构建器 | 用于构建 OAPEFLIR 各阶段执行时间线的工具类 |
| OapeflirLoopInput | OAPEFLIR 循环输入 | 包含 taskId / objective / workflow / feedbackSignals / blockerSummaries / fileRefs / stepOutputs |
| OapeflirLoopResult | OAPEFLIR 循环结果 | 包含 observation / assessment / plan / stepOutputs / feedback / learningSignals / learningObjects / rolloutRecord / timeline / outcome / qualityGate / replanDecision |
| OapeflirLoopService | OAPEFLIR 循环服务 | OAPEFLIR 闭环的主服务类，协调各阶段的执行 |
| ExecuteBridge | 执行桥接 | 执行计划到双通道步骤输出的转换接口 |
| RuntimeExecuteBridge | 运行时执行桥接 | 基于数据库的实现 |
| MockExecuteBridge | 模拟执行桥接 | 用于测试的模拟实现 |

---

## 48. OAPEFLIR Status Enums | OAPEFLIR 状态枚举

| English | 中文 | 解释 |
|---------|------|------|
| promotion_status | 推广状态 | LearningObject 的生命周期状态：`draft / validated / promoted / retired` |
| candidate_status | 候选状态 | ImprovementCandidate 的状态：`proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| rollout_status | 发布状态 | RolloutRecord 的状态：`draft / pending_approval / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable / rejected / rolled_back / paused` |
| rollout_level | 发布级别 | 发布灰度等级：`off / suggest / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable` |
| AssessmentPhase | 评估阶段 | 评估时刻：`pre-execution / post-execution` |
| AssessmentComplexity | 评估复杂度 | 任务复杂度等级：`trivial / simple / moderate / complex / critical` |
| AssessmentRisk | 评估风险 | 风险等级：`low / medium / high / critical` |
| ExecutionMode | 执行模式 | 执行模式：`auto / supervised / manual` |
| ApprovalLevel | 审批级别 | 审批要求级别：`none / user / admin` |
| FeedbackSource | 反馈来源 | 反馈信号来源：`execution / user / hitl / validation / system` |
| FeedbackCategory | 反馈类别 | 反馈信号类别：`success / failure / correction / timeout / partial` |
| FeedbackSeverity | 反馈严重性 | 反馈严重程度：`info / warning / error / critical` |
| PlanStrategy | 计划策略 | 计划生成策略：`linear / hierarchical / tree_branch / reflexive / goal_driven / resource_constrained / online / replanned` |
| PlanStepStatus | 计划步骤状态 | 步骤执行状态：`pending / running / done / failed / skipped` |
| LearningType | 学习类型 | 学习对象类型：`failure_pattern / user_correction / recovery_playbook / model_retraining / dataset_gap` |
| ValidatedBy | 验证方式 | 学习对象验证方式：`none / evidence / human_review / shadow_execution` |
| ImprovementChangeScope | 改进变更范围 | 改进变更的作用域：`prompt / policy / model / workflow / tool_config` |
| TaskPhase | 任务阶段 | 任务当前所处阶段：`intake / planning / executing / reviewing / completed` |

---

## 49. Execution Assessment Types | 执行评估类型

| English | 中文 | 解释 |
|---------|------|------|
| ExecutionAssessment | 执行评估 | 完整的计划执行后评估，包含结果分类、质量评分、偏差分析、重规划建议 |
| ExecutionOutcome | 执行结果 | 执行结果类型：`completed / completed_with_deviations / repairable / failed / escalated` |
| ExecutionDeviation | 执行偏差 | 执行期间与计划的工作流偏差：`skipped / reordered / modified / added / substituted` |
| ExecutionError | 执行错误 | 执行期间遇到的错误，包含步骤 ID、错误码、消息、严重性和可恢复性 |
| CriterionResult | 标准结果 | 成功标准评估结果，包含是否通过、实际值和失败原因 |

---

## 50. Recovery & Fault Tolerance | 恢复与容错

| English | 中文 | 解释 |
|---------|------|------|
| runtime repair | 运行时修复 | 故障时自动修复执行的机制 |
| replay | 重放 | 从已知良好状态重新执行 |
| recovery playbook | 恢复手册 | 针对特定失败模式的标准化恢复步骤 |
| lease reclaim | 租约回收 | 回收超时工作器的执行权 |
| stalled detection | 停滞检测 | 检测长时间无有效进展的执行 |
| auto-rollback | 自动回滚 | 发布失败时自动回退到上一版本 |
| guardrail | 护栏 | 保护生产环境免受不当变更影响的机制 |
| canary | 金丝雀发布 | 小流量验证新版本后再扩大 |
| circuit breaker | 断路器 | 失败率过高时暂时阻断调用的保护机制 |

---

*本文档为只读治理参考，如发现术语冲突以对应 authoritative contract 为准。*
