# Glossary And Terminology

## 1. 目标

统一核心术语，避免产品叙事名词、工程实现名词、运行时对象名词和运维名词互相混淆。

本文件回答 4 个问题：

- 某个词在本系统里到底是什么意思
- 哪些词容易混用，应该如何区分
- 哪些写法是推荐写法
- 哪些写法应避免出现在 contract、协议、配置和代码中

相关文档：

- `../00_document_architecture_and_source_of_truth.md`
- `../contracts/naming_and_engineering_boundary_contract.md`
- `./naming_and_directory_conventions.md`

## 2. 使用规则

- 本术语表是治理层的术语主版本。
- 若主干文档、contract、ADR、guide 与本术语表冲突，以对应主题的 authoritative contract 为准，并应随后回写本术语表。
- 若一个名词同时存在产品别名和工程名，默认优先使用工程 canonical name。
- 协议、schema、事件、配置、目录、表名中不得使用仅适合产品叙事的别名。

## 3. 核心对象术语

| 术语 | 定义 | 不应混用为 |
| --- | --- | --- |
| `task` | 用户级工作单元，是系统面向用户和业务的最小工作承诺对象 | `session`、`execution` |
| `workflow` | task 的结构化执行路径，定义 step、依赖、输入输出和失败路径 | `task`、`execution` |
| `step` | workflow 中的单个执行步骤 | `task`、`tool call` |
| `execution` | 某个 task/workflow 的一次具体运行尝试 | `workflow`、`worker` |
| `attempt` | 对同一 execution 或 step 的重试计数/重入序号 | `execution` |
| `session` | 渠道交互会话，承载用户输入、流式输出和交互上下文 | `task` |
| `message` | 一次完整消息对象，可包含多个 `message part` | `event` |
| `message part` | 消息内部的结构化片段，如文本、tool_use、tool_result、summary | `message` |
| `artifact` | 文件型或二进制产物，通常通过 artifact store 管理 | `output`、`step output` |
| `output` | 面向上游步骤或用户的结果，可为结构化数据或文本，不必是文件 | `artifact` |
| `step output` | 某个 step 完成后的结构化结果快照 | `artifact`、`final result` |
| `result envelope` | 对成功、部分成功、失败、warning、artifact 和 metrics 的统一结果封装 | 单一 tool result |

## 3A. OAPEFLIR 术语

| 术语 | 定义 | 不应混用为 |
| --- | --- | --- |
| `OAPEFLIR` | `Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release` 八阶段闭环 | 普通 workflow 名称 |
| `stage` | OAPEFLIR 闭环中的阶段级状态单元 | `step` |
| `loop iteration` | 一次完整或部分闭环迭代的执行轮次 | 单个 tool call |
| `TaskSituation` | Observe 输出的事实快照 | 最终评估结果 |
| `UnifiedAssessment` | Assess 输出的结构化判断 | `TaskSituation` |
| `Plan` | Plan Hub 的显式执行计划 | workflow 定义本身 |
| `FeedbackSignal` | Execute 之后收集到的结构化反馈信号 | 普通 log |
| `LearningObject` | Learn Hub 产出的可复用学习对象 | 单次反馈原始记录 |
| `ImprovementCandidate` | Improve Hub 产出的改进候选 | 已发布策略 |
| `RolloutRecord` | Release 阶段的受控释放记录 | `ImprovementCandidate` |

## 4. 执行与恢复术语

| 术语 | 定义 | 不应混用为 |
| --- | --- | --- |
| `runtime` | 系统实际执行 task / workflow / agent / tool 的运行层 | `platform` |
| `execution ticket` | 调度层下发给执行层的正式执行单据 | 普通任务输入 |
| `lease` | 某次 execution 或 worker dispatch 的临时所有权 | 永久 ownership |
| `lease owner` | 当前持有执行权的执行实体 | `worker` 的物理机器标识 |
| `fencing token` | 防止旧执行者回写脏结果的版本令牌 | 普通 sequence |
| `dispatch` | 将任务或执行权分配到某个执行承载体 | `spawn_agent` |
| `worker` | 执行承载单元，可为本地或远程 | `agent` |
| `sub-agent` | 在同一任务上下文中协作的次级智能执行单元 | `worker` |
| `heartbeat` | 周期性健康/负载上报 | 真实业务进度 |
| `stalled` | 进程未必死亡，但在规定时间内无有效进展 | `offline` |
| `dead-letter` | 无法自动恢复或不应继续重试的失败落袋记录 | 普通 error log |
| `checkpoint` | 可恢复边界上的状态快照 | 任意临时变量 |
| `partial result` | 任务尚未整体完成，但已有可保留、可审计的阶段性结果 | `completed` |
| `compensation` | 对已发生副作用的步骤进行回滚、对账或人工修复的动作 | 普通 retry |

## 5. 状态与生命周期术语

### 5.1 生命周期通用词

| 术语 | 定义 |
| --- | --- |
| `queued` | 已创建但尚未开始执行 |
| `running` / `executing` | 正在推进主逻辑 |
| `blocked` | 因依赖未满足、审批、策略或资源原因暂时无法继续 |
| `paused` | 被显式暂停，可恢复 |
| `waiting_input` | 等待人类或外部系统输入 |
| `throttled` | 因背压、限流或预算原因被延迟 |
| `cancelled` | 被显式终止，不再继续 |
| `failed` | 执行失败且当前尝试终止 |
| `completed` | 本次对象生命周期已成功结束 |

### 5.2 必须区分的状态词

- `queued` 不是 `blocked`
- `blocked` 不是 `paused`
- `paused` 不是 `waiting_input`
- `stalled` 不是 `offline`
- `failed` 不是 `cancelled`
- `completed` 不等于“所有下游都已处理完”，应以 authoritative 状态机定义为准

### 5.3 终止原因术语

| 术语 | 定义 |
| --- | --- |
| `termination_reason_code` | 标准化终止原因码 |
| `termination_initiator` | 触发终止的主体，如 user / system / policy / admin |
| `termination_scope` | 终止影响范围，如 step / workflow / task / session |
| `recoverable` | 终止后是否允许走恢复路径 |

## 6. 事件与流式术语

| 术语 | 定义 | 不应混用为 |
| --- | --- | --- |
| `event` | 系统内部的结构化事实通知 | `message` |
| `event type` | 事件类别，推荐 `<domain>.<action>` | DB 表名 |
| `tier 1 event` | 必须可靠落库、必须可恢复、不可默默丢失的事件 | 普通 UI event |
| `ack` | 某消费者已确认处理某事件的记录 | 全局 consumed 标志 |
| `replay` | 从历史缓冲或持久存储中补发事件 | live stream |
| `stream` | 面向渠道/UI 的增量输出流 | authoritative event log |
| `stream_id` | 某条展示流的唯一标识 | `task_id` |
| `sequence` | 同一 stream 或同一 event channel 的单调序号 | fencing token |
| `Last-Event-ID` | SSE 客户端声明的断点续流位置 | 全局 offset |
| `replay buffer` | 为短时断连恢复保留的有限事件窗口 | 持久事件存储 |
| `viewer_only` | 只读观察交互态 | 业务失败状态 |

## 7. 组织与角色术语

### 7.1 控制层 canonical 映射

控制层角色在文档中统一采用“canonical id + 业务别名”的写法。

| Canonical ID | 业务别名 | 工程职责 |
| --- | --- | --- |
| `strategic_governor` | CEO | 战略判断、升级治理、组织级审批 |
| `intake_router` | VP 运营 | 输入分诊、分类、路由、预算入口 |
| `workflow_planner` | VP 编排 | 跨事业部拆分、依赖图、聚合、失败升级 |
| `division_lead` | Lead Agent | 事业部内 workflow 自治编排 |

推荐写法：

- `intake_router`（业务别名：VP 运营）
- `workflow_planner`（业务别名：VP 编排）

不推荐写法：

- 只写 `VP 编排`
- 在协议和 schema 中直接把 `CEO / VP / Lead` 当作主键

### 7.2 其他组织术语

| 术语 | 定义 | 不应混用为 |
| --- | --- | --- |
| `division` | 业务能力域或事业部边界 | `tenant` |
| `role` | 职责定义，不是运行实例 | `agent runtime instance` |
| `agent` | 承担角色职责的智能执行实体 | `worker` |
| `organization` | 企业/组织级边界 | `division` |
| `workspace` | 组织下的工作空间边界 | `session` |
| `tenant` | 隔离、安全、配额和计费的主边界 | `organization` |

## 8. 安全与治理术语

| 术语 | 定义 | 不应混用为 |
| --- | --- | --- |
| `policy engine` | 对权限、风险、审批、预算和运行约束进行最终裁决的代码级入口 | prompt 指令 |
| `approval` / `HITL` | 需要人类显式参与的决策步骤 | 一般用户回复 |
| `break-glass` | 高风险紧急放行流程，必须强审计 | 普通审批 |
| `sandbox` | 执行隔离边界 | 普通 permission prompt |
| `exec policy` | 工具/命令执行的规则集合 | 高层产品说明 |
| `permission` | 某主体可见或可用某能力的授权状态 | runtime 所有权 |
| `secret` | 密钥、token、凭证等敏感机密 | 普通 config value |
| `secret masking` | 脱敏展示 secret 的方法 | 真正的 secret 存储 |
| `data classification` | 数据分级规则，如 public/internal/confidential/restricted | 单纯 label 文本 |
| `audit evidence` | 可追溯、可验证、不可轻易抵赖的行为证据 | 普通日志 |

## 9. 数据、存储与一致性术语

| 术语 | 定义 | 不应混用为 |
| --- | --- | --- |
| `authoritative store` | 对某类事实拥有最终解释权的存储 | 任意缓存 |
| `transaction store` | 负责任务、状态、审批、事件等事务性数据的存储 | artifact store |
| `artifact store` | 存储文件型、大体积或导出型产物 | transaction store |
| `analytics store` | 面向统计、报表和趋势分析的存储 | authoritative state store |
| `data plane` | 事务层、artifact、analytics、archive、replay 的统一数据平面 | 单个 DB |
| `namespace` | 数据、artifact 或 tenant 边界下的逻辑命名空间 | OS path |
| `eventual consistency` | 允许短暂延迟后达到一致 | 强一致 |
| `reconciliation` | 对状态、事件、worker、locks 等做对账修复 | 普通 retry |
| `migration` | schema 或存储结构的正式版本迁移 | ad-hoc SQL patch |

### 9.1 OAPEFLIR 演化状态词

| 术语 | 定义 |
| --- | --- |
| `promotion_status` | LearningObject 的推广状态，当前最小集合为 `draft / validated / promoted / retired` |
| `candidate_status` | ImprovementCandidate 的状态，当前最小集合为 `proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| `rollout_status` | RolloutRecord 的状态，当前最小集合为 `pending / active / completed / blocked / rolled_back` |
| `guardrail_reason_code` | deterministic guardrail 给出的放行/阻断原因码 |

## 10. 配置、版本与兼容术语

| 术语 | 定义 |
| --- | --- |
| `config bundle` | 一组一起生效的配置集合 |
| `config version` | 配置变更后的版本标识 |
| `feature flag` | 控制能力启停或灰度的开关 |
| `prompt bundle` | 一组一起发布、一起版本化的 prompts |
| `compatibility window` | 不同 runtime / SDK / protocol / plugin 之间被正式支持的兼容区间 |
| `promote criteria` | 某模块从可用提升到 platform-ready / production-ready 的证据门槛 |
| `readiness registry` | 记录环境或模块 readiness 状态的正式注册面 |
| `evidence package` | 用于支撑 promote / signoff / production-ready 判断的一组证据包 |

### 10.1 Prompt / Cache 分区术语

| 术语 | 定义 |
| --- | --- |
| `fixed_prefix` | 跨 agent 共享的 system prompt 固定前缀，默认不参与普通 compaction |
| `domain_block` | 同 domain / profile 可复用的 prompt 中间层 |
| `variable_suffix` | 按任务、角色、plan、memory 动态变化的 prompt 后缀 |
| `KV cache fixed prefix` | 基于相同 prefix hash 的预填充缓存复用机制 |

## 11. 测试、验证与稳定化术语

| 术语 | 定义 |
| --- | --- |
| `Stable Core` | 为先达到可稳定运行而刻意收缩后的最小能力范围 |
| `golden task` | 作为版本回归基线的固定代表任务 |
| `fixture` | 预置的固定输入/输出样本，用于稳定测试 |
| `VCR` | 对外部调用做录制/回放的测试机制 |
| `unit test` | 面向单函数、单模块、单对象的细粒度测试 |
| `integration test` | 跨模块协同的测试 |
| `E2E` | 从入口到结果的端到端测试 |
| `chaos test` | 主动注入故障以验证恢复与韧性的测试 |
| `soak test` | 长时间持续运行的稳定性测试 |
| `recovery drill` | 针对崩溃、断连、锁冲突、重启等场景的恢复演练 |
| `admission control` | 系统在过载前进行拒绝、延迟或降级的准入控制 |
| `readiness` | 某阶段、模块或环境是否达到进入下一动作的准备度 |

## 12. 可观测性与运维术语

| 术语 | 定义 |
| --- | --- |
| `structured log` | 结构化、可检索、带上下文字段的日志 |
| `trace` | 一次任务跨模块执行链路的全局追踪 |
| `span` | trace 中的单个操作区段 |
| `correlation id` | 用于跨模块关联日志/事件/请求的统一标识 |
| `healthz` | 最小健康检查入口 |
| `inspect` | 面向任务、execution、session、worker 的调试查询视图 |
| `backpressure` | 系统在过载时延迟、降级或拒绝新请求的机制 |
| `runbook` | 值班与故障处理手册 |
| `SLO` | 服务目标，如成功率、延迟、恢复时间 |
| `SLA` | 对外承诺的服务等级协议 |
| `error budget` | SLO 可接受的失败预算 |
| `soak test` | 长时间连续稳定性测试 |
| `RCA` | Root Cause Analysis，事故根因分析 |
| `RTO` | Recovery Time Objective，恢复时间目标 |
| `RPO` | Recovery Point Objective，可接受数据回退点目标 |

## 13. 渠道、扩展与外部集成术语

| 术语 | 定义 |
| --- | --- |
| `channel` | 用户或系统接入界面，如 CLI、Web、Telegram、API |
| `channel capability` | 某渠道支持的能力，如 text、button、stream、attachment |
| `plugin` | 通过公共 SDK 或受控边界扩展平台能力的安装单元 |
| `skill` | 对工具或步骤的可复用编排能力 |
| `MCP` | 外部能力接入协议/扩展类型之一 |
| `recipe` / `template` | 结构化工作流或模板定义，可作为 workflow 作者输入层 |
| `provider` | LLM 或模型能力提供方 |
| `model profile` | 某模型的能力、限制、价格、默认参数等元数据 |

## 14. 协议、模型与安全缩写

| 术语 | 定义 |
| --- | --- |
| `ADR` | Architecture Decision Record，架构决策记录 |
| `API` | 应用编程接口，指正式对外或模块间接口面 |
| `SDK` | 软件开发工具包，通常由 authoritative schema 或 protocol 派生 |
| `DSL` | 领域专用语言，如 workflow DSL |
| `DDL` | 数据定义语言，常指建表、索引、约束迁移语句 |
| `WAL` | Write-Ahead Logging，SQLite/数据库的预写日志模式 |
| `MCP` | Model Context Protocol 或本系统中的外部能力接入协议类型 |
| `HITL` | Human In The Loop，需要人类参与的决策环节 |
| `PII` | Personally Identifiable Information，可识别个人信息 |
| `TTL` | Time To Live，数据或缓存的有效时长 |
| `DLQ` | Dead Letter Queue / dead-letter 存储，用于承接无法继续处理的消息或任务 |
| `HA` | High Availability，高可用 |
| `DR` | Disaster Recovery，容灾恢复 |
| `OIDC` | OpenID Connect，用于身份认证联邦 |
| `SSO` | Single Sign-On，单点登录 |
| `SCIM` | 用户与组织身份同步协议 |
| `RLS` | Row-Level Security，行级安全隔离 |
| `SBOM` | Software Bill of Materials，软件物料清单 |

补充规则：

- 缩写词首次在主干文档中出现时，建议至少给出一次全称或中文释义。
- 缩写词不得替代 authoritative contract 中对对象边界的正式定义。

## 15. 容易混用的术语对

### 13.1 `task` vs `session`

- `task` 是业务工作单元
- `session` 是交互会话
- 一个 session 可以触发多个 task
- 一个 task 也可能跨多个 session 更新状态

### 13.2 `workflow` vs `execution`

- `workflow` 是结构
- `execution` 是某次运行尝试
- 同一 workflow 可以对应多个 execution attempt

### 13.3 `agent` vs `worker`

- `agent` 偏职责与智能体
- `worker` 偏执行承载与资源位
- `sub-agent` 不是远程 worker 的同义词

### 13.4 `artifact` vs `output` vs `step output`

- `artifact` 偏文件产物
- `output` 偏结果语义
- `step output` 偏步骤级结构化快照

### 13.5 `permission` vs `policy`

- `permission` 是授权结果或静态能力边界
- `policy` 是裁决逻辑与规则体系
- 不应把 prompt 中的口头限制当作正式 policy

### 13.6 `queue` vs `lease`

- `queue` 决定等待顺序
- `lease` 决定当前执行权
- 两者都存在时，不应互相替代

### 15.7 `readiness` vs `production-ready`

- `readiness` 表示达到某个 gate 或下一动作的准备度
- `production-ready` 表示已达到生产托底所需的综合门槛
- `Phase 1a ready` 不得被误读为 `production-ready`

### 15.8 `signoff` vs `completion gate`

- `signoff` 是当前 revision 的评审结论
- `completion gate` 是进入 coding 前必须再次执行的门槛检查
- 不应把一次 signoff 结论当作永久通行证

### 15.9 `provider` vs `model`

- `provider` 是服务提供方
- `model` 是 provider 提供的具体模型
- `model profile` 是模型元数据，不等于 provider profile

## 16. 命名原则

- 对外叙事可保留 CEO / VP / Lead。
- 对内实现优先使用中性工程名词，如 `router`、`planner`、`orchestrator`、`supervisor`。
- 一份文档里若同时出现叙事名词和工程名词，应明确一一映射。
- schema、事件、配置、目录、表名默认使用 canonical 工程名。

## 17. 推荐命名格式

| 对象 | 推荐格式 | 示例 |
| --- | --- | --- |
| role / agent id | `snake_case` | `workflow_planner` |
| division id | `kebab-case` 或稳定 `snake_case`，全文保持一致 | `coding-lab` |
| event type | `<domain>.<action>` | `task.status_changed` |
| DB table | 复数 `snake_case` | `event_consumer_acks` |
| env var | `UPPER_SNAKE_CASE` | `OPENAI_API_KEY` |
| config key | 命名空间 + 稳定 key | `runtime.max_concurrency` |
| feature flag | 领域前缀 + 功能名 | `runtime.enable_compaction` |
| protocol params / response | `PascalCase` type 名 + `camelCase` 字段名 | `TurnStartParams` |

## 18. 禁止性写法

- 不在 schema enum 中直接使用 `CEO / VP / Lead`
- 不把 `session` 当作 `task` 的替代名
- 不把 `worker` 当作 `agent` 的唯一实现名
- 不把 `artifact` 泛化成所有 output
- 不把 UI 展示态当成 authoritative 状态机
- 不把 prompt 里的描述性限制写成“已经存在的代码级 policy”
- 不把 `ready` 直接写成 `production-ready` 的同义词
- 不把一次 `signoff` 结论写成永久有效的状态
- 不把缩写词当成唯一解释，导致读者无法回到正式定义
- 不把 `provider`、`model`、`profile` 三个层级混成一个对象

## 19. 收口结论

术语统一的目标不是去掉产品表达，而是避免工程实现时的语义漂移。

从现在起：

- 讲架构时可以有叙事名
- 写 contract、schema、事件、配置和代码时必须优先使用 canonical 工程名
- 出现歧义时，应优先回到本术语表和对应 authoritative contract 收口
