# 架构设计文档 vs 代码实现交叉审查报告
automatic_agent/automatic-agent-platform-main/docs_zh/reviews/architecture-code-cross-review.md
> **审查基线**：`docs_zh/architecture/00-platform-architecture.md` v3.2 + `docs_zh/architecture/05-cross-platform-ui-architecture.md` v3.2
> **审查范围**：`src/`、`tests/`、`ui/`、`docs_zh/`、`docs_en/`
> **审查日期**：2026-04-24
> **审查方法**：逐条对比架构文档中的每个可验证声明与实际代码实现，仅记录存在偏差的问题项

---

## 一、平台架构文档 (00-platform-architecture.md) 与 src/ 代码的偏差

### 1.1 contracts/index.ts 未导出五个核心契约对象 [§5.3]

**文档要求**：§5.3 定义了 5 个核心平面间契约对象——RequestEnvelope、ControlDirective、ExecutionPlan、ExecutionReceipt、StateCommand，是五平面通信的正式接口。

**实际情况**：`src/platform/contracts/` 下确实存在这 5 个契约的子目录和完整实现（接口 + 工厂函数），但 `contracts/index.ts` 的桶导出 **未包含** 这 5 个核心契约。index.ts 仅导出：constants、delegation-request、evidence-record、errors、model-request、projection-update、prompt-bundle、result-envelope、types。

**影响**：上层代码无法通过 `import { RequestEnvelope } from "@platform/contracts"` 统一引入核心契约，违反了"平面间只能通过正式契约对象通信"的设计原则（§5.1）。

---

### 1.2 结构化日志缺少 `service` 字段，字段命名不一致 [§12.4]

**文档要求**：§12.4 定义 StructuredLog 必须包含 8 个必填字段：`timestamp`、`traceId`、`spanId`、`level`、`service`、`plane`、`message`、`structuredPayload`。

**实际情况**（`src/platform/shared/observability/structured-logger.ts`）：

- `service` 字段 **完全缺失**——没有标识日志来源服务/模块的字段
- `timestamp` 实现为 `createdAt`（语义等价但命名不同）
- `structuredPayload` 实现为 `data`（语义等价但命名不同）
- `level` 枚举值为小写（`"debug" | "info" | "warn" | "error"`），文档为大写（`DEBUG | INFO | WARN | ERROR | FATAL`），且缺少 `FATAL` 级别

**影响**：日志无法按服务维度聚合分析；与文档定义的 schema 不完全兼容，外部日志消费方（如 ELK）配置可能对不上。

---

### 1.3 Recovery Worker 仅实现 2/6 [§14.7]

**文档要求**：§14.7 定义 6 种 Recovery Worker——LeaseReclaimer、ExecutionRecoveryWorker、WorkflowRepairWorker、ProjectionRebuildWorker、ReplayWorker、StuckRunSweeper。每个 Worker 必须声明 `RecoveryCadence` 并通过 `RecoveryReport` 汇报结果。

**实际情况**：

- ✅ `LeaseReclaimerService`（`src/platform/execution/ha/lease-reclaimer-service.ts`）
- ✅ `StuckRunSweeperService`（`src/platform/execution/ha/stuck-run-sweeper-service.ts`）
- ❌ `ExecutionRecoveryWorker`——不存在，有 `runtime-recovery-service.ts` 但未实现 `RecoveryWorker` 接口
- ❌ `WorkflowRepairWorker`——不存在，有 `runtime-repair-service.ts` 但未实现接口
- ❌ `ProjectionRebuildWorker`——`ProjectionRebuildService` 存在但未实现 `RecoveryWorker` 接口
- ❌ `ReplayWorker`——不存在，有 `runtime-recovery-replay-service.ts` 但未实现接口

**影响**：4 种恢复能力未纳入 `RecoveryOrchestratorService` 编排，无法通过 `RecoveryReport` 向 Control Plane 汇报恢复成功率。

---

### 1.4 Executor 类型缺失 2/6，HumanWaitExecutor 完全缺失 [§14.4, §14.6]

**文档要求**：§14.4 定义 6 种内置 Executor——ToolExecutor、PluginExecutor、AdapterExecutor、BrowserExecutor、HumanWaitExecutor、SubWorkflowExecutor。§14.6 明确 "HumanWait 是正式执行器……审批等待不是旁路"。

**实际情况**：

- ❌ `ToolExecutor`——无此类，功能拆分为 `CommandExecutor` + `tool-parallel-executor`
- ✅ `PluginExecutorService`
- ✅ `AdapterExecutor`
- ✅ `BrowserExecutor`
- ❌ `HumanWaitExecutor`——**完全不存在**，`src/platform/execution/` 下无任何相关文件或类
- ✅ `SubWorkflowExecutor`

**影响**：`HumanWaitExecutor` 缺失意味着审批等待无法作为正式执行器参与 lease/timeout/recovery 生命周期管理，违反 §14.6。

---

### 1.5 存储分组实际 4 组非文档声明的 7 组，表数 103 非 71 [§26.3]

**文档要求**：§26.3 定义 71 张逻辑表，7 个 Group（Workflow & Execution 12 表、Decision & Policy 9 表、Knowledge & Artifact 8 表、Ops & Governance 15 表、AI Operations 8 表、Domain & Organization 10 表、Maturity & Lifecycle 9 表）。

**实际情况**：

- 实际定义 **103 张表**（超出 71 张）
- `SchemaInventoryService` 将表组织为 **4 个分类**（core_truth、runtime_extension、governance_extension、reliability_extension），与文档的 7 组分类完全不同

**影响**：文档的分组方式不反映代码实际组织，开发者按文档查找表会困惑。

---

### 1.6 ModelGateway.chat() 方法名不匹配 [§15.2]

**文档要求**：§15.2 定义 `chat()`、`complete()`、`embed()` 三个方法。

**实际情况**（`UnifiedChatProvider`）：`chat()` 实际名为 `createChatCompletion()`（流式为 `createStreamingChatCompletion()`）；`complete()` 和 `embed()` 与文档一致。

**影响**：外部调用方按文档接口编码会发现方法名不存在。

---

### 1.7 Runtime 模式命名：文档用连字符，代码用下划线 [§14.8]

**文档要求**：§14.8 使用连字符——`no-write`、`no-external-call`、`no-rollout`、`incident-mode`。

**实际情况**（`UnifiedRuntimeMode`）：代码使用下划线——`no_write`、`no_external_call`、`no_rollout`、`incident_mode`。

**影响**：JSON 序列化和 API 对接时两端命名不一致。

---

### 1.8 §35 推荐目录未覆盖实际存在的 10 个额外目录

**文档要求**：§35 定义了 `src/` 和 `src/platform/` 的推荐目录结构。

**实际多出的目录**：

| 位置            | 额外目录                                                                             |
| --------------- | ------------------------------------------------------------------------------------ |
| `src/` 顶层     | `apps/`、`benchmarks/`、`core/`、`testing/`、`types/`                                |
| `src/platform/` | `shared/`、`agent-delegation/`、`cost-management/`、`prompt-registry/`、`stability/` |

**影响**：开发者无法从架构文档找到这些目录的定位说明。

---

### 1.9 业务域超出文档声明——实际 35+ 个目录，文档声明 24 域 [§71-§94]

**文档要求**：§71-§94 定义 24 个垂直业务域。

**实际多出的 11 个域**：`agriculture/`、`business-pack/`、`canonical-meta-model/`、`executive-assistant/`、`facilities/`、`manufacturing/`、`operations/`（与 `it-operations/` 功能重叠）、`product-management/`、`project-management/`、`quality-assurance/`、`roadmap/`

**影响**：新增域缺乏架构级文档（DomainDescriptor、风险评估、Runbook）。

---

## 二、UI 架构文档 (05-cross-platform-ui-architecture.md) 与 ui/ 代码的偏差

### 2.1 三个 WebSocket 流式事件未实现 [§5.3 / 附录 B / A-3]

**文档要求**：后端 `TaskWebSocketEvent` 定义 7 种事件（status_changed / progress / message_delta / artifact_ready / approval_requested / completed / failed），UI 应处理这些事件。

**实际情况**（`ui/packages/shared/api-client/src/ws-event-router.ts`）：

- ✅ `status_changed` → 映射到 `["tasks"]` 查询键
- ❌ `progress` → **未映射**
- ❌ `message_delta` → **未映射**
- ❌ `artifact_ready` → **未映射**
- ✅ `approval_requested` → 映射到 `["approvals"]`
- ✅ `completed` → 映射到 `["tasks"]`
- ✅ `failed` → 映射到 `["tasks"]`

路由器实际映射了 30 种事件，额外覆盖了 workflow、worker、queue、agent、incident、config、panic 等域事件，但 3 个与任务执行流式输出相关的核心事件缺失。

**影响**：任务执行过程中的进度更新、流式消息增量、产物就绪通知无法实时推送到 UI，用户需要手动刷新才能看到这些状态变化。

---

### 2.2 ui/ 存在额外未在文档中声明的包和 Feature 模块

**文档 §3.4 目录全景**：

- `packages/shared/` 下预期 9 个子包（api-client、auth、state、sync、i18n、domain、nl-client、telemetry、types）

**实际情况**：

- 多出 `packages/shared/platform/`（`@aa/shared-platform`）——包含 PlatformAdapter 工厂和 5 种平台适配器实现。文档 §3.7.1 定义了 PlatformAdapter 接口但未在 §3.4 目录全景中列出 `platform/` 子包。

**Feature 模块**：

- 文档定义 27 个 Feature 模块
- 实际多出 `governance-compliance/`（`@aa/feature-governance-compliance`），未在 §4.1 信息架构映射表中记录

**影响**：新包和新模块缺乏文档中的状态标签（Implemented/Planned/Proposed/Deferred）和后端数据源映射。

---

### 2.3 PlatformAdapter 实际接口与文档 §3.7.1 定义的接口签名差异显著

**文档 §3.7.1** 定义的 PlatformAdapter 接口使用嵌套对象风格（如 `secureStorage.get()`、`notifications.show()`、`biometric.authenticate()` 等 15 组能力）。

**实际情况**（`@aa/shared-types` 中的 `PlatformAdapter` 接口 + `base-platform-adapter.ts` 实现）：接口使用 **扁平方法** 风格：

- 文档：`secureStorage.get(key)` / `secureStorage.set(key, value)` / `secureStorage.delete(key)`
- 代码：`readSecureValue(key)` / `writeSecureValue(key, value)` / `deleteSecureValue(key)`
- 文档：`notifications.show(notification)` / `notifications.requestPermission()`
- 代码：无直接通知方法，通过 `vibrate(pattern)` 提供触觉反馈
- 文档：`biometric.isAvailable()` / `biometric.authenticate(reason)`
- 代码：无对应方法
- 文档：`offlineStore.get<T>(key)` / `offlineStore.set<T>(key, value)`
- 代码：通过 `readFile(path)` / `writeFile(path, contents)` 替代
- 文档定义 `windowing`（5 方法）、`shell`（2 方法）、`process`（4 方法）、`analyticsConsent`（4 方法）、`screenSecurity`（3 方法）为 [Planned]
- 代码已实现 `openWindow()`、`runShell()`、`spawnProcess()`、`getAnalyticsConsent()` / `setAnalyticsConsent()`、`enableScreenSecurity()` 作为扁平方法

**影响**：文档的接口定义无法直接作为 TypeScript interface 使用，前端团队按文档编码会与实际类型不匹配。文档需要与实际 `@aa/shared-types` 中的定义对齐。

---

### 2.4 共享子包部分仅为空壳 scaffold

**文档 §3.4** 在目录全景中将所有 shared 子包列为具有完整功能的模块。

**实际情况**——以下子包仅有单个 `index.ts` 文件，功能极为有限：

- `shared/i18n/` — 仅导出占位符
- `shared/domain/` — 仅导出 route guard 和 feature guard 工厂函数
- `shared/nl-client/` — 仅导出占位符
- `shared/telemetry/` — 仅导出占位符

**影响**：i18n（国际化）和 telemetry（前端遥测）是架构文档中重要的跨平台能力，当前为空壳状态影响 G-6（WCAG 合规需要 i18n 支持）和可观测性目标。

---

### 2.5 桌面端和移动端 App Shell 为配置骨架，未达文档声明的基线

**文档 §0.0** 声明："Phase 2 — 桌面端：基线已落地"、"Phase 3 — 移动端：基线已落地"，并声明 "桌面与移动端按'smoke-ready 工程基线'验收"。

**实际情况**：

- `apps/electron-win/` — 仅导出窗口配置对象和 IPC channel 列表，**无 Electron main 进程**（无 `BrowserWindow` 创建逻辑、无 IPC handler）
- `apps/tauri-macos/` 和 `apps/tauri-linux/` — 仅有 `tauri.conf.json` + `lib.rs` 空壳
- `apps/mobile/` — 13 行 `App.tsx`，无实际页面渲染

**影响**：虽然文档承认是 "smoke-ready"，但这些 shell 甚至无法通过 smoke test（无法启动窗口、无法渲染页面）。配置骨架与"基线已落地"的表述有差距。

---

### 2.6 UI Monorepo 未安装依赖，TypeScript 类型检查无法通过

**文档 §0.0** 声明 "当前 UI 子工程已完成 typecheck / test / build 闭环"。

**实际情况**：`ui/` 目录下存在 `package.json` 和 `package-lock.json`，但 `node_modules/` 不存在（LSP 报告大量 `Cannot find module 'react'` 错误）。这表明依赖未安装，typecheck/build 在当前状态下无法执行。

**影响**：无法在仓库 clone 后直接验证 "typecheck / test / build 闭环" 的声明。（注：可能需要先执行 `pnpm install`，但这不影响 LSP 和 CI 首次验证的体验）

---

### 2.7 React Flow 版本不匹配

**文档 §2.3** 框架版本约束表锁定 React Flow **12.x**。

**实际情况**（`ui/package.json`）：`"reactflow": "^11.11.4"` —— 使用 11.x 而非文档声明的 12.x。

**影响**：版本不一致。React Flow 12 是重大版本更新（包名从 `reactflow` 改为 `@xyflow/react`），两者 API 不完全兼容。

---

## 三、docs_zh 与 docs_en 文档一致性问题

### 3.1 UI 架构文档仅存在于 docs_zh，docs_en 缺失

**问题**：`docs_zh/architecture/05-cross-platform-ui-architecture.md` 是一份 3000+ 行的核心架构文档，但 `docs_en/architecture/` 中 **不存在对应翻译**。docs_en 在同一位置有 `v3.0-domain-research.md`（不同文档）。

**影响**：非中文用户无法获取 UI 架构设计信息。作为适用对象包含"前端架构师、UI/UX 工程师"的文档，缺少英文版对国际化团队是重大障碍。

---

### 3.2 UI 设计评审文档仅存在于 docs_zh

**问题**：`docs_zh/reviews/ui-design-vs-implementation-review.md` 在 `docs_en/reviews/` 中不存在。docs_en/reviews/ 仅有 2 个文件（architecture-design-vs-implementation-review.md、architecture-remaining-plan.md），比 docs_zh/reviews/ 少 1 个。

**影响**：UI 实现与设计的差距评审记录仅中文可访问。

---

### 3.3 术语双语对照表仅存在于 docs_zh

**问题**：`docs_zh/governance/terminology-bilingual.md` 在 `docs_en/governance/` 中不存在（docs_en 有 7 个文件，docs_zh 有 8 个）。

**影响**：英文文档缺少术语对照参考。

---

## 四、测试覆盖 vs 架构声明的偏差

### 4.1 e2e 测试缺少对 UI 层的端到端覆盖

**文档 §0.0 (05-cross-platform-ui)** 声明 UI Phase 1-4 基线已落地。但 `tests/e2e/` 中的 40 个 E2E 测试全部面向后端（OAPEFLIR loop、workflow execution、tenant isolation 等），**无任何 UI E2E 测试**（无 Playwright/Cypress/Detox 测试）。

`ui/tests/` 包含 19 个测试文件，但均为单元/结构测试（feature registry、directory 一致性、架构对齐），不是端到端浏览器测试。

**影响**：UI 层的 E2E 验证完全缺失，无法验证用户真实操作路径。文档 §7.2 提到使用 Playwright（Web）和 Detox（Mobile）进行 E2E 测试，但目前无任何实际测试用例。

---

## 五、系统级交叉问题

### 5.1 OAPEFLIR FSM 阶段名称与 Harness 语义映射表存在 "Analyze" vs "Assess" 差异

**文档 §13.1** 主链定义：Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release。

**代码 stage-transition-fsm.ts** 阶段名称使用 "Observe → **Assess** → Plan → Execute → Feedback → Learn → Improve → Release"——与文档一致。

但 `OAPEFLIR` 缩写展开为 "Observe → **A**nalyze → Plan → Execute → Feedback → Learn → Improve → Release"，即 "A" 代表 "Analyze"。而文档和代码中阶段名都是 "Assess" 而非 "Analyze"。

**影响**：OAPEFLIR 缩写中的 "A" 实际对应 "Assess" 而非其字面展开 "Analyze"，造成术语混淆。

---

### 5.2 UI Feature 路由与后端 API 资源路径映射不完整

**文档 §6.3 (00-platform-architecture)** 定义了完整的 API 资源路径（如 `/api/v1/workflow-runs`、`/api/v1/workflow-runs/{id}/steps`、`/api/v1/knowledge`、`/api/v1/packs`、`/api/v1/packs/{id}/versions`、`/api/v1/plugins`、`/api/v1/prompts` 等）。

**UI 端点目录**（`ui/packages/shared/api-client/src/endpoints.ts`）定义了 36 个端点，但以下后端 API 资源在 UI 端点中 **未定义**：

- `/api/v1/workflow-runs/{id}/steps` — 无步骤查询端点
- `/api/v1/knowledge` — 无知识库端点
- `/api/v1/packs` / `/api/v1/packs/{id}/versions` — 无 Pack 管理端点
- `/api/v1/plugins` — 无插件管理端点
- `/api/v1/prompts` — 无 Prompt 版本查询端点

**影响**：UI 无法访问知识库、Pack、Plugin、Prompt 等后端已定义的 API 资源。

---

### 5.3 UI 设计令牌默认为暗色主题，文档未指定默认主题

**文档 §6.3** 提到设计令牌和主题系统（Light/Dark/HighContrast），但未指定默认主题。

**实际情况**：`ui/packages/ui-core/src/design-tokens/index.ts` 中 `designTokens` 常量的默认颜色方案为暗色（`background: "#0f172a"` 深蓝黑色），themes 导出了 `lightTheme`、`darkTheme`、`highContrastTheme` 和 `resolveTheme` 函数，但 **默认 token 本身就是暗色调**。

**影响**：如果消费方未显式选择主题而直接使用 `designTokens`，会得到暗色主题。企业级产品通常默认亮色主题，需明确设计决策。

---

### 5.4 `operations/` 与 `it-operations/` 域目录功能重叠

**文档 §93** 定义了 "IT 运维 SRE/DevOps 域"，对应 `src/domains/it-operations/`。但 `src/domains/` 下还存在 `operations/` 目录。

**影响**：两个域目录职责边界不清，可能导致代码分散。文档 §35 推荐目录中 `operations/` 被列为基础设施目录，但 `src/domains/operations/` 看起来更像是一个业务域实例。

---

## 六、问题汇总统计

| 类别                      | 问题数    | 严重等级分布                                                        |
| ------------------------- | --------- | ------------------------------------------------------------------- |
| 后端代码 vs 平台架构文档  | 9 项      | 3 高（1.1, 1.3, 1.4）、4 中（1.2, 1.5, 1.6, 1.9）、2 低（1.7, 1.8） |
| UI 代码 vs UI 架构文档    | 7 项      | 2 高（2.1, 2.3）、3 中（2.2, 2.4, 2.5）、2 低（2.6, 2.7）           |
| docs_zh vs docs_en 一致性 | 3 项      | 1 高（3.1）、2 低（3.2, 3.3）                                       |
| 测试覆盖                  | 1 项      | 1 高（4.1）                                                         |
| 系统级交叉问题            | 4 项      | 1 中（5.2）、3 低（5.1, 5.3, 5.4）                                  |
| **合计**                  | **24 项** | **7 高、8 中、9 低**                                                |
