# ADR-003 六层记忆模型

- 状态：Superseded by ADR-020
- 决策日期：2026-04-02
- 被取代：ADR-020 (2026-04-17) 重新定义了六层平面模型，使用不同的 TTL 和晋升规则

**注意**：本 ADR 定义的是六层模型（L1-L6），文件名沿用历史路径标识，与 ADR-020 保持一致。架构文档中"六层"描述与本文内容对齐。

## 背景

Automatic Agent 是多总部角色、多事业部、多角色协同系统，记忆既要共享组织知识，又要隔离角色上下文。单 Agent CLI 式记忆模型无法直接适配这种组织结构。

随着 OAPEFLIR 闭环落地，记忆层不再只回答“保存什么”，还要回答：

- 哪些内容进入长期层，哪些只保留在运行时 suffix。
- 哪些上下文可以跨 agent 共享 KV cache。
- 上下文压缩与学习/改进证据链如何协同，而不是互相覆盖。

## 决策

采用六层 memory scope，并把 KV cache 固定前缀视为与 memory 协同但独立的 prompt 基础设施：

1. L1 `runtime`：当前 step / 当前调用的瞬时上下文。
2. L2 `session`：单任务级上下文、plan 进度、近期摘要。
3. L3 `agent`：agent 生命周期内复用的工作记忆与模式。
4. L4 `project`：项目级知识、目录结构、约束与约定。
5. L5 `user`：用户偏好、沟通风格、长期纠正信息。
6. L6 `evolution`：LearningObject、策略经验、失败模式等演化资产。

与之配套，system prompt 额外拆为：

- `fixed_prefix`
- `domain_block`
- `variable_suffix`

其中前两者服务 KV cache 复用，不直接等同于某一层 memory scope。

## 作用域模型

记忆不是全局平铺，而是按作用域分层：

- 全局：用户偏好、全局参考知识、平台级历史。
- 项目：项目上下文、共享目标、运行状态。
- 事业部：事业部经验、术语、专有流程。
- 角色：角色特定经验和最佳实践。

多 Agent 的核心原则：

- 静态提示共享，动态注入隔离。
- 越具体的记忆，访问范围越窄。
- VP 编排拥有更高的全局可见性，事业部角色只看自己需要的部分。

## MVP 范围

分阶段实施：

- Ring 1：优先落 L1/L2，配合 handoff、context compaction、plan 进度管理。
- Ring 2：Observe / Assess / Plan 走显式 DTO，session/project 级引用开始稳定。
- Ring 3：Feedback / Learn 把证据链转为 `LearningObject`，进入 L6；Improve / Release 消费已验证学习对象。
- M2+：再扩展更完整的 Knowledge Plane、Artifact Plane 和更重的长期治理。

这样做的原因：

- 早期最需要的是稳定 prompt 构建、持久指令和会话状态。
- 自动提取、复杂压缩和工具结果管理的工程成本与调用成本都更高。

## 关键实现点

KV cache / prompt base：

- system prompt 拆为 `fixed_prefix`、`domain_block`、`variable_suffix`。
- `fixed_prefix` 可跨 agent 共享缓存。
- `domain_block` 可在同 domain 内复用。
- `variable_suffix` 注入角色、当前任务、plan、记忆摘要和当前执行态。

Layer 2：

- 支持全局、项目、事业部、角色四级加载。
- 条件规则通过路径或角色匹配激活。
- `@include` 支持跨文件复用规则。

Layer 5：

- 不同角色应使用不同模板。
- CEO、VP 运营、VP 编排和事业部角色的记忆段落重点不同。

L1/L2 与 compaction：

- 压缩不能破坏工作流状态、OAPEFLIR 阶段时间线和审批/反馈事实链。
- `FeedbackSignal` / `LearningObject` 摘要属于高优先级 protected parts。
- `fixed_prefix` 不参与普通 compaction。

## 存储建议

至少需要以下持久化结构：

- `memories`：当前实现已包含 `session_id`、`agent_id`、`execution_id`、`memory_layer`、`embedding_ref`
- `memory_extract_cursors`
- `session_memories`
- `tool_result_files`
- `learning_objects`（对应 L6 演化层）

写入策略：

- 高频更新使用防抖或批量写入。
- 采用原子写入避免崩溃时损坏记忆文件。
- 记忆注入必须受 token 预算控制。

## 结果

优点：

- 支持总部与事业部之间的共享和隔离平衡。
- 降低重复上下文注入的 token 浪费。
- 为崩溃恢复、长会话和跨任务经验积累提供基础设施。
- 为多 agent 场景的 KV cache 复用提供清晰边界。

代价：

- 需要额外的存储结构、token 预算和后台异步处理。
- L4/L6 的治理质量直接影响 Learn / Improve 质量。
- KV cache 前缀边界若漂移，会导致缓存命中与行为一致性下降。

## 当前实现对齐

截至当前 phase1-4 交付，已与本 ADR 对齐的部分包括：

- Prompt 分区已支持 `fixed_prefix` / `domain_block` / `variable_suffix` 分层与缓存 key。
- Context compaction 已明确 prefix 不参与普通裁剪。
- Learn 已引入 evidence-backed `LearningObject`，并通过 `promotionStatus` 控制进入 Improve 的边界。
- OAPEFLIR 主链/副链通过阶段时间线可追踪 memory 与 evolution 相关阶段的进入顺序。

## 交叉引用

- [ADR-004 工作流与路由](./004-workflow-routing.md)
- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [ADR-009 部署与运维](./009-deployment-ops.md)

## 来源章节

- `OAPEFLIR §E.2`
- `OAPEFLIR §F`
- `OAPEFLIR §L.3.2`
