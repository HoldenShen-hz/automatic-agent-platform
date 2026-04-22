# Current Todo List

> 当前短期执行清单。
> 本文件用于把 [implementation_plan.md](./implementation_plan.md) 的阶段边界、[operations-roadmap.md](./operations-roadmap.md) 的顺序依赖，收敛成“接下来连续实现什么”的唯一活动入口。

## 1. 本轮锁定范围

按 [../architecture/00-platform-architecture.md](../architecture/00-platform-architecture.md) 当前版本锁定以下执行边界：

- 实现 `Phase 1` ~ `Phase 8c` 的全平台能力。
- 实现 `Phase 9` 的 24 个垂直业务域 baseline。
- `S1` ~ `S3` 必须仓内可运行、可测试。
- `S4` 只做正式模块、契约、调度、部署与测试替身，不伪造本地单机无法真实闭环的基础设施。
- 对外兼容优先：保留现有 CLI / API / 关键启动路径，内部迁到 canonical 边界。

## 2. 当前总目标

把当前仓库从“已有大量能力，但入口、边界、阶段口径不统一”的状态，推进到：

1. 根入口、七层架构、五平面、应用装配、平台 surface catalog 全部 canonical 化。
2. `platform / domains / interaction / org-governance / scale-ecosystem / ops-maturity / plugins / sdk / apps` 九大顶层模块全部具备稳定入口与正式依赖面。
3. 五平面核心链路按文档闭环：`Request → Control → Orchestration → Execution → Evidence → Feedback/Learn/Improve`。
4. 24 个域全部具备可注册、可治理、可评测、可 rollout 的 baseline，而不是只有空目录。

## 3. 当前主线工作包

### W0. 架构内核与入口收口

状态：`done`

- 收口 `src/index.ts` 为唯一平台根入口。
- 固化 `platform-architecture-bootstrap`、`platform-application-kernel`、`platform-module-catalog`。
- 固化 `summary / demo / api / console / worker` 五类 startup target。
- 统一 `apps/*` 的 `PlatformAppManifest`：`requiredLayers / startupCommand / startupMode` 全部显式化。
- 把 `platform/*` 主平面的 canonical `index.ts` 补齐并修正 type/value 导出错误。

完成定义：

- `src/index.ts` 与 `src/platform/index.ts` 可直接 import。
- `AA_PLATFORM_ENTRY_MODE=summary|api|console|worker` 都能输出稳定结果。
- 架构与目录守护测试稳定通过。

### W1. 五平面主链收口

状态：`done`

- `P1 Interface Plane`：统一 `api / webhook / scheduler / console-backend / ingress` 的入口装配与 facade。
- `P2 Control Plane`：统一 `approval / config / iam / incident / policy / rollout / tenant / risk` 的入口和注册。
- `P3 Orchestration Plane`：统一 `agent-delegation / escalation / hitl / oapeflir / planner / replan / routing`。
- `P4 Execution Plane`：统一 `dispatcher / distributed-lock / execution-engine / ha / lease / queue / recovery / worker-pool / tool-executor`。
- `P5 State & Evidence Plane`：统一 `truth / events / projections / audit / artifacts / memory / knowledge / checkpoints / dlq / incident`。

完成定义：

- 五平面全部从各自 canonical entry 暴露主能力。
- 关键 CLI / API / service 不再依赖深层非 canonical 文件作为主入口。
- 导出面相关测试、路径测试、结构测试无红项。

### W2. AI 运营层与 Harness 收口

状态：`done`

- `model-gateway`：provider registry、routing、fallback、degradation、cost tracker、message model 完整化。
- `prompt-engine`：registry、renderer、rollout、eval、traffic split、governance 完整化。
- `platform/compliance`：erasure、residency、crypto-shredding、lineage 全部纳入 canonical surface。
- Harness `Phase 8a-8c` 能力并入主链：ConstraintPack、HarnessRun、Planner→Generator→Evaluator→Loop、长时任务、人机协作、治理与评测。

完成定义：

- AI 运营层与 Harness 不再是散落能力，而是正式挂接到平台主链。
- 风险、评测、回滚、证据、prompt / model 治理可以走全链路测试。

### W3. 智能交互与组织治理收口

状态：`done`

- `interaction`：NL 入口、目标分解、主动式 Agent、渐进式自主权、统一看板、非技术用户体验。
- `org-governance`：组织模型、审批路由、SSO / SCIM、知识边界、分级治理委托、部门合规策略。
- `Phase 5` 的“智能交互 + 组织治理 + 域接入框架”全部映射到实际代码与可运行服务。

完成定义：

- 用户入口到治理动作的链路跑通。
- 自主权升级 / 降级、组织审批、知识边界、SSO/SCIM 等具备正式 service 和定向测试。

### W4. 规模化生态与运营成熟度收口

状态：`todo`

- `scale-ecosystem`：multi-region、resource-manager、sla-engine、marketplace、feedback-loop、integration 全部进入正式 catalog。
- `ops-maturity`：可解释性、紧急制动、生命周期、边缘运行、漂移检测、成本优化、工作流调试器、合规报告、容量规划、多模态、平台自运维 Agent。
- `S1-S3` 落地为仓内可运行基线；`S4` 落地为接口、部署与测试替身基线。

完成定义：

- 平台具备从可靠运行到规模化治理的正式扩展面。
- 相关 golden / contract / integration / performance 基线可执行。

### W5. 24 域 baseline 全量落地

状态：`in_progress`

按 `Phase 9a` ~ `9f` 线性推进，每个域都必须具备：

- `DomainDescriptor`
- `DomainRiskProfile`
- `DomainKnowledgeSchema`
- `DomainEvalFramework`
- `DomainPromptLibrary`
- `DomainRecipe`
- `DomainInteractionPolicy`
- `DomainGovernancePolicy`
- registry / onboarding / smoke test / rollout baseline

分批次：

- `9a`：代码开发、数据处理、企业知识库、用户运营
- `9b`：量化交易、金融服务、电商、广告推广
- `9c`：行业调研、学术调研、财务、法务
- `9d`：客户服务、IT 运维、内容审核、在线直播
- `9e`：医疗健康、人力资源、供应链、教育培训
- `9f`：广告素材、游戏开发、游戏上架、市场营销

完成定义：

- 24 域全部可被 domain registry 正式注册。
- 每个域至少有 baseline tool / workflow / eval / governance / smoke test。

## 4. 执行顺序

严格按以下顺序推进，不跳步：

1. `W0` 架构内核与入口收口
2. `W1` 五平面主链收口
3. `W2` AI 运营层与 Harness 收口
4. `W3` 智能交互与组织治理收口
5. `W4` 规模化生态与运营成熟度收口
6. `W5` 24 域 baseline 全量落地

并行规则：

- 同一波次内可并行处理互不冲突的子模块。
- 不允许在 `W0/W1` 未稳定前大规模推进 `W4/W5` 的业务域细节实现。
- 所有新增功能必须先挂到 canonical entry / catalog，再算正式实现。

## 5. 测试与收口规则

每个波次必须同步完成：

1. 代码实现
2. 对应测试
3. 相关文档回写
4. 被该波次触发的失败测试修复

最低测试要求：

- 架构主干：`unit + docs + startup import`
- 五平面：`unit + integration`
- API / CLI / console：`unit + integration + golden`
- 风险 / 审批 / 恢复 / DLQ / replay / audit：`unit + integration + contract`
- 域 baseline：每域至少 `smoke + registry + governance/eval wiring`

禁止事项：

- 只补代码不补测试
- 新旧路径长期双写却没有明确兼容层边界
- 明知测试红灯仍继续叠加改动
- 把 `S4` 外部基础设施目标写成“仓内已真实完成”

## 6. 当前完成情况回写

截至当前 revision，已完成：

- 架构根入口、startup target、application kernel、platform surface catalog 已落地。
- `src/` 目录结构与 `01-code-structure.md` 的 canonical entry 已建立守护测试。
- `apps` 清单已升级为正式 `manifest + startup plan` 结构。
- `platform/index.ts` 与 `src/index.ts` 的根导出面已稳定可 import。
- `domains / interaction / org-governance / scale-ecosystem / ops-maturity / plugins / sdk` 的顶层 canonical barrel 已收敛到正式入口。
- `business-pack`、`chaos`、`monitoring` 缺失的二级模块入口已补齐，并被结构守护测试覆盖。
- `prompt-engine` 已统一为 `eval / registry / renderer / rollout + conversation-template` 的正式导出面。
- `execution/index.ts` 已改为通过 canonical submodule entry 暴露执行平面主能力，不再以深路径导出为主。
- 九大顶层层级与关键 root barrel 已补齐 smoke/barrel 测试。
- `Harness Runtime` 已补齐为 `platform/orchestration/harness` 正式模块，并接入 `orchestration` root export 与 platform catalog。
- `Phase 9` 的 24 个垂直业务域 baseline 已形成统一 catalog，并支持一键 register + activate。
- 24 域每个都具备 baseline 的 `DomainDefinition / RiskProfile / KnowledgeSchema / EvalFramework / PromptLibrary / Recipe / InteractionRule / GovernancePolicy`。
- 24 域 bootstrap、registry 激活、descriptor review、knowledge namespace wiring 已补齐定向测试。
- `interaction / org-governance / scale-ecosystem / ops-maturity` 已分别补齐 capability baseline catalog，可作为 `W3/W4` 的正式基线清单。
- `platform-mainline-bootstrap` 已补齐 `W1/W2` 关键 surface 清单：五平面 + model-gateway + prompt-engine + compliance。
- `W1` 的五平面现已分别具备 plane baseline catalog，并新增 `five-plane-runtime-bootstrap` 统一注册到 `ServiceRegistry`。
- `W1` 的五平面现已进一步具备独立的 `plane bootstrap`：`interface/control-plane/orchestration/execution/state-evidence` 都有自己的注册入口与 `ServiceRegistry` service id，`five-plane-runtime-bootstrap` 也已改为依赖这些分平面 bootstrap 进行总装配。
- `W1` 现已补齐 `five-plane-startup-plan`，把五平面的启动顺序、bootstrap service id、entry module 与 capability 计数沉成正式启动契约。
- `W1` 现已补齐 `five-plane-runtime-orchestrator`，可基于 startup plan 按顺序初始化五平面并输出 readiness 快照，应用内核也已能消费这套平面启动视图。
- 根入口 `src/index.ts` 的 `summary` 输出现已包含五平面的 startup order 与 capability 统计，不再只有静态架构层摘要。
- `W1` 已完成五平面 canonical barrel 收口：`platform/*`、`src/platform/index.ts`、`src/index.ts` 的冲突导出已改为“主能力直出 + namespace surface”模式，避免深层杂糅入口继续成为事实主入口。
- `W1` 已补齐 `apps/index.ts`、`interaction/autonomy/index.ts` 与结构守护测试的导出/路径对齐，`http-api-server` 相关 unit/integration 链路与五平面 startup / structure / barrel 守护测试均已通过。
- `W2` 现已补齐 `model-gateway / prompt-engine / compliance / harness` 的 capability baseline 与 bootstrap，并新增 `ai-operations-startup-plan` 和 `ai-operations-runtime-orchestrator`。
- 应用内核与根入口摘要现已同时暴露 `W2` 的 startup order 与 capability 统计，不再只可见 `W1` 五平面信息。
- `W2` 现已进一步补齐 `ai-operations-runtime-catalog`，把 `model-gateway / prompt-engine / compliance / harness` 汇总成统一 runtime catalog，并接回应用内核与根入口摘要。
- `W2` 的 baseline service 名称现已与 canonical submodule export 对齐，`model-gateway / prompt-engine / compliance / harness` 的 surface catalog 不再引用占位或错误导出。
- `W2` 现已新增 `ai-operations-mainline-integration` 全链路集成测试，覆盖 prompt rollout、model governance fallback、compliance evidence 与 harness loop 的主链闭环。
- `W3` 现已补齐 `interaction / org-governance` 的 bootstrap，并新增统一的 `interaction-governance-runtime-catalog`、`interaction-governance-startup-plan` 和 `interaction-governance-runtime-orchestrator`。
- 应用内核与根入口摘要现已开始同时暴露 `W3` 的 startup order 与 capability 统计。
- `W3` 的 baseline service 名称现已与 canonical entry export 对齐，`interaction / org-governance` 的 baseline catalog 新增了 root/submodule export 守护测试，`dashboard` root entry 也已补齐 `DashboardProjectionService` 导出。
- `W3` 现已新增 `interaction-governance-mainline-integration` 主链测试，覆盖 `NL intake → goal decomposition → UX onboarding → proactive suggestion → autonomy promotion/demotion → approval/delegation/compliance/knowledge boundary/identity sync → dashboard` 的完整闭环。

下一步直接进入：

- `W4` 规模化生态与运营成熟度收口
- 继续推进 `scale-ecosystem / ops-maturity` 的正式 catalog、bootstrap、主链集成与稳定性验证
- `W5` 继续从“24 域已可注册 baseline”推进到更细的 tool/plugin/connector baseline

## 7. 完成判定

本文件可以改为 `done` 口径的前提是：

- `Phase 1-8c` 平台能力均有真实实现与测试，不留“只在文档里存在”的功能。
- `Phase 9` 的 24 域全部具备 baseline 且通过各自 smoke / wiring 测试。
- `S1-S3` 在仓内可运行、可验证；`S4` 具有正式接口、调度、部署与替身验证。
- 根入口、catalog、canonical boundary、文档、测试四者口径一致。
