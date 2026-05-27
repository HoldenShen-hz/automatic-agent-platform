## 一、`src/` 问题

> 状态约定：已闭环项显式标记为 `done`；未标记 `done` 的条目统一按 `todo` 处理。

### 1.1 占位 / 未实现 / 运行时风险

| 编号 | 问题 |
|---|---|
| 1 | `done` `src/core/runtime/index.ts` 已移除 `WorkflowStepCheckpoint` 字符串占位，改为显式 re-export checkpoint 类型与函数，不再与真实 interface 冲突。 |
| 2 | `done` 合同文件中的 `docs.example.com` / `https://api.example.com` 占位链接已改为现行 `docs_zh/contracts/README.md`。 |
| 3 | `done` `src/sdk/cli/pack-publish.ts` 已移除假默认 registry，现要求显式提供 `AA_REGISTRY_URL` 或 `--registry-url`。 |
| 4 | `src/platform/five-plane-execution/plugin-executor/plugin-executor.service.ts:482-485` 抛出 `plugin_executor.action_not_implemented`，是显式 “not implemented” 路径，配套 hook 缺失即在运行时直接 500。 |

### 1.2 `as any` / `@ts-expect-error` 抑制类型检查

| 编号 | 问题 |
|---|---|
| 5 | `src/sdk/harness-sdk/index.ts:502, 590, 610, 634, 657` 一连五处 `@ts-expect-error`，且同一注释（“Partial&lt;HarnessRun&gt; doesn't have all required properties”）重复 4 次。 |
| 6 | `src/ops-maturity/explainability/explanation-pipeline-service.ts:153` `@ts-expect-error - exactOptionalPropertyTypes complexity with Omit`。 |
| 7 | `src/scale-ecosystem/multi-region/noisy-neighbor-protection.ts:227` 类型与运行时数据形状不一致，靠注释压制。 |
| 8 | `src/ops-maturity/compliance-reporter/template-registry/index.ts:101, 106` 两处 `@ts-expect-error`。 |
| 9 | `src/interaction/nl-gateway/index.ts:290` `IntentParserPort` 与 `ModelIntentParserPort` 不一致，应通过适配而非压制。 |
| 10 | `src/platform/five-plane-orchestration/harness/harness-decision-manager.ts:186` 用注释代替接口约束（`appendEvidenceRecord` is available on repository implementations…）。 |
| 11 | `src/interaction/dashboard/dashboard-projection-service.ts:110` `@ts-expect-error - system.health.changed may not be in TypedEventType`：违反事件注册中心契约。 |

### 1.3 兼容 shim 与 `src/platform/` 的重复 / 矛盾

| 编号 | 问题 |
|---|---|
| 12 | `done` `src/core/runtime/index.ts` 已收紧为 thin compat shim，不再引入额外字符串常量。 |
| 13 | `done` `src/runtime/agent-runtime/index.ts` 这一未暴露且无消费者的 compat shim 已删除。 |
| 14 | `done` 已复核：`src/platform/agent-delegation/index.ts` 是现行仍被测试与兼容入口消费的 facade，原“零引用/多余双入口”结论不成立。 |
| 15 | `done` `src/platform/ops-maturity/index.ts` 这一未暴露的单行 compat 入口已删除。 |
| 16 | `done` 已复核：AGENTS.md 对 `src/platform/` 的表述允许 `shared contracts, gateway, prompt, stability, and cross-plane support` 等 sibling 目录，原“仅授权少数目录”结论过窄。 |

### 1.4 五面架构边界违规

| 编号 | 问题 |
|---|---|
| 17 | 控制面深入状态-证据面 SQLite 私有路径：<br>    - `five-plane-control-plane/approval-center/approval-timeout-executor.ts:21` import `.../five-plane-state-evidence/truth/sqlite/repositories/approval-repository.js`<br>    - `approval-center/approval-service.ts:43` 直接拉 `truth/repositories/runtime-lifecycle-repository.js`<br>    - `config-center/config-versioning-service.ts:24-25`、`config-audit-service.ts:21-22` 调用 `truth/sqlite/query-helper.js`<br>    - `incident-control/enterprise-governance-support.ts:19, 22` 拉 `truth/sqlite/sqlite-migration-compatibility.js` 与 `sqlite-schema-compatibility-gate.js` |
| 18 | 控制面跨入编排面：<br>    - `five-plane-control-plane/incident-control/human-takeover-support.ts:5`<br>    - `incident-control/human-takeover-service.ts:19`<br>    都 `import { getWorkflowDefinition } from "../../five-plane-orchestration/oapeflir/workflow/minimal-workflow.js"`。 |
| 19 | 执行面大量 import 控制面 IAM/配置实现细节，未通过 contract/policy 端口（典型 ~40 处）：<br>    - `five-plane-execution/dispatcher/index.ts:22, 29`<br>    - `tool-executor/tool-metadata.ts:15`<br>    - `plugin-executor/plugin-executor.service.ts:31`<br>    - `tool-executor/edit-replacement-service.ts:4-5`<br>    - `patch-dsl-service.ts:38-41`、`web-fetch.ts:19`、`web-search.ts:195`<br>    - `startup/startup-preflight.ts:3-15`<br>    - `tool-executor/skill-execution-{cache,core,support,service}-methods.ts` import `five-plane-control-plane/config-center/model-metadata-registry.js` + `resource-ceiling.js`<br>    - `dispatcher/execution-resource-ceiling-guard.ts:20` import `config-center/runtime-env.js`<br>    - `distributed-lock/pg-advisory-lock-adapter.ts:1` import `config-center/postgres-pool-env.js` |
| 20 | 执行面 → 状态/证据面：`five-plane-execution/state-transition/...`（`state-transition-machine.ts`、`transition-service.ts`）由 `core/runtime/index.ts` 重新出口，使 compat shim 越界。 |

### 1.5 过大文件 / 应拆分

| 编号 | 问题 |
|---|---|
| 21 | `src/platform/five-plane-control-plane/mission/index.ts` 1637 行，唯一一个 &gt;1500 LOC 的文件，应拆分。 |
| 22 | 接近 1000+ LOC 的二级候选：<br>    - `five-plane-interface/api/http-api-server.ts` 1294<br>    - `scale-ecosystem/multi-region/cdc-replication-service.ts` 1180<br>    - `five-plane-state-evidence/events/event-registry.ts` 1174<br>    - `five-plane-execution/dispatcher/execution-dispatch-service.ts` 1105<br>    - `durable-event-bus.ts` 1084<br>    - `domains/registry/plugin-spi-registry.ts` 1053<br>    - `oapeflir-loop-core.ts` 1051<br>    - `scim-service.ts` 1037<br>    - `delegation-manager.service.ts` 1032<br>    - `slo-alerting-service.ts` 1029<br>    - `sdk/client-sdk/api-client.ts` 1027<br>    - `sqlite-database.ts` 1018<br>    - `billing-service.ts` 1015<br>    - `secret-management-service.ts` 1015<br>    - `tenant-platform-service.ts` 1003 |

### 1.6 仓库/文档 URL 占位混乱（同时存在 5 套）

| 编号 | 问题 |
|---|---|
| 23 | JSDoc/`@see` 引用混用 5 个互斥仓库 URL（package.json `name=automatic-agent-platform`）：<br>    - `github.com/anomalyco/automatic-agent`：例 `src/sdk/cli/data-plane.ts:26`、`platform-operator.ts:22`、`pmf.ts:25`、`stable-campaign.ts:11-13`、`platform/stability/stable-*-rehearsal.ts`、`domains/governance/division-loader.ts:14-16`<br>    - `github.com/anomalyco/automatic_agent`：例 `oapeflir/workflow/workflow-validator.ts:16-17`、`config-center/config-override-governance.ts:13`、`config-governance-support.ts:21-23`<br>    - `github.com/anomalyco/opencode`：例 `sdk/cli/phase1b-demo.ts:9-13`、`shared/observability/diagnostics-export-service.ts:9-13`、`task-timeline-service.ts:8-11`<br>    - `github.com/automatic-agent/automatic_agent_platform`（含下划线）：大量出现 — `agent-delegation/index.ts:18`、`cost-management/index.ts:18`、`prompt-registry/index.ts:16`、`event-registry.ts:16,72`、`durable-event-bus.ts:50`、`iam/sandbox-policy.ts:12-15`、`approval-center/approval-service.ts:13-16`、`channel-gateway/stream-bridge.ts:12-18`<br>    - `github.com/automatic-agent/automatic-agent-platform`：例 `incident-control/*.ts`、`shared/observability/*.ts`、`slo-alerting-service.ts:22` |

### 1.7 硬编码外部 URL

| 编号 | 问题 |
|---|---|
| 24 | `src/platform/five-plane-control-plane/config-center/provider-defaults.ts:10-34` 顶层 const 硬编码 `api.anthropic.com`、`api.openai.com`、`api.minimax.io`、`api.stripe.com/v1`、`api.paddle.com`、`api.telegram.org`、`slack.com/api`，未走 config 校验链。 |
| 25 | `done` `src/sdk/cli/release-pipeline.ts` 当前已抽出 `GITHUB_ACTION_RUN_URL_PREFIX` 与 `buildGithubActionRunUrl()`，原硬拼重复字符串问题已关闭。 |
| 26 | `src/scale-ecosystem/marketplace/pack-security-service.ts:328` 默认 `vulnerabilityApiUrl: "https://api.osv.dev/v1/query"` 硬编码外部威胁情报。 |
| 27 | `src/plugins/adapters/livestream-adapter.ts:40`、`game-dev-adapter.ts:32, 55`、`asset-production-adapter.ts:29, 31, 54`、`crm-adapter.ts:47`、`github-adapter.ts:91` 硬编码 YouTube/Unity/Figma/HubSpot/GitHub 等第三方 URL，未经 outbound-url-policy 注册。 |

### 1.8 console.* 出现在非 CLI 路径

| 编号 | 问题 |
|---|---|
| 28 | `done` `plugin-runtime-child.ts` 现仅在真实子进程入口上下文安装 console 重定向，不再污染宿主进程。 |
| 29 | `done` `plugin-runtime-child.ts` 的 protocol error 路径已改为结构化 logger 输出，不再直写 `console.error(...)`。 |

### 1.9 静默吞错

| 编号 | 问题 |
|---|---|
| 30 | `done` `src/platform/structure/index.ts` 已移除静默吞错和 Deno fallback，当前直接使用 Node `readdirSync()` 并显式抛出失败。 |

### 1.10 其他

| 编号 | 问题 |
|---|---|
| 31 | `src/index.ts:11-14` 等多处把 `requireValidStartupEnv`、`runSingleTaskExecution`、`buildFivePlaneRuntimeCatalog` 等深内部从 `five-plane-control-plane/config-center/index.js`、`five-plane-execution/execution-engine/index.js` 直接拉到顶层公共出口，绕过 `package.json#exports` 中 `./platform` 入口语义。 |
| 32 | `src/core/runtime/index.ts:13-14` `export *` 与第 5 行 `dispatcher/execution-dispatch-service.js` 等多处 wildcard re-export，会引发同名符号合并丢失（再加上第 18 行 `WorkflowStepCheckpoint` 同名常量），属于 ambiguous re-export，应改为命名 re-export。 |
| 33 | `done` `src/runtime/agent-runtime/index.ts` 已删除，原 wildcard 泄漏路径已消失。 |
| 34 | `done` `src/sdk/cli/release-pipeline.ts` 已统一走共享 URL builder，原重复字面量问题已关闭。 |

## 二、文档（`docs_zh/` + `docs_en/`）问题

### 2.1 根级文档与配置矛盾

| 编号 | 问题 |
|---|---|
| 35 | `done` `CONTRIBUTING.md` 已与 `README.md`、`package.json#engines` 收敛到 Node 22 基线。 |
| 36 | `done` `docs_zh/operations/dependency-upgrade-plan.md` 与 `docs_en/operations/dependency-upgrade-plan.md` 当前已按 `node >=22 <23` 口径维护。 |
| 37 | `done` `docs_zh/operations/operations-checklist.md`、`docs_zh/quality/00-full-coverage-test-manual.md`、`docs_en/operations/operations-checklist.md` 已统一到 Node 22 CI 基线。 |
| 38 | `done` 已复核：`npm run lint` 与 “No formatter is enforced” 不再冲突，前者是静态检查，后者指仓库未强制 formatter。 |
| 39 | `done` 已复核：`src/platform/five-plane-state-evidence/artifacts/` 当前实际存在，原问题已过期。 |
| 40 | `done` `CLAUDE.md` 已移除对已删除 `src/runtime/agent-runtime/` compat shim 的旧说明。 |

### 2.2 `docs_zh/` 与 `docs_en/` 结构不对称

| 编号 | 问题 |
|---|---|
| 41 | `done` `docs_en/architecture/v3.0-domain-research.md` 已改为英文索引入口；`docs_en/domains/README.md`、`docs_en/migrations/*`、`docs_en/reviews/architecture-remaining-plan.md` 当前已有对应 zh 镜像；`docs_en/quality/00-full-coverage-test-manual-append.md` 也已补齐 zh 别名镜像。 |
| 42 | `done` `docs_zh/reviews/extract-issues.mjs` 已移出文档目录；`docs_zh/quality/test-exclusion-audit.md` 当前也已有英文镜像，原不对称问题已关闭。 |

### 2.3 私人绝对路径泄露 / 死链

| 编号 | 问题 |
|---|---|
| 43 | `done` `docs_zh/CHANGELOG.md` 与 `docs_en/CHANGELOG.md` 已改为相对链接 `../../CHANGELOG.md`。 |
| 44 | `done` `docs_zh/architecture/archive/00-platform-architecture-monolith-2026-05-14.md` 当前已无个人绝对路径。 |
| 45 | `done` `docs_zh/reviews/platform-architecture-implementation-consistency-audit_round.md` 当前已改为相对链接。 |
| 46 | `done` 已复核：`docs_zh/reviews/issues-table.md` 与 `docs_en/reviews/issues-table.md` 当前证据列不再使用个人绝对路径。 |
| 47 | `done` 已复核：`docs_zh/reviews/platform-architecture-implementation-consistency-audit_round_reaudit.md` 及英文版当前已使用相对 contract 链接。 |
| 48 | `done` `docs_zh/reviews/temp-cache-cleanup.md`、`docs_zh/reviews/full-cleanup-review.md`、`docs_en/reviews/full-cleanup-review.md` 当前已改为相对路径命令。 |

### 2.4 docs_en 翻译质量

| 编号 | 问题 |
|---|---|
| 49 | `done` 已复核：`docs_en/reviews/issues-table.md` 与 `platform-architecture-implementation-consistency-audit_round_reaudit.md` 当前已无 `5-plane-*` 误翻残留。 |
| 50 | `done` 已复核：上述英文 review 当前已无 `&#39;` 实体化反引号残留，markdown 代码格式已恢复。 |

### 2.5 ADR / 文档引用已不存在的 src 目录

| 编号 | 问题 |
|---|---|
| 51 | `done` `docs_zh/adr/020-memory-six-plane-model.md` 与 `docs_en/adr/020-memory-six-plane-model.md` 已回写到 `src/platform/five-plane-state-evidence/memory/`。 |
| 52 | `done` `docs_zh/adr/017-knowledge-architecture-refactor.md` 与 `docs_en/adr/017-knowledge-architecture-refactor.md` 已回写到 `five-plane-state-evidence/knowledge/`。 |
| 53 | `done` `docs_zh/adr/078-knowledge-plane-architecture.md` 与 `docs_en/adr/078-knowledge-plane-architecture.md` 已改为 `five-plane-state-evidence/knowledge/` 模块。 |
| 54 | `done` `docs_zh/adr/019-agent-handoff-four-layer-protocol.md` 与 `docs_en/adr/019-agent-handoff-four-layer-protocol.md` 已改为现行 handoff 模块路径。 |
| 55 | `done` `docs_zh/migration/00-migration-guideline.md`、`docs_en/migration/00-migration-guideline.md`、`docs_en/migration/README.md` 已改为 `authoritative-task-store` 拆分后的现行路径。 |
| 56 | `done` 已复核：`docs_zh/architecture/04-runtime-sequence.md` 与 `docs_en/architecture/04-runtime-sequence.md` 当前引用的 `ui/packages/shared/api-client/src/endpoints.ts` 是现行真实路径。 |
| 57 | `done` 已复核：`src/platform/five-plane-state-evidence/artifacts/` 当前实际存在，相关 contract 路径不再失效。 |
| 58 | `done` 已复核：该条属于旧 review 描述引用 `.js` 扩展的过期文本，不再代表当前源码状态。 |
| 59 | `done` 已复核：该条属于旧 review 行文问题，现行 contract README 已明确 legacy alias 仅为 deprecated/兼容语义。 |

### 2.6 文档引用不存在的脚本

| 编号 | 问题 |
|---|---|
| 60 | `done` 已复核：`docs_zh/guides/quickstart.md` 与 `docs_en/guides/quickstart.md` 当前已使用 `npm run docs:markdown-render`，不再引用不存在的 `docs:lint`。 |

### 2.7 reviews 内容空洞 / 占位 / 过时

| 编号 | 问题 |
|---|---|
| 61 | `done` `docs_zh/reviews/architecture-design-vs-implementation-review.md` 已重写为当前架构入口、实现一致性证据和回归命令索引。 |
| 62 | `done` `docs_zh/reviews/architecture-code-cross-review.md` 已补当前证据表与维护规则，不再是无证据占位。 |
| 63 | `done` `docs_zh/reviews/ui-design-vs-implementation-review.md` 已回写 GAP-01/02/03 的源码证据与回归命令。 |
| 64 | `done` `docs_zh/reviews/temp-cache-cleanup.md` 已改为当前治理口径文档，移除旧机器视角和个人路径。 |
| 65 | `done` `docs_zh/reviews/full-cleanup-review.md` 已改为当前治理边界说明，移除过期一次性扫描和绝对路径。 |
| 66 | `done` `docs_zh/reviews/README.md` 与 `docs_zh/operations/review-closure-board.md` 已补 `platforme-full-review-b.md` 入口。 |

### 2.8 operations 跟踪器陈旧 / 矛盾

| 编号 | 问题 |
|---|---|
| 67 | `done` `docs_zh/operations/operations-tracker.md` 已更新到 2026-05-27，并补充最新 review 入口。 |
| 68 | `done` `docs_zh/operations/project_progress_tracker.md` 已改为与 `current_todo_list.md` 一致的“历史批次归档 + 当前入口”口径。 |
| 69 | `done` `docs_zh/operations/release-versioning.md` 已回链 `operations-checklist.md` 的 `Pre-Launch Top 20 Hard Checklist`。 |

### 2.9 文档自身声明矛盾

| 编号 | 问题 |
|---|---|
| 70 | `done` `docs_zh/CHANGELOG.md` 当前已改为 `当前发布基线：Unreleased`，与根 `CHANGELOG.md` 口径一致。 |
| 71 | `done` `docs_zh/operations/current_todo_list.md` 已补归档后新增治理资产说明，`sync-async-service-pairs.md` 不再处于无对账状态。 |
| 72 | AGENTS.md:4 强调 `src/sdk/harness-sdk/` 是 “harness-facing SDK code”，实际目录仅含 `index.ts` 一个文件（约 600+ 行），未形成独立 SDK 结构。 |

### 2.10 其他

| 编号 | 问题 |
|---|---|
| 73 | `done` `docs_zh/operations/npm-scripts.md` 已改为中文维护规范。 |
| 74 | `done` `docs_zh/operations/test_coverage_baseline_gate.md` 已改为中文说明。 |
| 75 | `done` 已复核：`docs_zh/contracts/README.md` 当前已扩展为 4.0-4.12 分组索引，覆盖全目录骨架。 |

## 三、UI（`ui/`）问题

### 3.1 占位 / Mock / 缺少 API 集成

| 编号 | 问题 |
|---|---|
| 76 | `done` `ui/packages/features/feature-flags/src/web/index.tsx` 现已消费 `useFeatureFlagsVm()` 并渲染 `FeatureWorkbenchPanel`，不再是静态占位。 |
| 77 | `done` `ui/packages/features/feature-flags/src/hooks/index.ts` 已移除 `{} as never` / Promise 双重断言，hook 已被页面消费。 |
| 78 | `ui/packages/features/{memory-review,release-console,trace-explorer,policy,audit,compliance,dispatch,inspect,workflow-builder,workflow-debugger}/src/hooks/index.ts:5-13` 全部返回硬编码静态 `items`，但模块声明为 `Implemented/Contracted` 或 `Implemented/Internal`（如 `release-console/src/index.tsx:13`、`trace-explorer/src/index.tsx:13`），与 “无后端集成” 严重不符。 |
| 79 | `ui/packages/features/{agent-manager,marketplace,explainability,cost-center,audit,inspect,dispatch,memory-review,release-console,trace-explorer,policy,workflow-debugger}/src/web/index.tsx:11-15` 传给 `FeatureWorkbenchPanel` 的 `actions` 均无 `onTrigger`；按钮点击只在 `packages/ui-core/src/components/index.ts:154-160` 写一条假 “activity” 日志，无任何真实业务动作。 |
| 80 | `done` `ui/packages/features/workflow-builder/src/web/index.tsx` 已改为消费 `vm.nodes / vm.edges`，不再把 DAG 节点和边硬编码在视图层。 |
| 81 | `done` `ui/packages/features/task-cockpit/src/hooks/index.ts` 已移除基于 `evidenceCount` 的前端伪造证据链，改为仅展示后端未接线前的汇总占位。 |
| 82 | `done` `ui/packages/features/workflow-debugger/src/mobile/index.ts` 已移除 “Awaiting backend debugger seam” 占位文案。 |
| 83 | `ui/apps/electron-win/src/renderer.js:1-43` Electron 渲染进程是手写 DOM 占位（"Electron Windows Shell Baseline"），未加载 React 主应用 `@aa/web`，桌面端实际无功能页面。 |
| 84 | `done` `ui/apps/web/src/app-shell.tsx` 已优先消费运行时 `authContext`，不再把 `tenant-default` 等静态值写死。 |

### 3.2 类型断言绕过

| 编号 | 问题 |
|---|---|
| 85 | `done` 同 77：`feature-flags` hook 的双重类型断言已删除。 |
| 86 | `done` `ui/packages/features/conversation/src/hooks/index.ts` 已移除 `ConversationClient` 构造处的 `as never`，并在 shared NL client 侧补齐 `initialMessages` 类型。 |
| 87 | `done` `ui/packages/features/task-cockpit/src/hooks/index.ts` 已删除 `useTasksQuery as unknown as` 强转；`useTasksQuery` 现原生支持 `refetchInterval` 选项。 |
| 88 | `done` `ui/apps/web/src/app-shell.tsx` 当前已通过 `normalizeFeatureModule()` 做显式收敛，不再存在 `features as unknown as readonly WebFeatureModule[]` 强转。 |

### 3.3 console / 错误处理

| 编号 | 问题 |
|---|---|
| 89 | `done` `ui/apps/web/src/app-shell.tsx` 的 `Report Issue` 已改为 `reportUiError(...)`，不再只写 `console.error`。 |
| 90 | `done` `ui/apps/web/src/global-error-boundary.tsx` 已接入 `reportUiError(...)`，不再仅打印控制台。 |
| 91 | `done` `ui/apps/web/src/main.tsx` 现对 `registerWebServiceWorker()` 显式 `.catch(...)` 并上报失败。 |
| 92 | `done` `ui/apps/electron-win/src/main.ts` 当前已移除对同步 `showPlatformNotification()` 的错误 `void` 用法，并把窗口 `loadFile()` 失败路径收敛到统一 fail-closed 处理。 |
| 93 | `done` `ui/apps/web/src/app-shell.tsx` 的 `FeatureErrorBoundary` 已实现 `componentDidCatch()` 并上报组件栈。 |
| 94 | `done` `ui/apps/web/src/app-shell.tsx` 已把相关 `useMemo` 提前到条件返回之前，Hooks 顺序违规已消除。 |

### 3.4 硬编码颜色 / 偏离 design tokens

| 编号 | 问题 |
|---|---|
| 95 | `done` `ui/apps/web/src/app-shell.tsx` 的 startup banner 当前已改用 `designTokens`/`withAlpha(...)`，原 `#12201a` 硬编码已消失。 |
| 96 | `done` `ui/packages/features/approval/src/web/index.tsx` 当前已统一走 `designTokens` 颜色，不再写死 `#12201a / #334155`。 |
| 97 | `done` `ui/packages/features/workflow-cockpit/src/web/index.tsx` 当前已统一走 `designTokens` 颜色。 |
| 98 | `done` `ui/packages/features/workflow-builder/src/web/index.tsx` 已改为 `designTokens.color.border`，不再硬编码 `#334155`。 |
| 99 | `done` 已复核：`ui/packages/features/conversation/src/web/index.tsx` 当前不再含 `#334155` 硬编码。 |
| 100 | `done` 已复核：`ui/packages/features/hitl/src/web/index.tsx` 当前不再含 `#334155` 硬编码。 |
| 101 | `done` `ui/packages/features/workflow-cockpit/src/web/dag-viewer.tsx` 当前已统一走 `designTokens` 色板。 |
| 102 | `done` `ui/apps/mobile/src/App.tsx` 已改为引用 `mobileDesignTokens`，不再直接写 `#F7F8FA / #4B5563`。 |
| 103 | `done` `ui/packages/ui-mobile/src/components/index.tsx` 已抽出 `mobileDesignTokens`，移除大批散落的十六进制硬编码。 |
| 104 | `done` `ui/packages/features/governance-compliance/src/web/index.tsx` 当前已使用 `var(--aa-color-text)`，原错误 CSS 变量名已关闭。 |

### 3.5 死 CSS / 死代码

| 编号 | 问题 |
|---|---|
| 105 | `done` `ui/packages/ui-core/src/design-tokens/tokens.css` 已由 `ui/apps/web/src/main.tsx` 显式加载，不再是死 CSS。 |
| 106 | `done` `ui/apps/web/src/feature-registry.ts` 已删除误导性的 `LazyFeatureDashboard` 别名，相关测试也已回写。 |

### 3.6 命名 / 结构不一致

| 编号 | 问题 |
|---|---|
| 107 | `done` `ui/apps/web/src/feature-registry.ts` 已统一走 `@aa/feature-*` 别名，原四个特性不再使用三级相对路径。 |
| 108 | `done` `ui/apps/web/src/app-shell.tsx` 当前只在本地归一化 `subPages`，不再依赖 `as unknown as` 强转修补 `FeatureModule` 类型。 |
| 109 | `done` `ui/apps/web/src/feature-registry.ts` 已移除未消费的 `missionControlFeatureContracts` 残留导出。 |
| 110 | `done` `createFeatureModule()` 当前已统一根据 `status` 推导 `kind` 默认值；`analytics/workflow-builder` 与 `release-console/trace-explorer` 的状态字段风格已收敛。 |
| 111 | `done` `ui/apps/web/index.html` 与 `ui/apps/electron-win/index.html` 当前已改为 `lang="zh-CN"`，与现行中文壳层文案一致。 |
| 112 | `done` `ui/apps/web/src/app-shell.tsx` 当前用户可见文案已统一走 `translateMessage(...)`。 |
| 113 | `done` `workflow-cockpit`、`approval`、`task-cockpit` 现均已把 cited 按钮/提示文案接到 i18n。 |
| 114 | `done` `workflow-debugger` mobile cards、`workflow-builder` hook、`compliance` hook 已统一文案语言，不再中英混排。 |

### 3.8 可访问性

| 编号 | 问题 |
|---|---|
| 115 | `done` `ui/packages/features/task-cockpit/src/web/index.tsx` 的输入框已补 `aria-label` 和 `name`。 |
| 116 | `done` `ui/apps/web/index.html` 已补 `meta description`、`favicon` 与根节点回退文案。 |
| 117 | `done` `ui/apps/web/src/app-shell.tsx` 已为 AccessDenied 增加默认原因文案，`reason` 为空时不再渲染空段落。 |
| 118 | `done` `ui/apps/electron-win/index.html` 当前根节点回退文案已改为正式加载提示，不再直接暴露旧占位标题。 |

### 3.9 硬编码 URL / 端口

| 编号 | 问题 |
|---|---|
| 119 | `done` cited UI tooling 入口当前已统一收敛到 `ui/test-target.json` / env 覆盖，不再在各文件散落硬编码 `127.0.0.1:4173`。 |

### 3.10 其他

| 编号 | 问题 |
|---|---|
| 120 | `done` `ui/packages/features/dashboard/src/web/index.tsx` 已改为 `translateMessage("ui.dashboard.validationDrilldown")`。 |
| 121 | `done` `ui/apps/web/src/app-shell.tsx` 的 `LoadingFallback` 已走 `translateMessage("ui.shell.loading")`，不再是硬编码英文 loading 文案。 |
| 122 | `done` `ui/apps/web/src/feature-registry.ts` 已把导入名改为 `workflowDebuggerFeature`，避免与 `debugger` 语义混淆。 |
| 123 | `done` 根 `package.json` 的 `test:ui-p1-features` 当前已覆盖 `compliance/feature-i18n/flows/mission-control-wiring` 等现存 P1 测试入口。 |
| 124 | `done` `ui/package.json` 的 `lint` 现已显式覆盖 `tools/**/*.{ts,mjs}` 与测试目录。 |
| 125 | `done` `ui/package.json` 的 `lint` 当前也覆盖 `scripts/**/*.mjs`，`bundle-analysis.mjs` 不再处于 ESLint 盲区。 |

## 四、`tests/` 与测试基础设施问题

### 4.1 空文件 / 无断言测试

| 编号 | 问题 |
|---|---|
| 126 | `done` `tests/unit/platform/shared/cache/cache-metrics-collector.test.ts` 当前已有实际断言覆盖 `snapshot/reset` 行为。 |
| 127 | `done` `tests/unit/domains/onboarding/index.test.ts` 当前已包含真实 barrel 暴露断言，不再只是空转发。 |
| 128 | `done` `tests/unit/testing/test-cleanup.test.ts` 已补 `assert.doesNotThrow` 与返回值断言。 |
| 129 | `done` `tests/integration/testing/process-guard.test.ts` 当前各用例都已包含显式断言。 |

### 4.2 package.json 引用不存在的测试

| 编号 | 问题 |
|---|---|
| 130 | `done` `package.json` 的 `test:pg-integration` 已改为现存 PG 集成测试路径。 |
| 131 | `done` `package.json` 的 `test:secret-providers` 已改为现行 `tests/integration/platform/security/...` 路径。 |
| 132 | `done` `package.json` 的 `artifact:integrity` 已改为现存测试入口 `tests/unit/platform/state-evidence/artifacts.test.ts`。 |

### 4.3 测试中遗留 console.*

| 编号 | 问题 |
|---|---|
| 133 | `done` 已复核：`tests/integration/platform/structure/structure-validation.integration.test.ts` 当前已无残留 `console.log`。 |
| 134 | `done` 已复核：`tests/integration/sdk/admin-sdk-integration.test.ts` 当前已无 `console.warn("Unhandled fetch...")`。 |
| 135 | `done` `tests/performance/platform/state-evidence/event-bus.perf.test.ts` 当前已改用 `t.diagnostic(...)`，无临时 `console.log`。 |

### 4.4 抖动（基于固定 setTimeout）

| 编号 | 问题 |
|---|---|
| 136 | `done` `concurrency-invocation.test.ts` 中原 1.6s 硬等待已去除，现只保留短轮询/最小等待。 |
| 137 | `done` `takeover-escalation-manager-integration.test.ts` 已无原 500ms 硬等待。 |
| 138 | `done` `process-guard.test.ts` 已迁到 integration 层，且原 600ms 固定等待已移除。 |
| 139 | `done` `process-tracker-sandbox.test.ts` 已无原 100/200/500ms 固定等待。 |
| 140 | `done` `durable-event-bus*` 集成测试已去除原 150ms/50ms 级别的固定等待；剩余同步让步仅为 `setImmediate`。 |
| 141 | `done` `distributed-rate-limiter` / `sli-slo` / `circuit-breaker` 三组测试中的原固定等待已清理。 |
| 142 | `done` `core/runtime/bootstrap.test.ts` 中原 100ms 固定等待已移除。 |

### 4.5 硬编码 localhost / 端口

| 编号 | 问题 |
|---|---|
| 143 | `done` `tests/unit/sdk/cli/oauth-pkce-login-flow.test.ts` 当前已统一复用 `OAUTH_CALLBACK_URL` 常量。 |
| 144 | `done` `tests/unit/sdk/cli/api-server.test.ts` 当前已统一复用 `OTEL_TEST_ENDPOINT / API_SERVER_TEST_BASE_URL / API_SERVER_TEST_PORT` 常量。 |
| 145 | `done` `tests/unit/scale-ecosystem/integration/invoke-callback.test.ts` 与 `integration-index.test.ts` 当前已统一复用 `UNREACHABLE_LOOPBACK_BASE_URL` 常量，不再散落 `localhost:9999/80`。 |
| 146 | `done` `tests/integration/sdk/migrate-sqlite-to-pg.test.ts` 当前已改为复用测试 DSN 常量，不再内嵌旧的明文示例密码串。 |
| 147 | `done` `tests/integration/platform/security/http-api-server.test.ts` 当前已复用 `OTEL_TEST_ENDPOINT` 常量。 |

### 4.6 测试位于错误的层

| 编号 | 问题 |
|---|---|
| 148 | `done` `full-coverage-{operational-,}real-paths.test.ts` 已迁到 `tests/integration/quality/`。 |
| 149 | `done` 相关脚本测试已迁到 `tests/integration/scripts/`。 |
| 150 | `done` `process-guard.test.ts` 已迁到 `tests/integration/platform/shared/stability/`。 |
| 151 | `tests/unit/scale-ecosystem/marketplace-balance-ratchet.test.ts`、`pack-security-integration.test.ts`、`pack-security-service.test.ts`、`marketplace/pack-security-comprehensive.test.ts` 全部 spawn 子进程却放 unit。 |
| 152 | `done` 三个 `incident-control` CLI 测试已迁到 `tests/integration/platform/control-plane/incident-control/`。 |
| 153 | `done` `migration-fixtures.test.ts` 已迁到 `tests/integration/platform/state-evidence/truth/`。 |

### 4.7 重名测试用例（屏蔽风险）

| 编号 | 问题 |
|---|---|
| 154 | `"report outputDir matches options"` 在 17 个 `*.test.ts` 中均被声明（`stable-worker-writeback-rehearsal.test.ts`、`stable-dispatch-reconciliation-rehearsal.test.ts`、`worker-handshake-rehearsal.test.ts` 等）。 |
| 155 | `"report contains valid startedAt and finishedAt timestamps"` 同样 17 处。 |
| 156 | `"parseJsonArray returns empty array for invalid JSON"` 15 处；`"parseJsonArray parses valid JSON array"` 15 处；`"parseJsonArray returns empty array for non-array JSON"` 14 处，分布于 `runtime/execution-lease-utils.test.ts`、`runtime/worker-registry/execution-worker-handshake-support.test.ts`、`platform/execution/worker-pool/worker.test.ts`、`writeback-index.test.ts`、`platform/execution/dispatcher/execution-dispatch-support.test.ts`、`platform/execution/lease/utils.test.ts` 等。 |
| 157 | `"toWorkerStatus returns busy when running executions exist"`（7 处）、`"toWorkerStatus returns idle when no running executions"`（6 处）、`"normalizeLeaseReason returns *"` 系列每个 6 处、`"choosePreemptionVictim returns null for empty array"`（6 处）等共 48 个重名 ≥5 次，疑似重构未删除旧目录。 |
| 158 | 平行目录 `tests/unit/runtime/...` 与 `tests/unit/platform/execution/...`、`tests/unit/platform/five-plane-execution/...` 中存在大量重名常量。 |

### 4.8 测试经相对路径直接 import `src/`，与 dist 执行约定矛盾

| 编号 | 问题 |
|---|---|
| 159 | 全部 `tests/golden/*.test.ts`、`tests/integration/**/*.test.ts`、`tests/unit/**/*.test.ts`（11500+ 行命中）使用 `from "../../src/..."` 直接引用 TS 源（例 `tests/golden/openapi-document.test.ts:11`、`tests/integration/cross-plane-event-propagation.test.ts:27-32`、`tests/integration/sdk/cli/ops-cli.test.ts:7-16`）。同时 `package.json:165-166` 走 `dist/tests/...js` 编译产物路径；约定混乱。 |

### 4.9 多余 / 失同步 fixtures

| 编号 | 问题 |
|---|---|
| 160 | `done` 已复核：这些 pack fixtures 现在被 pack / prompt / marketplace 等测试直接引用，原“仅命中自身 README”结论已过期；同时 fixture 内误抓测试文件已清除。 |
| 161 | `done` `tests/fixtures/packs/test-pack/tests/` 下的占位测试已删除。 |
| 162 | `done` 活跃测试已迁出 `fixtures/`；`generate-snapshots.ts` 与 `snapshots/manifest.json` 仅保留为迁移夹具工件。 |

### 4.10 未引用的 golden 快照

| 编号 | 问题 |
|---|---|
| 163 | `done` `audit-golden-snapshots.mjs` 已补反向 orphan 校验，且无引用 golden 快照已清理。 |

### 4.11 自实现 skip 通道

| 编号 | 问题 |
|---|---|
| 164 | `done` `ops-cli.test.ts` 的 `serialTest(...)` 已收紧为仅接受 `node:test` 兼容形状。 |
| 165 | `done` 迁移夹具中的 skip-budget 兼容通道已删除。 |

### 4.12 其他可疑实现

| 编号 | 问题 |
|---|---|
| 166 | `done` `tests/unit/plugins/plugin-runtime-host.test.ts` 当前已通过 `t.after(...)` 恢复原始 `process.execArgv`。 |
| 167 | `done` `http-api-server-architecture-regressions.test.ts` 已无原 40ms 固定等待。 |
| 168 | `done` `http-api-server.test.ts` 已改为使用随机化测试端口，不再硬编码 `43123`。 |

## 五、配置 / 构建 / 部署 / 脚本问题

### 5.1 package.json 脚本 / 路径错误

| 编号 | 问题 |
|---|---|
| 169 | `done` `package.json` 的 `artifact:integrity` 已切到现行存在的测试文件，不再引用不存在路径。 |
| 170 | `done` `package.json` 的 `test:pg-integration` 已改为点名现存测试文件，不再为空匹配。 |
| 171 | `done` `package.json` 的 `test:secret-providers` 已改为现行集成测试路径。 |
| 172 | `done` `test:pg-integration` / `test:secret-providers` 已直接走 `node --import tsx --test`，不再依赖不会产出 `dist/tests/**` 的 `build:test`。 |
| 173 | `done` `test:e2e:stage-exit` 已改为点名 `tests/e2e/checkpoint-artifact-flow.test.ts`，命名与目录契约一致。 |
| 174 | `done` 已复核：相关脚本当前不再硬编码 `--test-concurrency=1`。 |
| 175 | `done` `package.json` 223-235 段已恢复统一缩进。 |

### 5.2 tsconfig 矩阵

| 编号 | 问题 |
|---|---|
| 176 | `done` `tsconfig.build-test.json` 已移除，原死配置问题已关闭。 |
| 177 | `done` `tsconfig.json` 当前已包含 `helpers/**/*.ts`，与 lint 范围一致。 |
| 178 | `tsconfig.json:48,68,70,71,72,73` 大量 `exclude` 与 package.json 中 `node --import tsx --test ...` 引用同一文件冲突：<br>     - 排除 `tests/e2e/execution-ticket-lifecycle.test.ts`(:48) ↔ `package.json:213` `dispatch:validate`<br>     - 排除 `tests/integration/platform/control-plane/**/*.test.ts`(:70) ↔ `:196` `test:replay`、`:231` `test:runbook-automation`<br>     - 排除 `tests/integration/platform/execution/**/*.test.ts`(:71) ↔ `:239` `validation:bundle` 引用 `stable-evidence-bundle.test.ts`<br>     - 排除 `tests/integration/platform/interface/**/*.test.ts`(:72) ↔ `:192` `schema:strict` 引用 `schemas.validation.test.ts`<br>     - 排除 `tests/integration/interaction/**/*.test.ts`(:68) ↔ `:216` `autonomy:validate`<br>     - 排除 `tests/integration/platform/model-gateway/**/*.test.ts`(:73) ↔ `:211` `model:provider:test` |
| 179 | `done` `tsconfig.scripts.json` 当前已覆盖 `scripts/**/*.ts`，验证脚本已纳入 typecheck。 |

### 5.3 ESLint 配置

| 编号 | 问题 |
|---|---|
| 180 | `done` `eslint.config.js` 当前已补 `projectService` / `tsconfigRootDir`，type-aware 规则具备类型上下文。 |
| 181 | `done` `eslint.config.js` 已移除不存在的 `deploy/**/*.mjs` 范围。 |
| 182 | `done` `package.json` 当前 `lint` 已改为 `eslint .`，`.tsx` 覆盖由 flat config `files` 显式声明。 |

### 5.4 容器与部署

| 编号 | 问题 |
|---|---|
| 183 | `done` `Dockerfile` 当前已复制 `package-lock.json` 和 `ui/tsconfig.json`，可解析根 TS project references。 |
| 184 | `done` `docker-compose.yml` 与 `.env.example` 当前已统一以 `AA_STORAGE_POSTGRES_DSN` 为主。 |
| 185 | `done` `docker-compose.yml` 卷名与 `.env.example` 默认 SQLite 路径已去除 `phase1a` 遗留。 |
| 186 | `done` `.env.example` 已为 `POSTGRES_PASSWORD` 提供显式本地占位值和说明。 |
| 187 | `done` `.env.example` 已补 `AA_OPENAI_API_KEY`、`AA_MINIMAX_API_KEY`，并按现行读取顺序列出 PG DSN 变量。 |
| 188 | `done` `deploy/kubernetes/manifests/automatic-agent-smoke.yaml` 已改为 `ghcr.io/automatic-agent/automatic-agent-platform:latest`，并统一应用名标签。 |
| 189 | `done` `deploy/helm/automatic-agent/Chart.yaml` 已改为 `automatic-agent-platform`，与包名和镜像仓库一致。 |

### 5.5 Division catalog

| 编号 | 问题 |
|---|---|
| 190 | `done` `config/quality/division-catalog.json` 已补齐当前 `divisions/` 目录的全量登记，`docs_zh/reference/division-catalog.md` 也已同步说明覆盖原则。 |

### 5.6 版本

| 编号 | 问题 |
|---|---|
| 191 | `done` 版本基线已提升到 `0.2.0`，并同步回写 `CHANGELOG.md`、`README.md`、`docs_zh/CHANGELOG.md`、`docs_en/CHANGELOG.md`。 |
| 192 | `done` 当前发布说明已从 `0.1.0` 累积漂移状态收敛到 `0.2.0` 版本节点。 |

### 5.7 .gitignore 与提交内容

| 编号 | 问题 |
|---|---|
| 193 | `done` 被误追踪的 `.audit/*` 已删除，`.test-db/*.db-shm/.db-wal` 也已清出提交面，ignore 目录不再继续携带生成工件。 |
| 194 | `done` `.gitignore` 已删除 `data/` 之下的重复子目录忽略项，保留顶层 `data/` 递归规则。 |
| 195 | `done` `.gitignore` 已移除冗余/不规范的 `dist_temp`、`dist_test` 变体，只保留必要规则。 |
| 196 | `done` `.gitignore` 已移除 `src/platform/*` legacy 兼容面的忽略项，compat surface 恢复可审计。 |

### 5.8 Stryker

| 编号 | 问题 |
|---|---|
| 197 | `done` `stryker.config.mjs` 已移除原宽泛 `**` 白名单式忽略模式。 |
| 198 | `done` Stryker 现改用独立 `tsconfig.stryker.json`，不再直接绑定带 UI references 的根 `tsconfig.json`。 |

### 5.9 孤儿脚本

| 编号 | 问题 |
|---|---|
| 199 | `done` 无引用的 `scripts/` 孤儿脚本已清理。 |
| 200 | `done` 无引用的 `scripts/ci/` 孤儿 audit 脚本已清理。 |

### 5.10 translate_docs.py

| 编号 | 问题 |
|---|---|
| 201 | `done` 仓库根已新增 `requirements.txt`，显式声明 `translate_docs.py` 依赖的 `translators` 包。 |
| 202 | `done` `translate_docs.py` 已重写 markdown/code fence 分段逻辑，去掉代码块前后的重复换行拼接。 |
| 203 | `done` `translate_docs.py` 已为 `translate_text()` 增加重试与指数退避，避免大批量翻译直接裸打外部服务。 |

### 5.11 GitHub Actions

| 编号 | 问题 |
|---|---|
| 204 | `done` `.github/workflows/ci.yml` 与 `tests/helpers/pg-test-helper.ts` 已统一桥接 `AA_TEST_PG_DSN / AA_STORAGE_POSTGRES_DSN / AA_PG_DSN / DATABASE_URL`，PG 集成测试和运行时 DSN 命名已收敛。 |
| 205 | `done` `.github/workflows/ci.yml` 的 Trivy 扫描已改为使用 `${IMAGE_REGISTRY}/${IMAGE_REPOSITORY}:${IMAGE_TAG}` 全限定镜像名，与发布命名面保持一致。 |

## 第二轮补充（与前 205 条不重复）

### 6.1 `src/` 安全 / 数据正确性

| 编号 | 问题 |
|---|---|
| 206 | `done` `migrate-sqlite-to-pg.ts` 已为表名/列名增加 SQL 标识符白名单校验。 |
| 207 | `done` 现行实现已迁到 `src/platform/five-plane-interface/api/middleware/idempotency-key-storage.ts`，构造期通过 `validateSqlIdentifier(...)` 校验 `tableName`。 |
| 208 | `done` 现行实现已迁到 `src/platform/five-plane-state-evidence/knowledge/semantic-vector-store.ts`，标识符校验已补齐，旧 review 指向路径已过期。 |
| 209 | `done` `checkpoint-gc-service.ts` 已改为 `lstat` + `open(O_NOFOLLOW)` + `fstat` + `unlink` 的更安全删除路径。 |
| 210 | `done` `shadow-snapshot-service.ts` 的原子写入已使用 `O_NOFOLLOW|O_EXCL`、目标校验与清理逻辑收敛 symlink swap 时间窗。 |
| 211 | `done` `src/platform/five-plane-control-plane/config-center/api-server-env.ts` 现同时支持 `AA_API_KEYS_JSON` 和 legacy `AA_API_KEYS`。 |
| 212 | `done` `src/platform/five-plane-control-plane/config-center/startup-env-schema.ts` 已要求配置 API keys 时必须提供 `AA_API_JWT_SECRET`。 |

### 6.2 `src/` 并发 / 资源泄漏

| 编号 | 问题 |
|---|---|
| 213 | `done` `src/sdk/client-sdk/api-client.ts` 的 `parseRetryAfterDelayMs()` 已同时支持 delta-seconds 与 RFC 7231 HTTP-date，并在重试前等待解析结果。 |
| 214 | `done` `src/scale-ecosystem/multi-region/region-health-check-service.ts` 现已把 caller `AbortSignal` 与 timeout signal 合并传入 `fetch`。 |
| 215 | `done` 现行 graceful shutdown 实现已在退出前 flush `stdout/stderr`，不再直接截断日志。 |
| 216 | `done` `src/platform/shared/observability/slo-alerting-channels.ts` 已移除在 `queueMicrotask` 中执行同步 I/O 的实现。 |
| 217 | `done` `src/platform/five-plane-execution/distributed-lock/pg-advisory-lock-adapter.ts` 已补 `finally` 清理，在取锁成功但后续记账抛错时做 best-effort `pg_advisory_unlock`。 |

### 6.3 `src/` 重复 / 死代码

| 编号 | 问题 |
|---|---|
| 218 | `done` `src/sdk/cli/release-pipeline.ts` 现已统一通过共享常量和 builder 生成 GitHub Actions run URL。 |
| 219 | `src/platform/five-plane-execution/tool-executor/skill-execution-{cache,core,support,service}-methods.ts` 四份 `*-methods.ts` 切片彼此重名导出 `*Methods`，被同一聚合文件 import，事实上是同一类的物理拆片，互相循环依赖。 |
| 220 | `done` 已复核：`src/runtime/agent-runtime/index.ts` 与 `src/platform/ops-maturity/index.ts` 已删除；`src/platform/agent-delegation/index.ts` 仍有现行消费者，原“三者均为零引用死代码”结论不成立。 |

### 6.4 `docs_zh/` ADR / contracts 二次发现

| 编号 | 问题 |
|---|---|
| 221 | `done` `docs_zh/adr/README.md` 已回写 ADR-001 / ADR-033 / ADR-034 / ADR-069 / ADR-072 的现行状态。 |
| 222 | `done` `docs_zh/contracts/release_rollout_and_rollback_contract.md` 已明确 ADR-075 为执行依据，ADR-018 仅作历史背景。 |
| 223 | `done` `docs_zh/architecture/00-platform-architecture.md` 已改为带权威矩阵的正式入口索引，不再是 21 行 stub。 |
| 224 | `done` 已复核：`docs_zh/architecture/03-module-diagrams.md` 当前为分节正文引用，不存在失效 markdown 内部锚点。 |
| 225 | `done` `docs_zh/quality/buglist.md` 已刷新为 2026-05-27 的当前追踪索引。 |
| 226 | `done` `docs_zh/migration/01-migration-scope.md` 已更新为 151 份 contracts / 120 份 ADR。 |
| 227 | `done` 已复核：`docs_zh/contracts/README.md` 当前已具备完整目录骨架与分组编号风格。 |

### 6.5 UI 二次发现

| 编号 | 问题 |
|---|---|
| 228 | `done` `ui/apps/web/src/feature-registry.ts` 已统一走 `@aa/feature-*` 别名，`ui/tsconfig.json` 也已补齐映射。 |
| 229 | `done` `ui/package.json` 已包含 `packages/features/*`，特性包不再依赖隐式 hoisting。 |
| 230 | `done` `ui/apps/web/package.json` 当前已显式声明 `@aa/shared-*` 与 `@aa/ui-core` 依赖，review 中“仅靠 hoist”结论已过期。 |
| 231 | `done` `ui/apps/electron-win/package.json` 已把不存在的 `electron@^42.1.0` 调整为可解析的 `^31.0.0`。 |
| 232 | `done` `ui/apps/web/src/app-shell.tsx` 已把 `GuardedFeatureRoute` 的 `useMemo` 提前到条件返回之前，Hooks 顺序违规已消除。 |
| 233 | `done` `ui/packages/features/governance-compliance/src/index.tsx` 与 `ui/packages/features/analytics/src/index.tsx` 当前不再声明未实现的 `subPages` 路由清单。 |

### 6.6 tests 二次发现

| 编号 | 问题 |
|---|---|
| 234 | `done` `tests/performance/**/*.perf.test.ts` 当前已统一通过 `createTempWorkspace / cleanupPath` 做测试目录清理，不再基于 `process.cwd()` + 相对路径越界删除。 |
| 235 | `done` `tests/integration/sdk/cli/ops-cli.test.ts` 中的 `serialTest` 现仅接受函数或 `{ skip?: true } + fn` 形状，不再容忍非 `node:test` 兼容调用。 |
| 236 | `done` 已删除 43 份无引用 golden 快照，并在 `scripts/ci/audit-golden-snapshots.mjs` 增加反向 orphan 校验。 |

### 6.7 config / scripts / deploy 二次发现

| 编号 | 问题 |
|---|---|
| 237 | `done` `.claude/scheduled_tasks.json` 中的冲突标记已清除。 |
| 238 | `done` `.github/workflows/ci.yml` 已移除空 `workflow_call` 合约，避免重复触发。 |
| 239 | `done` `.github/workflows/ci.yml` 已补 `build` 步骤，满足下游脚本对 `dist/` 产物的依赖。 |
| 240 | `done` `.github/workflows/ci.yml` 的工件上传已补 `retention-days`，并增加工件完整性 manifest。 |
| 241 | `done` `.github/workflows/ci.yml` 的 Trivy action 已 pin 到完整 commit SHA `ed142fd0673e97e23eac54620cfb913e5ce36c25`。 |
| 242 | `done` `.github/workflows/deploy-environment.yml` 已改为 `--set-string` 传递敏感 Helm 值，避免 `:` 被解析成 map。 |
| 243 | `done` `.github/workflows/deploy-environment.yml` Promote 之后已补二次健康闸门。 |
| 244 | `done` `.github/workflows/dr-validation.yml` 已补 `concurrency:`；现行 CI/DR workflows 均具备最小 `permissions` 基线，原条目不再成立。 |
| 245 | `done` 仓库根已新增 `.github/CODEOWNERS`。 |
| 246 | `done` `Dockerfile` 当前已同时复制 `package-lock.json`，容器构建可继续使用确定性的 `npm ci`。 |
