# Current Todo List

> 当前整改清单以 [../reviews/architecture-design-vs-implementation-review.md](../reviews/architecture-design-vs-implementation-review.md) 为主索引，并以仓内代码与可运行测试结果做最终对账。
> 本文件覆盖此前过早标记为 `done` 的 `W0-W6` 口径，只保留“仓内可落地、可测试、可文档回写”的整改任务。

## 0. 2026-04-23 逐条复核结论

> `R0-R6` 的历史收口不再等价于“review 全部关闭”。以本轮逐条复核为准，当前 review 状态如下：

- `open`: 无
- `partial`: `P1-7`
- `closed`: `P0-1`、`P0-2`、`P0-3`、`P1-1`、`P1-2`、`P1-3`、`P1-4`、`P1-5`、`P1-6`、`P2-1`、`P2-2`、`P2-3`

本文件后续 `done` 仅表示对应历史波次曾完成过当时范围内的整改，不再作为当前 review 缺口已经清零的依据。本轮新增结论是：`P1-1 ~ P1-6`、`P2-1`、`P2-2` 已形成源码、测试、文档三位一体闭环。

## 1. 执行边界

- 只纳入仓内可开发、可验证、可在本轮文档回写中闭环的任务。
- `S4 K8s 集群级分片`、外部企业 IdP 真实联调、独立前端 WCAG 改造等外部基础设施/外部系统事项不计入本轮待办。
- 每个波次都必须同时完成：代码、测试、文档回写、review 状态同步。

## 2. 优先级映射

| 优先级 | review 缺口 | 本轮波次 |
| --- | --- | --- |
| `P0` | `II-1`、`III-1`、`IV-1`、`VI-1~VI-3` | `R1-R3` |
| `P1` | `I-2`、`II-2`、`III-2`、`IV-2~IV-4`、`VI-4~VI-9` | `R2-R5` |
| `P2` | `IV-5~IV-7`、`VI-10~VI-13` | `R4-R5` |
| `P3` | `II-3`、`VI-14/15`、`IX-1` | `R5-R6` |

## 3. 当前整改波次

### R0. Todo / Review 口径重置

状态：`done`

- 重写 `current_todo_list` 为 `R0-R6` 结构。
- 去掉旧 `W1-W5 done` 口径，统一为“以 review 为准”。
- 清理 review 文档的重复缺口块，保留一份 authoritative 缺口台账。
- 在 todo 中建立 `review 编号 → 整改波次` 映射表。

完成定义：

- 中英文 `current_todo_list` 不再出现旧 `W*` 完成口径。
- `review / coverage-matrix / todo` 三者不再互相冲突。

### R1. Harness P0/P1 核心运行时补齐

状态：`done`

- 扩展 `ConstraintPack`，补齐 `risk_policy / output_policy`。
- 将 `HarnessRun` 升级为多生命周期状态：`created / running / waiting_hitl / sleeping / recovering / completed / aborted`。
- 新增 `PlanBundle / WorkProduct / EvaluationReport / ContextSnapshot / WorkflowSleepLease / RecoveryCheckpoint` 契约。
- 为 Harness 补齐迭代、重入、resume、recovery 的正式运行时入口。
- 收口 review `VI-1 ~ VI-6`。

完成定义：

- Harness 不再只是单轮 `planner → generator → evaluator` 骨架。
- Harness 核心契约、状态机、恢复入口都可被定向测试验证。

### R2. ACP、OAPEFLIR↔Harness 语义映射、ModelGateway 补口

状态：`done`

- 新增 `agent-delegation/collaboration-protocol`，落地 ACP message schema、8 种消息类型、强制字段与不变量校验。
- 将 ACP 接回现有委派主链：委派前校验、完成报告 evidence 约束、takeover notice 审计入口。
- 新增 OAPEFLIR↔Harness 显式语义映射，并写入 Harness step/report。
- 为 `UnifiedChatProvider` 补齐 `embed()` 和 `complete()`，复用现有 provider routing / degradation / cost attribution 主链。
- 收口 review `II-1`、`I-2`、`II-2`。

完成定义：

- 协作协议不再缺位。
- Harness 与 OAPEFLIR 的关系不再停留在文档描述。
- `ModelGateway` 对外能力补齐到 review 要求的 facade 级接口。

### R3. 领域元模型、Recipe 扩展、canonical domain_id 收敛

状态：`done`

- 新增 `src/domains/canonical-meta-model/`，实现 Q1-Q12、validator、completeness 计算、24 域 seeder。
- 将 `DomainDescriptorOrchestrationService` 和 `bootstrapVerticalDomainBaselines()` 接到 meta-model validator。
- 将 `DomainRecipe` 原型扩展到 12 种。
- 修正 12 个不匹配的 `domain_id`，并提供 legacy alias → canonical 的兼容映射。
- 收口 review `III-1`、`III-2`、`IV-1`。

完成定义：

- 24 域全部使用 review 指定的 canonical `domain_id`。
- 领域元模型 completeness 可计算、可测试、可进入 descriptor review。

### R4. 24 域特化配置与域内运行面

状态：`done`

- 为 24 域补齐正式配置入口和域特化 workflow/tool/risk/eval/latency/division wiring。
- 不再把通用 `intake → deliver` 双步工作流当作最终交付。
- 优先补齐 5 个关键域：`quant-trading`、`financial-services`、`finance-accounting`、`legal`、`healthcare`。
- 收口 review `IV-2 ~ IV-7`。

完成定义：

- 每个域至少拥有 domain-specific workflow、tool bundle、risk/eval profile、ownership 归属。
- 24 域 smoke / registry / rollout / governance wiring 测试补齐。

### R5. Harness P2/P3 子系统与产品级运行闭环

状态：`done`

- 新增 `ToolbeltAssembler`、五层 Guardrails、正式 HITL Runtime、FeedbackEnvelope、Memory Namespace、Async Harness、Evaluation Harness。
- 将上述能力接入 `HarnessRun` 主链，而不是只做 helper。
- 补齐 Harness observability：iteration timeline、prompt lineage、failure-to-learning、replay entrypoint、audit link。
- 收口 review `VI-7 ~ VI-15`。

完成定义：

- Harness 具备产品级长时运行、HITL、反馈与学习闭环。
- 相关 integration / contract 测试可执行。

### R6. 路线图、ADR、ops-maturity 桩率与最终文档收口

状态：`done`

- 修正 `RoadmapService`，补齐 Phase 8/9 注册。
- 补齐 review 点名缺失的 ADR 文件。
- 处理 `harness/` 目录结构、导出面和文档口径不一致的问题。
- 收口 `ops-maturity` 下被点名的高桩率叶子工具。
- 最终回写 `review / coverage-matrix / current_todo_list`，把已实现项全部改成 `✅`。

完成定义：

- 文档、目录、导出面、测试状态统一。
- review 里剩余项只保留外部基础设施类残留。

## 4. 测试要求

每个波次必须同时完成：

1. 代码实现
2. 定向测试
3. 文档回写
4. 修复该波次触发的失败测试

最低测试基线：

- Harness：`unit + integration`
- ACP / delegation：`unit + contract`
- domains：`unit + smoke + registry + rollout/gov wiring`
- ModelGateway：`unit + integration`
- 文档一致性：`docs + link + health`

## 5. 最终回写结果

- `R0` 已完成：`todo / review / coverage-matrix` 已按仓内实现重新对账，过期缺口与已落地能力不再冲突。
- `R1` 已完成：Harness 核心契约、多生命周期、sleep/resume/recovery 主链已落地，`runLoop()` 现已显式接入 `HarnessLoopController`。
- `R2` 已完成：ACP、OAPEFLIR↔Harness 语义映射、`UnifiedChatProvider.complete()/embed()` facade 与 barrel 可见性已闭环。
- `R3` 已完成：`canonical-meta-model`、12 种 recipe、canonical `domain_id` 与 legacy alias 映射已进入 bootstrap / descriptor / registry 主链。
- `R4` 已完成：24 域 baseline、workflow/tool/risk/eval/latency/ownership wiring 已纳入 unit + integration 回归。
- `R5` 已完成：`ToolbeltAssembler`、`GuardrailEngine`、`HitlRuntime`、`HarnessMemoryManager`、`AsyncHarnessService`、`EvalRunService`、`DurableHarnessService`、`ContextAssembler`、`RecoveryController` 已接回 Harness 主链，并补齐 loop/structure/performance 回归。
- `R6` 已完成：`RoadmapService`、ADR 索引、`harness/` canonical 子目录导出面、ops-maturity 叶子服务与三份 authoritative 文档已同步收口。

完成验证：

- `npm run build`
- `npx tsx --test tests/unit/platform/control-plane/iam/access-model.test.ts tests/unit/platform/control-plane/iam/policy-engine.test.ts tests/unit/platform/control-plane/iam/sandbox-policy-modes.test.ts tests/unit/platform/control-plane/config-center/config-governance-service.test.ts tests/unit/platform/interface/api/http-server/task-routes.test.ts tests/golden/openapi-document.test.ts tests/unit/platform/orchestration/hitl/hitl-approval-orchestration-service.test.ts tests/unit/platform/orchestration/hitl/hitl-inbox-service.test.ts tests/unit/domains/vertical-domain-architecture-service.test.ts tests/integration/domains/domains-mainline-integration.test.ts`
- `review / coverage-matrix / current_todo_list` authoritative 回写同步完成

当前结项状态：

- `P1-1 ~ P1-6` 已完成并关闭。
- `npm run build` 已通过。
- 以上定向 `unit / integration / golden` 已全部通过。
- `npm run build:test` 仍被仓内既有 `audit-export`、`risk-config-loader`、`tenant-boundary-registry-service` 类型债阻塞，这些错误不是本轮 `P1-1 ~ P1-6` 改动引入。
- `review` 旧版缺口描述已与当前实现重新对齐，不再把已落地的 P1 条目标成未完成。

当前仅保留仓外或非本轮阻断项：

- `I-1`：`S4 K8s` 集群级分片
- `II-3`：额外 LLM provider 丰富度扩展

## 5.1 2026-04-23 P0-1 ~ P0-3 收口补记

状态：`done`

- `P0-1` 已完成：新增 `AnomalyEventClass` / `ClassifiedAnomalyEvent` authoritative contract，并将 anomaly detection 与 tier-1 event surface 接到 `E1-E6` 分类。
- `P0-2` 已完成：新增 `UnifiedSeverity` / `UNIFIED_SEVERITY_SLA` 与跨 anomaly / alert / runbook / diagnostic 的 severity mapper，incident package 与 alert event 已可输出 `SEV1-SEV4`。
- `P0-3` 已完成：IAM 下新增 `threat-model/`、`ThreatMatrixRegistry` 与 `config/security/threat-matrix.json`，STRIDE 六维不再只停留在分散安全组件。

完成验证：

- `npm run build`
- `npx tsx --test tests/unit/platform/contracts/types/unified-severity.test.ts tests/unit/platform/contracts/types/anomaly-event-classification.test.ts tests/unit/platform/contracts/types/index.test.ts tests/unit/platform/control-plane/iam/stride-framework.test.ts tests/unit/platform/shared/observability/anomaly-detection-service.test.ts tests/unit/platform/shared/observability/slo-alerting-service.test.ts tests/unit/platform/state-evidence/events/event-types.test.ts tests/unit/platform/state-evidence/events/typed-event-payloads.test.ts`

已知未纳入本次阻断：

- `npm run build:test` 仍会被仓内既存 integration/type errors 阻塞，当前不是由 `P0-1 ~ P0-3` 这组改动引入。

## 5.2 2026-04-23 P1-1 ~ P1-6 收口补记

状态：`done`

- `P1-1` 已完成：新增 `src/platform/control-plane/iam/access-model.ts`，形成 6 类 canonical principal，并接入 `policy-engine` 与 `approval policy context`。
- `P1-2` 已完成：`SandboxMode` 已切换到 `read_only / workspace_write / scoped_external_access / restricted_exec` 四档，并同步 plugin executor 与 config governance。
- `P1-3` 已完成：`/v1/tasks` 与 `/v1/workflows` 已支持 cursor pagination，OpenAPI/golden 已同步。
- `P1-4` 已完成：新增 `src/platform/orchestration/hitl/hitl-modes.ts`，HITL 七模式已接入 approval packet / inbox 主链与逐模式测试。
- `P1-5` 已完成：`policy-engine` 已显式评估 `RBAC -> capability -> context-aware` 三层授权，并补 audit evidence。
- `P1-6` 已完成：新增 `src/domains/vertical-domain-architecture-service.ts`，把 24 域 baseline 提升为可消费的垂直域专属架构面。

完成验证：

- `npm run build`
- `npx tsx --test tests/unit/platform/control-plane/iam/access-model.test.ts tests/unit/platform/control-plane/iam/policy-engine.test.ts tests/unit/platform/control-plane/iam/sandbox-policy-modes.test.ts tests/unit/platform/control-plane/config-center/config-governance-service.test.ts tests/unit/platform/interface/api/http-server/task-routes.test.ts tests/golden/openapi-document.test.ts tests/unit/platform/orchestration/hitl/hitl-approval-orchestration-service.test.ts tests/unit/platform/orchestration/hitl/hitl-inbox-service.test.ts tests/unit/domains/vertical-domain-architecture-service.test.ts tests/integration/domains/domains-mainline-integration.test.ts`

已知未纳入本次阻断：

- `npm run build:test` 当前仍卡在仓内既有测试类型债：`tests/unit/platform/control-plane/audit-export/audit-export-service.test.ts`、`tests/unit/platform/control-plane/risk-control/risk-config-loader.test.ts`、`tests/unit/platform/control-plane/tenant/tenant-boundary-registry-service.test.ts`。

## 6. 跨平台 UI 主线（UI0-UI7）

> 本主线以 [../architecture/05-cross-platform-ui-architecture.md](../architecture/05-cross-platform-ui-architecture.md) 为唯一 UI 权威规格，不覆盖 `R0-R6` 的后端整改历史。

### UI0. 工程与 Todo 基线

状态：`done`

- 仓内新增 `ui/` Monorepo 根目录。
- `current_todo_list` 追加 `UI0-UI7` 波次，不覆盖 `R0-R6`。
- 明确本轮边界：`Web 可运行 + 六平台 shell smoke-ready + typed seam + docs/tests 同步`。

### UI1. Shared Core

状态：`done`

- 已落 `shared/types`、`api-client`、`auth`、`state`、`sync`、`domain`、`i18n`、`telemetry`、`nl-client`。
- 已落 DTO→VM→Props、权限 guard、字段脱敏、offline queue、REST/WS 客户端基线。

### UI2. Adapter / 设计系统 / 跨端基座

状态：`done`

- 已落 `PlatformAdapter` 权威接口。
- 已落 `ui-core`、`ui-mobile`、design tokens、feature scaffold、移动端导航描述基线。

### UI3. 已实现能力优先模块

状态：`done`

- 已落 `dashboard / task-cockpit / workflow-cockpit / approval / stability / takeover / alerts / dispatch / inspect / health / incidents / policy / audit / workers / queues / conversation / hitl / domain-wizard / settings`。
- Web 端已接通 Dashboard / Tasks / Approvals / Settings / Conversation 的共享数据流与页面渲染。

### UI4. Planned 模块与 API seam

状态：`done`

- 已落 `workflow-builder / workflow-debugger / agent-manager / explainability / cost-center / marketplace / analytics / governance-compliance` 正式 feature 包。
- Planned 模块统一使用 typed seam + feature gate 文案，不伪造后端已完成。

### UI5. 六平台壳层

状态：`done`

- 已落 `apps/web`、`apps/electron-win`、`apps/tauri-macos`、`apps/tauri-linux`、`apps/mobile`。
- 其中 `apps/web` 可构建运行，其余为 adapter/shell smoke-ready 基线。

### UI6. 工具链与测试

状态：`done`

- 已落 `tools/codegen`、`tools/mock-server`、`tools/e2e`。
- 已补 UI shared/feature/app/docs 定向测试，并纳入 `ui` 子工程 `typecheck / test / build`。

### UI7. 文档与验收

状态：`done`

- `todolist` 已回写。
- `05-cross-platform-ui-architecture.md` 已补仓内 `Phase 1-4` 对齐快照与 `v3.2` 回写。
- UI docs 一致性测试已覆盖 `UI0-UI7`、`Phase 1-4` 与架构文档对齐。

## 7. 跨平台 UI Phase 1-4 对齐计划

> 本节直接对齐 [../architecture/05-cross-platform-ui-architecture.md](../architecture/05-cross-platform-ui-architecture.md) §7.4 的 `Phase 1-4`，作为 `UI0-UI7` 的阶段化执行视图。

### Phase 1. Web MVP（文档 §7.4）

状态：`done`

- 对齐 `Implemented/Contracted` 与 `Implemented/Internal` 的 Web MVP 路由与页面。
- 补齐 Web 信息架构一级模块缺口：`policy / audit / workers / queues`。
- 将 Dashboard / TaskCockpit / Approval / Stability / Conversation / HITL / Settings 纳入统一 route guard、Query、DTO→VM→Props 主链。
- 继续补文档中 Phase 1 相关的状态回写与 docs 测试。

### Phase 2. 桌面端（文档 §7.4）

状态：`done`

- 固化 `electron-win / tauri-macos / tauri-linux` 的 shell manifest、PlatformAdapter 注入与 smoke bootstrap。
- 对齐桌面端特有能力：`windowing / shell / process / analyticsConsent` 的 baseline 行为与测试替身。
- 将 Web 运行时与桌面适配器的共享层正式复用，避免各壳层各自实现一套。

### Phase 3. 移动端（文档 §7.4）

状态：`done`

- 固化 `apps/mobile` 的导航、secure storage、deep link、haptics、screen security 基线。
- 对齐移动端审批/HITL/会话入口与离线同步主链。
- 补齐移动端 smoke test 与平台能力契约测试。

### Phase 4. 增强功能（文档 §7.4）

状态：`done`

- 按文档继续收口 `workflow-builder / workflow-debugger / agent-manager / explainability / cost-center / marketplace / analytics / governance-compliance`。
- 建立 `planned feature → typed seam → feature gate → docs status` 的统一收口方式。
- 将 `05-cross-platform-ui-architecture.md` 的细粒度状态标签回写到当前仓内实现真相。

完成定义：

- `Phase 1-4` 在仓内范围内均已形成代码基线、文档回写与定向测试闭环。
- 不包含应用商店分发、真实签名发布、外部 MDM/企业商店接入等仓外事项。
