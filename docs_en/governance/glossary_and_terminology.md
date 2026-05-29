# Glossary And Terminology

## 1. 目标

统一核心术语，避免产品叙事名词、工程实现名词、运lines时对象名词和运维名词互相混淆。

本文件回答 4 个Issue：

- 某个词在本系统里到底is什么意思
- 哪些词容易混用，应该如何区分
- 哪些写法is推荐写法
- 哪些写法应避免出现在 contract、协议、configure和code中

相关文档：

- `../00_document_architecture_and_source_of_truth.md`
- `../contracts/naming_and_engineering_boundary_contract.md`
- `./naming_and_directory_conventions.md`

## 2. uses规则

- 本术语tableis治理层的术语主版本。
- 若主干文档、contract、ADR、guide vs本术语tableconflicts，以对应主题的 authoritative contract 为准，并应随后回写本术语table。
- 若一个名词同时存在产品别名和工程名，defaults to优先uses工程 canonical name。
- 协议、schema、事件、configure、目录、table名中不得usesonly适合产品叙事的别名。

## 3. 核心对象术语

| 术语 | defines | 不应混用为 |
|---|-------|--------|
| `task` | user级工作单元，is系统面向user和业务的最小工作承诺对象 | `session`、`execution` |
| `workflow` | task 的结构化执lines路径，defines step、relies on、输入输出和failed路径 | `task`、`execution` |
| `step` | workflow 中的单个执lines步骤 | `task`、`tool call` |
| `execution` | 某个 task/workflow 的一iterations具体运lines尝试 | `workflow`、`worker` |
| `attempt` | 对同一 execution 或 step 的重试计数/重入序号 | `execution` |
| `session` | 渠道交互会话，承载user输入、流式输出和交互上下文 | `task` |
| `message` | 一iterations完整消息对象，可contains多个 `message part` | `event` |
| `message part` | 消息内部的结构化片段，如文本、tool_use、tool_result、summary | `message` |
| `artifact` | 文件型或二进制产物，通常via artifact store manage | `output`、`step output` |
| `output` | 面向上游步骤或user的结果，可为结构化data或文本，不必is文件 | `artifact` |
| `step output` | 某个 step 完成后的结构化结果快照 | `artifact`、`final result` |
| `result envelope` | 对success、部分success、failed、warning、artifact 和 metrics 的统一结果封装 | 单一 tool result |

## 3A. OAPEFLIR 术语

| 术语 | defines | 不应混用为 |
|---|-------|--------|
| `OAPEFLIR` | `Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release` 八阶段闭环 | 普通 workflow 名称 |
| `stage` | OAPEFLIR 闭环中的阶段级Status单元 | `step` |
| `loop iteration` | 一iterations完整或部分闭环迭代的执lines轮iterations | 单个 tool call |
| `TaskSituation` | Observe 输出的事实快照 | 最终评估结果 |
| `UnifiedAssessment` | Assess 输出的结构化判断 | `TaskSituation` |
| `Plan` | Plan Hub 的显式执lines计划 | workflow defines本身 |
| `FeedbackSignal` | Execute 之后收集到的结构化反馈信号 | 普通 log |
| `LearningObject` | Learn Hub 产出的可复用学习对象 | 单iterations反馈原始record |
| `ImprovementCandidate` | Improve Hub 产出的改进候选 | 已发布策略 |
| `RolloutRecord` | Release 阶段的受控释放record | `ImprovementCandidate` |

## 4. 执linesvs恢复术语

| 术语 | defines | 不应混用为 |
|---|-------|--------|
| `runtime` | 系统实际执lines task / workflow / agent / tool 的运lines层 | `platform` |
| `execution ticket` | 调度层下发给执lines层的正式执lines单据 | 普通任务输入 |
| `lease` | 某iterations execution 或 worker dispatch 的临时所有权 | 永久 ownership |
| `lease owner` | 当前持有执lines权的执lines实体 | `worker` 的物理机器标识 |
| `fencing token` | 防止旧执lines者回写脏结果的版本令牌 | 普通 sequence |
| `dispatch` | 将任务或执lines权分配到某个执lines承载体 | `spawn_agent` |
| `worker` | 执lines承载单元，可为本地或远程 | `agent` |
| `sub-agent` | 在同一任务上下文中协作的iterations级智能执lines单元 | `worker` |
| `heartbeat` | cycle性健康/负载上报 | 真实业务进度 |
| `stalled` | 进程未必死亡，但在规定time内no有效进展 | `offline` |
| `dead-letter` | no法自动恢复或不应继续重试的failed落袋record | 普通 error log |
| `checkpoint` | 可恢复边界上的Status快照 | 任意临时variable |
| `partial result` | 任务尚未整体完成，但已有可保留、可审计的阶段性结果 | `completed` |
| `compensation` | 对已发生副作用的步骤进lines回滚、对账或人工修复的动作 | 普通 retry |

## 5. Statusvs生命cycle术语

### 5.1 生命cycle通用词

| 术语 | defines | 适用对象 |
|---|-------|--------|
| `pending` | Task pre-execution state，已创建但尚未进入调度 | Task |
| `awaiting_decision` | Task waiting for approval，等待审批Decision | Task |
| `prechecking` | Execution pre-validation phase，执lines前校验阶段 | Execution |
| `created` | Execution created state，Execution 已创建 | Execution |
| `queued` | 已创建但尚未开始执lines | Task, Execution |
| `in_progress` | 正在推进主逻辑（Task Status） | Task |
| `executing` | 正在推进主逻辑（Execution Status） | Execution |
| `blocked` | 因relies on未满足、审批、策略或资源原因暂时no法继续 | Execution |
| `paused` | 被显式暂停，可恢复 | Workflow |
| `resuming` | Workflow transition state for resuming from pause，从暂停恢复的过渡Status | Workflow |
| `cancelling` | Workflow transient state before cancelled，终止前的过渡Status | Workflow |
| `streaming` | Session streaming state，会话流式输出中 | Session |
| `open` | Session open state，会话occurrences于开放Status | Session |
| `awaiting_user` | 等待人class或外部系统输入（Session Status） | Session |
| `superseded` | Execution replaced by newer execution，被新 Execution 替代 | Execution |
| `failed` | 执linesfailed且当前尝试终止 | Task, Execution |
| `done` | Task terminal state，Task success结束 | Task |
| `cancelled` | 被显式终止，不再继续 | Task, Workflow |

### 5.2 必须区分的Status词

- `queued` 不is `blocked`
- `blocked` only适used for Execution；Task uses `awaiting_decision` table示等待审批；Workflow uses `paused` table示暂停
- `paused` 不is `awaiting_user`
- `paused` 不is `blocked`
- `stalled` 不is `offline`
- `failed` 不is `cancelled`
- `done` is Task 唯一终端successStatus，不等于”所有下游都已handle完”，应以 authoritative Status机defines为准

### 5.3 终止原因术语

> **实现Description：** `reasonCode` 在 `ExecutionRecord.lastErrorCode` 和 `DeadLetterRecord.finalReasonCode` 字段中is**自由格式字符串**，而非枚举。系统不mandatory标准化码table，call方可writes任意有业务意义的字符串。

| 术语 | defines | class型 |
|---|-------|--------|
| `reasonCode` | 终止原因码，以字符串形式record在 `ExecutionRecord.lastErrorCode` / `DeadLetterRecord.finalReasonCode` 中 | freeform string（非 enum） |
| `termination_initiator` | 触发终止的主体，如 user / system / policy / admin | 语义标签，no正式枚举 |
| `termination_scope` | 终止Impact范围，如 step / workflow / task / session | 语义标签，no正式枚举 |
| `recoverable` | 终止后isno允许走恢复路径 | boolean 语义 |

## 6. 事件vs流式术语

| 术语 | defines | 不应混用为 |
|---|-------|--------|
| `event` | 系统内部的结构化事实通知 | `message` |
| `event type` | 事件class别，推荐 `<domain>.<action>` | DB table名 |
| `tier 1 event` | 必须可靠落库、必须可恢复、不可默默丢失的事件 | 普通 UI event |
| `ack` | 某消费者已确认handle某事件的record，每消费者独立确认，不同消费者可分别ack同一事件 | globally consumed 标志 |
| `replay` | 从内存缓冲中补发事件，持久化事件viadeliverPending()拉取 | live stream |
| `stream` | 面向渠道/UI 的增量输出流 | authoritative event log |
| `stream_id` | 某条展示流的唯一标识，格式为`${channel}_${taskId}_${randomId}`，containstaskId作为组件 | stream_idcontainstaskId组件，不应简单等同于task_id |
| `sequence` | 同一 stream 或同一 event channel 的单调序号 | fencing token |
| `Last-Event-ID` | SSE 客户端声明的断点续流位置 | globally offset |
| `replay buffer` | 为短时断连恢复保留的有限事件窗口 | 持久事件storage |
| `viewer_only` | 只读观察交互态 | 业务failedStatus |

## 7. 组织vs角色术语

### 7.1 控制层 canonical 映射

控制层角色在文档中统一采用”canonical id + 业务别名”的写法。

**实现StatusDescription**：only `intake_router` 和 `workflow_planner` 有实际code实现，`strategic_governor` 和 `division_lead` 为文档defines但未实现为独立服务。

| Canonical ID | 业务别名 | 工程职责 |
|---|-------|--------|
| `strategic_governor` | CEO | 战略判断、升级治理、组织级审批（注：文档defines，code中未实现为独立服务） |
| `intake_router` | VP 运营 | 输入分诊、分class、路由、budget入口 |
| `workflow_planner` | VP 编排 | 跨事业部拆分、relies on图、聚合、failed升级 |
| `division_lead` | Lead Agent | 事业部内 workflow 自治编排（注：文档defines，code中未实现为独立服务） |

推荐写法：

- `intake_router`（业务别名：VP 运营）
- `workflow_planner`（业务别名：VP 编排）

不推荐写法：

- 只写 `VP 编排`
- 在协议和 schema 中directly把 `CEO / VP / Lead` 当作主键

### 7.2 其他组织术语

| 术语 | defines | 不应混用为 |
|---|-------|--------|
| `division` | 业务能力域或事业部边界 | `tenant` |
| `role` | 职责defines，不is运lines实例 | `agent runtime instance` |
| `agent` | 承担角色职责的智能执lines实体 | `worker` |
| `organization` | 企业/组织级边界 | `division` |
| `workspace` | 组织下的工作空间边界 | `session` |
| `tenant` | 隔离、security、配额和计费的主边界 | `organization` |

## 8. securityvs治理术语

| 术语 | defines | 不应混用为 |
|---|-------|--------|
| `policy engine` | 对permission、风险、审批、budget和运lines约束进lines最终裁决的code级入口 | prompt 指令 |
| `approval` / `HITL` | 需要人class显式参vs的Decision步骤 | 一般user回复 |
| `break-glass` | 高风险紧急放linesconfigure标记，critical风险触发break-glass审批class型，但no独立于标准审批的强审计工作流 | 普通审批 |
| `sandbox` | 执lines隔离边界 | 普通 permission prompt |
| `exec policy` | 工具/命令执lines的规则集合 | 高层产品Description |
| `permission` | 某主体可见或可用某能力的authorizationStatus；注意：code中permission概念viaPolicyEngine隐式实现，no独立的Permissionclass型defines | runtime 所有权 |
| `secret` | key、token、凭证等敏感机密 | 普通 config value |
| `secret masking` | 脱敏展示 secret 的方法 | 真正的 secret storage |
| `data classification` | data分级规则，如 public/internal/confidential/restricted | 单纯 label 文本 |
| `audit evidence` | 可追溯、可验证、不可轻易抵赖的lines为证据 | 普通日志 |

## 9. data、storagevs一致性术语

| 术语 | defines | 不应混用为 |
|---|-------|--------|
| `authoritative store` | 对某class事实拥有最终解释权的storage | 任意cache |
| `transaction store` | 负责任务、Status、审批、事件等事务性data的storage。注意：code中no独立命名的transaction store，事务性datastorage于AuthoritativeSqlDatabase | artifact store |
| `artifact store` | storage文件型、大体积或export型产物 | transaction store |
| `analytics store` | 面向投影和物化视图的storage，非独立的分析报tablestorage | authoritative state store |
| `data plane` | （规划中）事务层、artifact、analytics、archive、replay的统一data平面，当前code中no此抽象层 | 单个 DB |
| `namespace` | data、artifact 或 tenant 边界下的逻辑命名空间 | OS path |
| `eventual consistency` | 允许短暂delay后达到一致 | 强一致 |
| `reconciliation` | 对Status、事件、worker、locks 等做对账修复 | 普通 retry |
| `migration` | schema 或storage结构的正式版本迁移 | ad-hoc SQL patch |

### 9.1 OAPEFLIR 演化Status词

| 术语 | defines |
| --- | --- |
| `promotion_status` | LearningObject 的推广Status，当前最小集合为 `draft / validated / promoted / retired` |
| `candidate_status` | ImprovementCandidate 的Status，当前最小集合为 `proposed / evaluating / approved / shadow_running / rejected / rolled_back` |
| `rollout_status` | RolloutRecord 的Status，当前最小集合为 `draft / pending_approval / shadow / canary_5 / partial_25 / partial_50 / partial_75 / stable / rejected / rolled_back / paused` |
| `guardrail_reason_code` | deterministic guardrail 给出的放lines/阻断原因码 |

## 10. configure、版本vs兼容术语

| 术语 | defines |
| --- | --- |
| `config bundle` | 一组一起生效的configure集合 |
| `config version` | configure变更后的版本标识 |
| `feature flag` | 控制能力启停或灰度的开关 |
| `prompt bundle` | 一组一起发布、一起版本化的 prompts |
| `compatibility window` | 不同 runtime / SDK / protocol / plugin 之间被正式supported的兼容区间 |
| `promote criteria` | 某模块从可用提升到 platform-ready / production-ready 的证据门槛 |
| `readiness registry` | record环境或模块 readiness Status的正式注册面 |
| `evidence package` | used for支撑 promote / signoff / production-ready 判断的一组证据包 |

### 10.1 Prompt / Cache 分区术语

| 术语 | defines |
| --- | --- |
| `fixed_prefix` | 跨 agent 共享的 system prompt 固定前缀，defaults to不参vs普通 compaction |
| `domain_block` | 同 domain / profile 可复用的 prompt 中间层 |
| `variable_suffix` | 按任务、角色、plan、memory dynamically变化的 prompt 后缀 |
| `KV cache fixed prefix` | based on相同 prefix hash 的预填充cache复用机制 |

## 11. 测试、验证vs稳定化术语

| 术语 | defines |
| --- | --- |
| `Stable Core` | 为先达到可稳定运lines而刻意收缩后的最小能力范围 |
| `golden task` | 作为版本回归基线的固定代table任务 |
| `fixture` | 预置的固定输入/输出样本，used for稳定测试 |
| `VCR` | 对外部call做录制/回放的测试机制 |
| `unit test` | 面向单function、单模块、单对象的细粒度测试 |
| `integration test` | 跨模块协同的测试 |
| `E2E` | 从入口到结果的端到端测试 |
| `chaos test` | 主动注入故障以验证恢复vs韧性的测试 |
| `soak test` | 长time持续运lines的稳定性测试 |
| `recovery drill` | 针对崩溃、断连、锁conflicts、重启等场景的恢复演练 |
| `admission control` | 系统在过载前进lines拒绝、delay或降级的准入控制 |
| `readiness` | 某阶段、模块或环境isno达到进入下一动作的准备度 |

## 12. 可观测性vs运维术语

| 术语 | defines |
| --- | --- |
| `structured log` | 结构化、可检索、带上下文字段的日志 |
| `trace` | 一iterations任务跨模块执lines链路的globally追踪 |
| `span` | trace 中的单个操作区段 |
| `correlation id` | used for跨模块关联日志/事件/request的统一标识 |
| `healthz` | 最小健康检查入口 |
| `inspect` | 面向任务、execution、session、worker 的调试查询视图 |
| `backpressure` | 系统在过载时delay、降级或拒绝新request的机制 |
| `runbook` | 值班vs故障handle手册 |
| `SLO` | 服务目标，如success率、delay、恢复time |
| `SLA` | 对外承诺的服务等级协议 |
| `error budget` | SLO 可accepts的failedbudget |
| `soak test` | 长time连续稳定性测试（注：当前only作为集成测试实现，非生产环境监控服务） |
| `RCA` | 事故Root Cause分析（注：当前为人工流程，code中no自动RCA服务） |
| `RTO` | Recovery Time Objective，恢复time目标（注：only在DR验证工作流中references用，no独立跟踪服务） |
| `RPO` | 可acceptsdata回退点目标（注：only在DR验证工作流中references用，no独立跟踪服务） |

## 13. 渠道、扩展vs外部集成术语

| 术语 | defines |
| --- | --- |
| `channel` | user或系统接入界面，如 CLI、Web、Telegram、API（注：code中only实现telegram/slack/webhook，CLI/Web/API非ChannelGateway渠道） |
| `channel capability` | 某渠道supported的能力，如 text、button、stream、attachment（注意：code中no对应的能力枚举class型defines） |
| `plugin` | via公共 SDK 或受控边界扩展平台能力的安装单元 |
| `skill` | 对工具或步骤的可复用编排能力 |
| `MCP` | 外部能力接入协议/扩展class型之一（MCP工具viamcp-tool-guard验证，但未作为PluginSpiTypedefines） |
| `recipe` / `template` | 结构化工作流或模板defines，可作为 workflow 作者输入层 |
| `provider` | LLM 或模型能力提供方 |
| `model profile` | 某模型的能力、限制、价格、defaults to参数等元data |

## 14. 协议、模型vssecurity缩写

| 术语 | defines |
| --- | --- |
| `ADR` | Architecture Decision Record，ArchitectureDecisionrecord |
| `API` | 应用编程接口，指正式对外或模块间Interface Plane |
| `SDK` | 软件开发工具包，通常由 authoritative schema 或 protocol 派生 |
| `DSL` | 领域专用语言，如 workflow DSL |
| `DDL` | datadefines语言，常指建table、索references、约束迁移语句 |
| `WAL` | Write-Ahead Logging，SQLite/data库的预写日志模式 |
| `MCP` | Model Context Protocol 或本系统中的外部能力接入协议class型 |
| `HITL` | Human In The Loop，需要人class参vs的Decision环节 |
| `PII` | Personally Identifiable Information，可识别个人信息 |
| `TTL` | Time To Live，data或cache的有效时长 |
| `DLQ` | Dead Letter Queue / dead-letter storage，used for承接no法继续handle的消息或任务 |
| `HA` | High Availability，高可用 |
| `DR` | Disaster Recovery，容灾恢复 |
| `OIDC` | OpenID Connect，used for身份authentication联邦 |
| `SSO` | Single Sign-On，单点登录 |
| `SCIM` | uservs组织身份synchronous协议 |
| `RLS` | Row-Level Security，lines级security隔离 |
| `SBOM` | Software Bill of Materials，软件物料清单 |

补充规则：

- 缩写词首iterations在主干文档中出现时，Recommendation至少给出一iterations全称或中文释义。
- 缩写词不得替代 authoritative contract 中对对象边界的正式defines。

## 15. 容易混用的术语对

### 15.1 `task` vs `session`

- `task` is业务工作单元
- `session` is交互会话
- 一个 session 可以触发多个 task
- 一个 task 也可能跨多个 session 更新Status

### 15.2 `workflow` vs `execution`

- `workflow` is结构
- `execution` is某iterations运lines尝试
- 同一 workflow 可以对应多个 execution attempt

### 15.3 `agent` vs `worker`

- `agent` 偏职责vs智能体
- `worker` 偏执lines承载vs资源位
- `sub-agent` 不is远程 worker 的同义词

### 15.4 `artifact` vs `output` vs `step output`

- `artifact` 偏文件产物
- `output` 偏结果语义
- `step output` 偏步骤级结构化快照

### 15.5 `permission` vs `policy`

- `permission` isauthorization结果或静态能力边界
- `policy` is裁决逻辑vs规则体系
- 不应把 prompt 中的口头限制当作正式 policy

### 15.6 `queue` vs `lease`

- `queue` 决定等待顺序
- `lease` 决定当前执lines权
- 两者都存在时，不应互相替代

### 15.7 `readiness` vs `production-ready`

- `readiness` table示达到某个 gate 或下一动作的准备度
- `production-ready` table示已达到生产托底所需的综合门槛
- `Phase 1a ready` 不得被误读为 `production-ready`

### 15.8 `signoff` vs `completion gate`

- `signoff` is当前 revision 的评审Conclusion
- `completion gate` is进入 coding 前必须再iterations执lines的门槛检查
- 不应把一iterations signoff Conclusion当作永久通lines证

### 15.9 `provider` vs `model`

- `provider` is服务提供方
- `model` is provider 提供的具体模型
- `model profile` is模型元data，不等于 provider profile

## 16. 命名principle

- 对外叙事可保留 CEO / VP / Lead。
- 对内实现优先uses中性工程名词，如 `router`、`planner`、`orchestrator`、`supervisor`。
- 一份文档里若同时出现叙事名词和工程名词，应明确一一映射。
- schema、事件、configure、目录、table名defaults touses canonical 工程名。

## 17. 推荐命名格式

| 对象 | 推荐格式 | 示例 |
|---|-------|--------|
| role / agent id | `snake_case` | `workflow_planner` |
| division id | `kebab-case` 或稳定 `snake_case`，全文保持一致 | `coding-lab` |
| event type | `<domain>.<action>` | `task.status_changed` |
| DB table | 复数 `snake_case` | `event_consumer_acks` |
| env var | `UPPER_SNAKE_CASE` | `OPENAI_API_KEY` |
| config key | 命名空间 + 稳定 key | `runtime.max_concurrency` |
| feature flag | 领域前缀 + 功能名 | `runtime.enable_compaction` |
| protocol params / response | `PascalCase` type 名 + `camelCase` 字段名 | `TurnStartParams` |

## 18. 禁止性写法

- 不在 schema enum 中directlyuses `CEO / VP / Lead`
- 不把 `session` 当作 `task` 的替代名
- 不把 `worker` 当作 `agent` 的唯一实现名
- 不把 `artifact` 泛化成所有 output
- 不把 UI 展示态当成 authoritative Status机
- 不把 prompt 里的Description性限制写成“已via存在的code级 policy”
- 不把 `ready` directly写成 `production-ready` 的同义词
- 不把一iterations `signoff` Conclusion写成永久有效的Status
- 不把缩写词当成唯一解释，导致读者no法回到正式defines
- 不把 `provider`、`model`、`profile` 三个层级混成一个对象

## 19. 收口Conclusion

术语统一的目标不is去掉产品table达，而is避免工程实现时的语义漂移。

从现在起：

- 讲Architecture时可以有叙事名
- 写 contract、schema、事件、configure和code时必须优先uses canonical 工程名
- 出现歧义时，应优先回到本术语table和对应 authoritative contract 收口
