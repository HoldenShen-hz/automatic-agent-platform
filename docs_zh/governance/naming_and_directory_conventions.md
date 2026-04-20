# Naming And Directory Conventions

## 1. 目标

统一平台术语、目录命名和文件命名，避免在文档、配置和代码之间出现多套叫法。

## 2. 核心术语

统一使用以下术语：

- `HQ`: 总部层能力
- `division`: 事业部
- `role`: 事业部内角色
- `task`: 任务
- `workflow`: 工作流
- `artifact`: 产出物引用
- `approval`: 审批
- `gateway`: 渠道接入层
- `provider`: 模型供应层

### 2.2 OAPEFLIR 八阶段术语（2026-04-17 新增）

统一使用以下 OAPEFLIR 术语：

| 阶段 | 术语 | 说明 |
|------|------|------|
| O | Observe / Observe Hub | 收集任务/上下文/系统状态 |
| A | Assess / Assess Hub | 预执行风险/复杂度/资源评估 |
| P | Plan / Plan Hub | 基于评估生成执行计划 |
| E | Execute / Execute Hub | 调用 runtime 执行计划 |
| F | Feedback / Feedback Hub | 收集执行结果反馈信号 |
| L | Learn / Learn Hub | 从信号中提取模式/知识 |
| I | Improve / Improve Hub | 评估改进候选 + guardrail |
| R | Rollout / Rollout | 受控发布改进到生产 |

双链拓扑术语：
- `主链`：O→A→P→E→F（实时执行链路）
- `副链`：F→L→I→R（异步改进链路）

避免混用：

- 不把 `division` 写成 `department` 或 `business-unit`。
- 不把 `role`、`agent`、`worker` 在同一语义层混用。
- 不把 `session` 与 `task` 当作同义词。
- 不把 `tenant`、`workspace`、`organization` 当作同义词。

### 2.1 Canonical ID 写法

文档中涉及控制层对象时，统一采用：

- `canonical_id`（业务别名：叙事名称）

例如：

- `strategic_governor`（业务别名：CEO）
- `intake_router`（业务别名：VP 运营）
- `workflow_planner`（业务别名：VP 编排）
- `division_lead`（业务别名：Lead Agent）

## 3. 文件命名规则

- 主干文档采用 `NN_topic.md`。
- ADR 采用 `NNN-topic.md`。
- contract 采用 `snake_case_contract.md`。
- guide 采用 `kebab-case.md`。
- governance / reviews / operations 文档采用 `snake_case.md`。

## 4. 目录命名规则

- 目录统一使用小写字母与连字符或下划线，不使用空格。
- `divisions/<division-id>/` 中 `<division-id>` 必须稳定、可程序引用。
- `roles/` 下的文件名应与 `role_id` 对齐。
- `workflows/` 下的文件名应表达业务动作，而不是作者偏好。

## 5. ID 约定

- `task_id`、`approval_id`、`session_id`、`event_id` 为平台级唯一标识。
- `division_id`、`role_id`、`tool_name` 为稳定可读标识，不依赖显示名称。
- 对外消息 ID 与平台内部 ID 必须分开。

### 5.1 其他命名约定

- 事件类型统一使用 `<domain>.<action>`，如 `workflow.step_completed`。
- OAPEFLIR 事件类型统一使用 `<stage>:<event>`，如 `feedback:collected`、`learning:object_promoted`、`improvement:auto_rollback`。
- 数据库表统一使用复数 `snake_case`。
- 环境变量统一使用 `UPPER_SNAKE_CASE`。
- 配置 key 推荐使用稳定命名空间，如 `runtime.max_concurrency`。
- feature flag 推荐使用 `domain.feature_name` 风格，如 `gateway.enable_stream_bridge`。

### 5.2 OAPEFLIR 模块目录命名

新增模块目录命名遵循以下规则：

| 目录 | 命名 | 说明 |
|------|------|------|
| agent-loop | `agent-loop/` | OapeflirLoopService + Assess + Handoff |
| planning | `planning/` | PlanBuilder + DAG + Replanning |
| feedback | `feedback/` | Collector + Preprocessor + Consumer |
| learning | `learning/` | PatternDetector + Validator + Distillation |
| improvement | `improvement/` | Rollout + AutoRollback + Guardrail |
| knowledge | `knowledge/` | Ingestion + Query + Governance |
| domain-registry | `domain-registry/` | PluginSPI + DomainRegistry |
| plugins | `plugins/` | Domain Plugins + Adapters |

## 6. 文档与代码同步规则

- 新增核心对象时，优先补 contract，再写类型定义。
- 若代码命名与文档命名冲突，先修正文档事实源，再统一代码。
- 禁止为了局部实现方便在代码中发明平行术语。

## 7. 文档写法规则

- 同一章节首次出现叙事名和工程名时，必须同时给出映射。
- 表格、协议、schema、事件注册表优先使用 canonical id。
- 历史层、研究层保留外部项目原名时，应显式标注“非本项目事实源”。
