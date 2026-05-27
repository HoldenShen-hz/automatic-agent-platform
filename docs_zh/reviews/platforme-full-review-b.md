## 一、`src/` 问题

### 1.1 占位 / 未实现 / 运行时风险

| 编号 | 问题 |
|---|---|
| 1 | `src/core/runtime/index.ts:18` 出现可疑占位 `export const WorkflowStepCheckpoint = "WorkflowStepCheckpoint";`，与第 16 行 `export * from ".../checkpoints/workflow-step-checkpoint.js"`（已导出同名 interface，见 `workflow-step-checkpoint.ts:113`）发生命名冲突；常量值就是其名字字面量，明显是占位/桩遗留。 |
| 2 | 合同文件中遗留 `docs.example.com` / `https://api.example.com` 占位文档链接，且会被打入运行时错误信息：<br>   - `src/platform/contracts/execution-receipt/index.ts:18`<br>   - `src/platform/contracts/request-envelope/index.ts:10`<br>   - `src/platform/contracts/control-directive/index.ts:251`<br>   - `src/platform/contracts/execution-plan/index.ts:41`<br>   - `src/platform/contracts/state-command/index.ts:10` |
| 3 | `src/sdk/cli/pack-publish.ts:99` 默认 registry URL 为 `https://api.platform.example.com`（第 7 行示例同样使用 `https://api.example.com`），生产路径将 fallback 到不存在的域名。 |
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
| 12 | `src/core/runtime/index.ts` 仅供测试使用（`tests/unit\|integration/core/runtime/...`），但其中第 18 行 `WorkflowStepCheckpoint` 字符串常量违反 AGENTS.md “保持 thin / 不引入新值” 的 compat shim 原则。 |
| 13 | `src/runtime/agent-runtime/index.ts`（33 行）是又一个仅做 `export *` 的兼容层：未在 `package.json#exports` 暴露；AGENTS.md 未列出 `src/runtime/`；仓库内 0 处引用，属死代码 / 不一致兼容层。 |
| 14 | `src/platform/agent-delegation/index.ts`（71 行）只做 `export *`，与权威实现 `src/platform/five-plane-orchestration/agent-delegation/*` 形成双入口，与 AGENTS.md 不一致。 |
| 15 | `src/platform/ops-maturity/index.ts` 仅 1 行 `export * from "./platform-panic/index.js";`，与顶层 `src/ops-maturity/` 同名共存，AGENTS.md 也未为该子目录定位。 |
| 16 | AGENTS.md 仅授权 `src/platform/` 含 `five-plane-*`、`contracts`、`gateway`、`prompt`、`stability`、`shared`，但实际还存在 `agent-delegation`、`architecture`、`compliance`、`cost-management`、`model-gateway`、`ops-maturity`、`prompt-engine`、`prompt-registry`、`remote-coordination`、`structure` 等多余目录。 |

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
| 25 | `src/sdk/cli/release-pipeline.ts:80, 110`、`deployment-execution.ts:53` 硬拼 `https://github.com/automatic-agent/automatic-agent-platform/actions/runs/${runId}`；其中 release-pipeline.ts 80 与 110 字面量完全重复。 |
| 26 | `src/scale-ecosystem/marketplace/pack-security-service.ts:328` 默认 `vulnerabilityApiUrl: "https://api.osv.dev/v1/query"` 硬编码外部威胁情报。 |
| 27 | `src/plugins/adapters/livestream-adapter.ts:40`、`game-dev-adapter.ts:32, 55`、`asset-production-adapter.ts:29, 31, 54`、`crm-adapter.ts:47`、`github-adapter.ts:91` 硬编码 YouTube/Unity/Figma/HubSpot/GitHub 等第三方 URL，未经 outbound-url-policy 注册。 |

### 1.8 console.* 出现在非 CLI 路径

| 编号 | 问题 |
|---|---|
| 28 | `src/domains/registry/plugin-runtime-child.ts:153-157` 全局覆写进程 `console.log/info/debug/warn/error`，模块在非子进程上下文被误 import 时将污染主进程。 |
| 29 | `src/domains/registry/plugin-runtime-child.ts:161` `console.error("%s: %s", message, ...)` 在 protocol error 路径直写 console（即便已被覆写，bootstrap 之前会落到原生 stderr）。 |

### 1.9 静默吞错

| 编号 | 问题 |
|---|---|
| 30 | `src/platform/structure/index.ts:255-257` `} catch { // ignore }` 完全静默吞掉所有异常；同时第 249 行混用 `Deno.readDirSync ?? require("node:fs").readdirSync`，在 Node 包中通过 `createRequire` 探测 Deno fs 的运行时假设不合理。 |

### 1.10 其他

| 编号 | 问题 |
|---|---|
| 31 | `src/index.ts:11-14` 等多处把 `requireValidStartupEnv`、`runSingleTaskExecution`、`buildFivePlaneRuntimeCatalog` 等深内部从 `five-plane-control-plane/config-center/index.js`、`five-plane-execution/execution-engine/index.js` 直接拉到顶层公共出口，绕过 `package.json#exports` 中 `./platform` 入口语义。 |
| 32 | `src/core/runtime/index.ts:13-14` `export *` 与第 5 行 `dispatcher/execution-dispatch-service.js` 等多处 wildcard re-export，会引发同名符号合并丢失（再加上第 18 行 `WorkflowStepCheckpoint` 同名常量），属于 ambiguous re-export，应改为命名 re-export。 |
| 33 | `src/runtime/agent-runtime/index.ts` 通过 `export *` 把 `execution-engine/middleware-init.js` 的全部内部符号泄漏到根空间，且无消费者。 |
| 34 | `src/sdk/cli/release-pipeline.ts:80` 与 `:110` 两处生成 stdout 文案的字符串字面量完全相同（DRY 违反）。 |

## 二、文档（`docs_zh/` + `docs_en/`）问题

### 2.1 根级文档与配置矛盾

| 编号 | 问题 |
|---|---|
| 35 | Node 版本不一致：`README.md:3`、`package.json:7`(`&gt;=22 &lt;23`) vs `CONTRIBUTING.md:9`（"Node.js 20+"）。 |
| 36 | `docs_zh/operations/dependency-upgrade-plan.md:37` 与 `docs_en/...:37` 写 "node &gt;=20 &lt;23"，与 `package.json:7` 冲突。 |
| 37 | `docs_zh/operations/operations-checklist.md:43`、`docs_zh/quality/00-full-coverage-test-manual.md:999, 1098` 仍宣称 “Node 20/22 CI matrix”；`.github/workflows/ci.yml` 实际所有 job 都锁 `node-version: 22`。 |
| 38 | `CONTRIBUTING.md:64, 138` 列出 `npm run lint`，AGENTS.md:11 又写 “No formatter is enforced”，两者口径不一致。 |
| 39 | `CLAUDE.md:50` 提到 `/checkpoints/` 与 `/artifacts/`，但 `src/platform/five-plane-state-evidence/artifacts/` 目录不存在。 |
| 40 | AGENTS.md / CLAUDE.md 仅描述 `src/core/runtime/` 是 compat-only，未提及同时存在的 `src/runtime/agent-runtime/`，"compat surface" 边界不完整。 |

### 2.2 `docs_zh/` 与 `docs_en/` 结构不对称

| 编号 | 问题 |
|---|---|
| 41 | docs_en 多出无对应 zh 文件：<br>    - `docs_en/architecture/v3.0-domain-research.md`（第 2 行误粘了 `docs_zh/...` 源路径，且整篇仍是中文未翻译）<br>    - `docs_en/domains/README.md`<br>    - `docs_en/migrations/00-migration-guideline.md`、`01-migration-scope.md`（zh 用的是 `docs_zh/migration/` 单数）<br>    - `docs_en/quality/00-full-coverage-test-manual-append.md`（与同目录主文件标题重复）<br>    - `docs_en/reviews/architecture-remaining-plan.md` |
| 42 | docs_zh 多出无对应 en 文件：<br>    - `docs_zh/reviews/extract-issues.mjs`（脚本不应出现在文档目录）<br>    - `docs_zh/quality/test-exclusion-audit.md` |

### 2.3 私人绝对路径泄露 / 死链

| 编号 | 问题 |
|---|---|
| 43 | `docs_zh/CHANGELOG.md:4` 与 `docs_en/CHANGELOG.md:4` 含 `/Users/holden/Project/automatic_agent/automatic_agent_platform/CHANGELOG.md:1` 绝对链接（且 `:行号` markdown 不支持）。 |
| 44 | `docs_zh/architecture/archive/00-platform-architecture-monolith-2026-05-14.md:38-39` 含 `/Users/holden/Project/...` 两条绝对路径。 |
| 45 | `docs_zh/reviews/platform-architecture-implementation-consistency-audit_round.md:4` 含 `/Users/holden/Project/...` 链接。 |
| 46 | `docs_zh/reviews/issues-table.md:780` 与 `docs_en/.../issues-table.md:780` 在证据列含 `/Users/holden/Project/...:1`。 |
| 47 | `docs_zh/reviews/platform-architecture-implementation-consistency-audit_round_reaudit.md:538-539`（含英文版同行）含 `/Users/holden/Project/.../task-intake-request-contract.md:1`、`harness-run-contract.md:1`。 |
| 48 | `docs_zh/reviews/temp-cache-cleanup.md:17,30,43,55,67,79,91,102,118` 共 9 条 operator 命令含 `/Users/holden/Project/...`；`docs_zh/reviews/full-cleanup-review.md:18` 与 `docs_en/reviews/full-cleanup-review.md:18` 同样问题。 |

### 2.4 docs_en 翻译质量

| 编号 | 问题 |
|---|---|
| 49 | `docs_en/reviews/issues-table.md` 与 `platform-architecture-implementation-consistency-audit_round_reaudit.md` 共 **373 处** 把代码路径 `five-plane-*` 机翻为不存在的 `5-plane-*`（issues-table.md 占 223 处、reaudit.md 占 150 处）。 |
| 50 | 上述两份英文 review 大量代码段反引号被 HTML 实体 `&#39;` 替换（例 issues-table.md 第 13、49、56、83、84、780 行），失去 markdown 代码格式。 |

### 2.5 ADR / 文档引用已不存在的 src 目录

| 编号 | 问题 |
|---|---|
| 51 | `docs_zh/adr/020-memory-six-plane-model.md:64-68` 列 `src/core/memory/memory-service.ts` 等 5 个文件，实际已迁至 `src/platform/five-plane-state-evidence/memory/`。 |
| 52 | `docs_zh/adr/017-knowledge-architecture-refactor.md:41-42` 引 `src/core/knowledge/...`，实际位于 `five-plane-state-evidence/knowledge/`。 |
| 53 | `docs_zh/adr/078-knowledge-plane-architecture.md:173` 仍写 “`src/core/knowledge/` 模块”。 |
| 54 | `docs_zh/adr/019-agent-handoff-four-layer-protocol.md:48` 引 `src/core/agent-loop/handoff-model.ts`（目录已不存在）。 |
| 55 | `docs_zh/migration/00-migration-guideline.md:960` 仍写 `AuthoritativeTaskStore（src/core/storage/authoritative-task-store.ts）`；实际已迁至 `five-plane-state-evidence/truth/sqlite/authoritative-task-store-*.ts` 且单文件已拆分。 |
| 56 | `docs_zh/architecture/04-runtime-sequence.md:145` 引 `ui/packages/shared/api-client/src/endpoints.ts`（与当前 ui 实际结构需复核）。 |
| 57 | `docs_zh/contracts/artifact_store_contract.md`、`artifact_unified_model_contract.md`、`docs_zh/reviews/platforme-full-review-b.md:92, 248` 仍指向 `src/platform/five-plane-state-evidence/artifacts/...`（目录不存在）。 |
| 58 | `docs_zh/reviews/platforme-full-review.md:1240` 引 `src/platform/contracts/errors.js`（实际是 `errors.ts`）。 |
| 59 | `docs_zh/reviews/platforme-full-review.md:50` 用 shell brace 语法 `{control-directive,execution-plan,execution-receipt}/index.ts`（非可解析路径），且其中 `execution-plan/execution-receipt` 在 `docs_zh/contracts/README.md:44-45` 同时被声明为 deprecated alias，前后立场不一。 |

### 2.6 文档引用不存在的脚本

| 编号 | 问题 |
|---|---|
| 60 | `docs_zh/guides/quickstart.md:108` 与 `docs_en/guides/quickstart.md:108` 列出 `npm run docs:lint`，package.json 无该脚本。 |

### 2.7 reviews 内容空洞 / 占位 / 过时

| 编号 | 问题 |
|---|---|
| 61 | `docs_zh/reviews/architecture-design-vs-implementation-review.md`（仅 9 行）被 `docs_zh/operations/implementation_plan.md:7` 标为 “整改真相”，实质内容仅 2 行。 |
| 62 | `docs_zh/reviews/architecture-code-cross-review.md`（仅 12 行）只有 “24 项全部关闭” 的说明，无任何条目与证据。 |
| 63 | `docs_zh/reviews/ui-design-vs-implementation-review.md`（34 行）GAP-01/02/03 仅写 “已完成”、无证据/文件/回归命令。 |
| 64 | `docs_zh/reviews/temp-cache-cleanup.md` 整体仍以 2026-05-17 旧机器视角写就（含个人路径）。 |
| 65 | `docs_zh/reviews/full-cleanup-review.md` 同样是过期的一次性清理报告，仍含个人绝对路径。 |
| 66 | `docs_zh/reviews/README.md:20` 指向 `docs_zh/operations/review-closure-board.md`（`:14-17` 提及 `platforme-full-review-a.md` 与 `platforme-full-review.md`），但同目录还有 `platforme-full-review-b.md` 未在看板中提及，状态不明。 |

### 2.8 operations 跟踪器陈旧 / 矛盾

| 编号 | 问题 |
|---|---|
| 67 | `docs_zh/operations/operations-tracker.md:5` 写 “Last updated: 2026-04-14”，但 `docs_zh/reviews/system-review-2026-05-26.md`、`current-codebase-gap-review-v1.9.md` 已是更新版本。 |
| 68 | `docs_zh/operations/current_todo_list.md:1-31` 把 A1-B1 列为 “已归档”，而 `project_progress_tracker.md:7-9` 仍写 “R1-R3 正在推进、R4-R6 仍待继续收口”，两份 “当前权威入口” 进度口径不同。 |
| 69 | `docs_zh/operations/release-versioning.md` 与 `docs_zh/operations/operations-checklist.md` 同为发布相关，互不引用对方的 “Pre-Launch Top 20” 清单。 |

### 2.9 文档自身声明矛盾

| 编号 | 问题 |
|---|---|
| 70 | `docs_zh/CHANGELOG.md:3` 写 “当前发布基线：`0.1.0`”，但根 `CHANGELOG.md` 第 3 行起为 `## [Unreleased]`，无显式 0.1.0 条目（口径不一）。 |
| 71 | `docs_zh/reviews/issues-table.md:780` 等行声称 “新增” `docs_zh/architecture/sync-async-service-pairs.md`，与 `current_todo_list.md` 已归档基线无对账记录。 |
| 72 | AGENTS.md:4 强调 `src/sdk/harness-sdk/` 是 “harness-facing SDK code”，实际目录仅含 `index.ts` 一个文件（约 600+ 行），未形成独立 SDK 结构。 |

### 2.10 其他

| 编号 | 问题 |
|---|---|
| 73 | `docs_zh/operations/npm-scripts.md` 全文英文，与 `docs_zh/` 中文策略不一致。 |
| 74 | `docs_zh/operations/test_coverage_baseline_gate.md` 第 11 行起仍英文。 |
| 75 | `docs_zh/contracts/` 共 151 文件，但 `docs_zh/contracts/README.md:24-39` 仅列 v4.3 freeze 13 类入口，其余 138 份在 README 中无索引（与 `docs_zh/architecture/README.md` 编号风格相比缺失结构）。 |

## 三、UI（`ui/`）问题

### 3.1 占位 / Mock / 缺少 API 集成

| 编号 | 问题 |
|---|---|
| 76 | `ui/packages/features/feature-flags/src/web/index.tsx:3-9` `FeatureFlagsWebView` 仅返回静态 `&lt;h2&gt;` 与说明文字，未消费 `useFeatureFlagsVm`，与 `permission: "admin+"` 的定级不符。 |
| 77 | `ui/packages/features/feature-flags/src/hooks/index.ts:8` 用 `{} as never` + `as Promise&lt;...&gt;` 双重断言，且 hook 无消费者。 |
| 78 | `ui/packages/features/{memory-review,release-console,trace-explorer,policy,audit,compliance,dispatch,inspect,workflow-builder,workflow-debugger}/src/hooks/index.ts:5-13` 全部返回硬编码静态 `items`，但模块声明为 `Implemented/Contracted` 或 `Implemented/Internal`（如 `release-console/src/index.tsx:13`、`trace-explorer/src/index.tsx:13`），与 “无后端集成” 严重不符。 |
| 79 | `ui/packages/features/{agent-manager,marketplace,explainability,cost-center,audit,inspect,dispatch,memory-review,release-console,trace-explorer,policy,workflow-debugger}/src/web/index.tsx:11-15` 传给 `FeatureWorkbenchPanel` 的 `actions` 均无 `onTrigger`；按钮点击只在 `packages/ui-core/src/components/index.ts:154-160` 写一条假 “activity” 日志，无任何真实业务动作。 |
| 80 | `ui/packages/features/workflow-builder/src/web/index.tsx:10-18` DAG 节点 `Observe / Plan / Execute` 与边 `e1/e2` 是写死的演示图，并非来自 `vm`。 |
| 81 | `ui/packages/features/task-cockpit/src/hooks/index.ts:78-87` `evidenceChain` 由 `Array.from({ length: ... evidenceCount })` 在前端凭计数虚构生成。 |
| 82 | `ui/packages/features/workflow-debugger/src/mobile/index.ts:7` 直接给用户展示占位文字 “Awaiting backend debugger seam”。 |
| 83 | `ui/apps/electron-win/src/renderer.js:1-43` Electron 渲染进程是手写 DOM 占位（"Electron Windows Shell Baseline"），未加载 React 主应用 `@aa/web`，桌面端实际无功能页面。 |
| 84 | `ui/apps/web/src/app-shell.tsx:356-366` `createFeatureGuardContext` 把 `tenantId: "tenant-default"`、`domainId: "platform"`、`permissions: ["authenticated"]`、`roles: ["operator"]`、`mode: "enterprise"` 全部硬编码，未对接真实身份/租户。 |

### 3.2 类型断言绕过

| 编号 | 问题 |
|---|---|
| 85 | `ui/packages/features/feature-flags/src/hooks/index.ts:8` `{} as never` + `as Promise&lt;readonly FeatureFlagDTO[]&gt;` 双重断言。 |
| 86 | `ui/packages/features/conversation/src/hooks/index.ts:141` `} as never);` 屏蔽 `ConversationClient` 构造类型校验。 |
| 87 | `ui/packages/features/task-cockpit/src/hooks/index.ts:57-60` `(useTasksQuery as unknown as (...) =&gt; ...)` 重新强转 hook 类型。 |
| 88 | `ui/apps/web/src/app-shell.tsx:380` `features as unknown as readonly WebFeatureModule[]` 强转外部 `FeatureModule`，掩盖 `subPages` 字段类型差异。 |

### 3.3 console / 错误处理

| 编号 | 问题 |
|---|---|
| 89 | `ui/apps/web/src/app-shell.tsx:148` `Report Issue` 按钮唯一动作是 `console.error("ui.feature_render_error", ...)`，无上报渠道。 |
| 90 | `ui/apps/web/src/global-error-boundary.tsx:15-18` 全局错误边界仅 `console.error`，无遥测/上报。 |
| 91 | `ui/apps/web/src/main.tsx:12` `void registerWebServiceWorker();` 是 fire-and-forget，无 `.catch`，SW 注册失败将产生未处理 promise 拒绝。 |
| 92 | `ui/apps/electron-win/src/main.ts:122,125` `void openSecondaryWindow(...)` 与 `void showPlatformNotification(...)` 在快捷键回调中无 catch；`showPlatformNotification` 是同步函数却被 `void`（`main.ts:150-157`），语义错误。 |
| 93 | `ui/apps/web/src/app-shell.tsx:115-161` `FeatureErrorBoundary` 未实现 `componentDidCatch` 进行日志/遥测上报。 |
| 94 | `ui/apps/web/src/app-shell.tsx:222-230` `useMemo` 写在第 219 行 `if (resolvedFeature == null) return ...` 早返回之后，违反 React Hooks 规则，`features` 为空时会触发 hook 顺序错乱。 |

### 3.4 硬编码颜色 / 偏离 design tokens

| 编号 | 问题 |
|---|---|
| 95 | `ui/apps/web/src/app-shell.tsx:308` startup banner `background: "#12201a"` 硬编码。 |
| 96 | `ui/packages/features/approval/src/web/index.tsx:25` `#12201a / #334155` 硬编码。 |
| 97 | `ui/packages/features/workflow-cockpit/src/web/index.tsx:22` 同上。 |
| 98 | `ui/packages/features/workflow-builder/src/web/index.tsx:21` `border: "1px solid #334155"` 硬编码。 |
| 99 | `ui/packages/features/conversation/src/web/index.tsx:59` `#334155` 硬编码。 |
| 100 | `ui/packages/features/hitl/src/web/index.tsx:55` `#334155` 硬编码。 |
| 101 | `ui/packages/features/workflow-cockpit/src/web/dag-viewer.tsx:21,88,119,165` `#2563eb`、`#04130a` 等硬编码。 |
| 102 | `ui/apps/mobile/src/App.tsx:100,103` `#F7F8FA`、`#4B5563` 硬编码。 |
| 103 | `ui/packages/ui-mobile/src/components/index.tsx:239-414` 大量 `#FFFFFF / #333333 / #666666 / #0066CC / #6B4F00 / ...`（20+ 处）硬编码，不引用 `designTokens`。 |
| 104 | `ui/packages/features/governance-compliance/src/web/index.tsx:9` `color: "var(--color-text)"` 引用未定义的 CSS 变量（`tokens.css` 暴露的是 `--aa-color-text`），命名前缀不一致。 |

### 3.5 死 CSS / 死代码

| 编号 | 问题 |
|---|---|
| 105 | `ui/packages/ui-core/src/design-tokens/tokens.css` 整 264 行 CSS 从未被任何 `.ts/.tsx/.html` 通过 `import` 加载（grep 仅命中自身），属事实上的死 CSS；同时与 JS 中 `designTokens` 内联样式方案完全脱节。 |
| 106 | `ui/apps/web/src/feature-registry.ts:77` `export const LazyFeatureDashboard = dashboard;` 命名为 `Lazy*` 但未做 `lazy()` 或动态导入，是误导性别名（且 `tests/unit/ui/apps/web/feature-registry.test.ts:173-176` 仍断言 “is Lazy component”）。 |

### 3.6 命名 / 结构不一致

| 编号 | 问题 |
|---|---|
| 107 | `ui/apps/web/src/feature-registry.ts:1-29` 全部走 `@aa/feature-*` 路径别名；唯独第 30-33 行 `feature-flags`、`memory-review`、`release-console`、`trace-explorer` 用 `../../../packages/features/...` 三级相对路径；`tsconfig.json:31-...` 也未给这四个特性提供 `@aa/feature-*` paths 映射。 |
| 108 | `ui/apps/web/src/app-shell.tsx:30-32` 重新定义 `WebFeatureModule = Omit&lt;FeatureModule, "subPages"&gt; & ...`，强行覆盖 `@aa/ui-core` 的 `FeatureModule.subPages` 类型，导致第 380 行需要 `as unknown as` 强转。 |
| 109 | `ui/apps/web/src/feature-registry.ts:36-39` 导出的 `missionControlFeatureContracts` 在 shell 内未被使用，看起来是残留契约。 |
| 110 | `ui/packages/features/{analytics,workflow-builder}/src/index.tsx:13-14` 同时设置 `status: "Planned"` 与 `kind: "planned"`；而 `release-console/src/index.tsx:13`、`trace-explorer/src/index.tsx:13` 等只有 `status` 没有 `kind`，状态字段使用风格不一致。 |
| 111 | `ui/apps/web/index.html:2` 与 `ui/apps/electron-win/index.html:2` `&lt;html lang="en"&gt;`，但 UI 文案大量为中文（`packages/features/*/src/web/index.tsx` 的 `summary` 与按钮 label 大量中文）。 |
| 112 | `ui/apps/web/src/app-shell.tsx:87,97,109,132,144,152,220,319,335` `Loading...` / `Access denied` / `Go Back` / `Something went wrong` / `Retry` / `Report Issue` / `No features available` / `Preparing shell` 等用户可见文案未走 `translateMessage`，硬编码英文。 |
| 113 | `ui/packages/features/workflow-cockpit/src/web/index.tsx:31,71,73`、`approval/src/web/index.tsx:35,38,52-87`、`task-cockpit/src/web/index.tsx:57,82,86-88` 等：`No workflow selected`、`Approve / Reject / Pause / Cancel / Take Over / Escalate / Batch Approve` 等英文硬编码未 i18n。 |
| 114 | `ui/packages/features/workflow-debugger/src/mobile/index.ts:5-7`、`workflow-builder/src/hooks/index.ts:10`、`compliance/src/hooks/index.ts:17` 同一组件中英混排。 |

### 3.8 可访问性

| 编号 | 问题 |
|---|---|
| 115 | `ui/packages/features/task-cockpit/src/web/index.tsx:62-66, 73-77` 两处 `&lt;input&gt;` 无 `aria-label`、无 `&lt;label htmlFor&gt;`、无 `name`，仅靠 `placeholder` 提示。 |
| 116 | `ui/apps/web/index.html:1-12` 没有 `&lt;meta name="description"&gt;`、没有 `&lt;link rel="icon"&gt;`，根 `&lt;div id="root"&gt;` 内无回退文案。 |
| 117 | `ui/apps/web/src/app-shell.tsx:96-112` AccessDenied `section role="alert"` 仅含标题与 `&lt;p&gt;{reason}&lt;/p&gt;`；`reason` 可为 `null`，会渲染空段落。 |
| 118 | `ui/apps/electron-win/index.html:13` 把 “Electron Windows Shell Baseline” 占位文字直接交付给用户。 |

### 3.9 硬编码 URL / 端口

| 编号 | 问题 |
|---|---|
| 119 | `ui/tools/e2e/src/smoke.spec.ts:3`、`tools/mock-server/src/index.ts:84,92`、`playwright.config.ts:4`、`lighthouserc.json:5-11`、`tests/tools/tooling.test.ts:70,81` 多处 `127.0.0.1:4173` 端口硬编码，未抽常量。 |

### 3.10 其他

| 编号 | 问题 |
|---|---|
| 120 | `ui/packages/features/dashboard/src/web/index.tsx:39` `Validation Drilldown` 标题硬编码英文未 i18n，与同文件已用 `translateFeatureCopy("dashboard")` / `translateMessage` 风格冲突。 |
| 121 | `ui/apps/web/src/app-shell.tsx:79-90` `LoadingFallback` 同时设置 `aria-busy="true"` 与 `role="status"`，内容仅 `Loading...`，无 i18n key。 |
| 122 | `ui/apps/web/src/feature-registry.ts:23` 导入名 `workflowDebugger` 与 JS `debugger` 关键字接近，且文件其它位置显示为 `debugger-replay/debugger-failure/debugger-export`，命名容易混淆。 |
| 123 | 根 `package.json` 的 `test:ui-p1-features` 引用 5 个测试文件均存在，但同目录还有 `compliance.test.tsx`、`feature-i18n.test.ts`、`flows.test.tsx`、`mission-control-wiring.test.ts` 这 4 个测试未被根脚本覆盖，UI P1 测试入口与实际测试集合不对齐。 |
| 124 | `ui/package.json:30` `lint` 把 `tools/**/*.ts` 与 `tests/**/*.{ts,tsx}` 纳入；但 `ui/eslint.config.js` 是否覆盖这些模式未在脚本上有别名校验；如 `tools/` 含 `*.mjs`（`ui/scripts/*.mjs`）则未被 lint。 |
| 125 | `ui/package.json:31` `bundle:analyze` 调用 `./scripts/bundle-analysis.mjs`，但 `lint` 脚本只匹配 `.ts/.tsx`，该 `.mjs` 不会被 ESLint 检查。 |

## 四、`tests/` 与测试基础设施问题

### 4.1 空文件 / 无断言测试

| 编号 | 问题 |
|---|---|
| 126 | `tests/unit/platform/shared/cache/cache-metrics-collector.test.ts:1` 文件 0 字节。 |
| 127 | `tests/unit/domains/onboarding/index.test.ts:1` 仅 `export { } from "./domain-onboarding-service.test.js";`，无任何用例。 |
| 128 | `tests/unit/testing/test-cleanup.test.ts:10` `resetAllSingletons does not throw` 仅调用一次函数无 `assert`。 |
| 129 | `tests/integration/testing/process-guard.test.ts:11, 17, 23, 31` 4 个用例全部无 `assert`。 |

### 4.2 package.json 引用不存在的测试

| 编号 | 问题 |
|---|---|
| 130 | `package.json:165` `test:pg-integration` glob `dist/tests/integration/storage/**/*.test.js`，但 `tests/integration/storage` 目录不存在；PG 测试实际位于 `tests/integration/platform/state-evidence/truth/postgres/`。 |
| 131 | `package.json:166` `test:secret-providers` 指 `dist/tests/integration/security/secret-provider-integration.test.js`，源文件实际在 `tests/integration/platform/security/secret-provider-integration.test.ts`（中间多一层 `platform/`）。 |
| 132 | `package.json:240` `artifact:integrity` 引用 `tests/unit/platform/state-evidence/artifacts/artifact-governance-service.test.ts`，该文件及目录均不存在。 |

### 4.3 测试中遗留 console.*

| 编号 | 问题 |
|---|---|
| 133 | `tests/integration/platform/structure/structure-validation.integration.test.ts:31,33,67,79,81,97,122,124,138,157` 大量 `console.log`。 |
| 134 | `tests/integration/sdk/admin-sdk-integration.test.ts:106` `console.warn("Unhandled fetch...")` 未静默/捕获。 |
| 135 | `tests/performance/platform/state-evidence/event-bus.perf.test.ts:67-71, 113` 含临时调试 `console.log("ISSUE #2033 DETECTED: ...")`。 |

### 4.4 抖动（基于固定 setTimeout）

| 编号 | 问题 |
|---|---|
| 136 | `tests/integration/platform/execution/concurrency-invocation.test.ts:642` 硬等 1.6s。 |
| 137 | `tests/integration/platform/control-plane/incident-control/takeover-escalation-manager-integration.test.ts:289` 硬等 500ms。 |
| 138 | `tests/unit/platform/shared/stability/process-guard.test.ts:54` 硬等 600ms（注释承认抖动）。 |
| 139 | `tests/integration/platform/security/process-tracker-sandbox.test.ts:42, 54, 100, 127` 多处 100/200/500ms 等待。 |
| 140 | `tests/integration/platform/state-evidence/events/durable-event-bus.integration.test.ts:435`（150ms）、`durable-event-bus-integration.test.ts:76, 162, 229, 242` 等多处 50ms。 |
| 141 | `tests/integration/platform/interface/ingress/distributed-rate-limiter-integration.test.ts:40`（150ms）、`tests/integration/platform/shared/observability/sli-slo-integration.test.ts:363`（120ms）、`tests/integration/platform/stability/circuit-breaker.test.ts:55, 72, 145`（60–120ms）。 |
| 142 | `tests/integration/core/runtime/bootstrap.test.ts:127` 100ms。 |

### 4.5 硬编码 localhost / 端口

| 编号 | 问题 |
|---|---|
| 143 | `tests/unit/sdk/cli/oauth-pkce-login-flow.test.ts:19, 34, 63, 121, 141, 178, 198, 223` 8 处重复 `http://127.0.0.1:8787/callback`。 |
| 144 | `tests/unit/sdk/cli/api-server.test.ts:30, 174` 硬编码 `http://localhost:4318` 与 `http://127.0.0.1:8080`。 |
| 145 | `tests/unit/scale-ecosystem/integration/invoke-callback.test.ts:13, 23, 34, 46, 57, 67, 77` 与 `integration-index.test.ts:65, 78, 92` 大量 `http://localhost:9999/...`，且第 23 行 `localhost:80`（特权端口）。 |
| 146 | `tests/integration/sdk/migrate-sqlite-to-pg.test.ts:141` DSN `postgresql://user:secretpassword123@localhost:5432/testdb` 明文密码。 |
| 147 | `tests/integration/platform/security/http-api-server.test.ts:158` 硬编码 OTel 端点 `http://localhost:4318`。 |

### 4.6 测试位于错误的层

| 编号 | 问题 |
|---|---|
| 148 | `tests/unit/quality/full-coverage-{operational-,}real-paths.test.ts` 在 unit 下 `execFileSync` 启动子进程，属 e2e。 |
| 149 | `tests/unit/scripts/run-layered-tests.test.ts`、`run-tracked-tests.test.ts`、`clean-dist.test.ts`、`check-changelog.test.ts`、`platform-validation-closure.test.ts`、`generate-src-module-test-matrix.test.ts` 全部 `spawn` 子进程跑实际脚本，应在 integration。 |
| 150 | `tests/unit/platform/shared/stability/process-guard.test.ts` spawn 子进程 + 600ms 时序，应为 integration。 |
| 151 | `tests/unit/scale-ecosystem/marketplace-balance-ratchet.test.ts`、`pack-security-integration.test.ts`、`pack-security-service.test.ts`、`marketplace/pack-security-comprehensive.test.ts` 全部 spawn 子进程却放 unit。 |
| 152 | `tests/unit/platform/control-plane/incident-control/industrial-ops-program-service.test.ts`、`operations-governance-service.test.ts`、`enterprise-governance-service.test.ts` spawn CLI，应在 integration。 |
| 153 | `tests/fixtures/migration/migration-fixtures.test.ts`（258 行真实测试）放在 fixtures 下，违反 “fixtures 只放 fixture” 约定（AGENTS.md 已明示 `tests/fixtures/packs/` 仅用于命名/验证夹具）。 |

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
| 160 | `tests/fixtures/packs/{123-pack,123test,my-pack-id,my.pack.id,my_pack_id,ops.core,test-pack,test.pack,test_pack}` 9 个目录无任何源码或测试引用（grep 仅命中自身 README）。每个目录还自带 `tests/unit.test.ts`，可能被 layered runner 误抓。 |
| 161 | `tests/fixtures/packs/test-pack/tests/integration.test.ts` 与 `simulation.test.ts` 各只一个 `assert.ok(true)` 占位。 |
| 162 | `tests/fixtures/migration/generate-snapshots.ts` + `snapshots/manifest.json` 仅被 `migration-fixtures.test.ts` 引用，整套位于错误位置（fixtures 内含活跃测试）。 |

### 4.10 未引用的 golden 快照

| 编号 | 问题 |
|---|---|
| 163 | `scripts/ci/audit-golden-snapshots.mjs` 仅校验 “被使用的快照存在”，不校验 “存在的快照被使用”。下列 37 份 `.golden` 全仓 grep 不到引用：<br>     - `tests/golden/snapshots/audit-context-schema-v1.golden`<br>     - `canonical-contract-names-v1.golden`<br>     - `config-bootstrap-v1.golden`、`config-bootstrap-dependency-order-v1.golden`<br>     - `config-domains-v1.golden`、`config-domains-risk-spec-v1.golden`<br>     - `config-runtime-v1.golden`、`config-runtime-circuit-breaker-v1.golden`、`config-runtime-event-registry-v1.golden`、`config-runtime-fiveplane-v1.golden`、`config-runtime-rate-limit-v1.golden`、`config-runtime-retry-policy-v1.golden`、`config-runtime-state-machine-v1.golden`<br>     - `config-security-v1.golden`、`config-security-remote-worker-v1.golden`<br>     - `contract-schema-version-v1.golden`<br>     - `create-budget-ledger-v1.golden`、`create-confirmed-task-spec-high-risk-v1.golden`、`create-harness-run-v1.golden`、`create-node-run-v1.golden`、`create-task-draft-v1.golden`<br>     - `enforce-responsibility-boundary-v1.golden`、`to-responsibility-boundary-v1.golden`<br>     - `harness-run-status-enum-v1.golden`、`node-run-status-enum-v1.golden`、`plan-node-type-enum-v1.golden`、`risk-class-enum-v1.golden`<br>     - `minimal-workflow-to-plan-graph-bundle-v1.golden`、`rollout-metrics-schema-v1.golden`<br>     - `platform-bootstrap-summary-v1.golden`、`platform-bootstrap-layers-v1.golden`、`platform-bootstrap-planes-v1.golden`、`platform-layer-count-match-v1.golden`、`platform-plane-count-match-v1.golden`、`platform-startup-order-v1.golden`、`platform-validate-startup-order-correct-v1.golden`、`platform-validate-startup-order-incorrect-v1.golden` |

### 4.11 自实现 skip 通道

| 编号 | 问题 |
|---|---|
| 164 | `tests/integration/sdk/cli/ops-cli.test.ts:33-43` `serialTest(name, optionsOrFn, maybeFn)` 把任意字符串作为 `skip` 透传，无 ticket / TODO 校验，未在 `audit:test-exclusions` 流程体现。 |
| 165 | `tests/fixtures/migration/migration-fixtures.test.ts:21-30` `isCompatibleFixtureSkip()` + `getCompatibilitySkipBudget()` 维护 “已知遗留迁移可跳过预算”，注释只说 “current known legacy backfills”，无 issue/contract 引用。 |

### 4.12 其他可疑实现

| 编号 | 问题 |
|---|---|
| 166 | `tests/unit/plugins/plugin-runtime-host.test.ts:105` 覆盖 `process.execArgv = ["--inspect=127.0.0.1:9229", "--debug", "--prof", ...]`，若 finally 未复原会污染同进程后续 unit 测试。 |
| 167 | `tests/integration/platform/interface/api/http-api-server-architecture-regressions.test.ts:266` 在断言完成路径中夹 40ms 等待，对负载敏感。 |
| 168 | `tests/unit/platform/interface/api/http-api-server.test.ts:1712` 出现具体端口 `43123` 字面量预期（`baseUrl: "http://127.0.0.1:43123"`），上游分配端口逻辑变化将立即破断。 |

## 五、配置 / 构建 / 部署 / 脚本问题

### 5.1 package.json 脚本 / 路径错误

| 编号 | 问题 |
|---|---|
| 169 | `package.json:240` `artifact:integrity` 引用 `tests/unit/platform/state-evidence/artifacts/artifact-governance-service.test.ts`，文件及目录均不存在。 |
| 170 | `package.json:165` `test:pg-integration` 的 glob 永远匹配为空（同问题 130）。 |
| 171 | `package.json:166` `test:secret-providers` 路径错误（同问题 131）。 |
| 172 | `package.json:165–166` 先 `npm run build:test`（= `tsc -p tsconfig.build.json`），但 **tsconfig.build.json:6-7** 仅 `include: src/**/*.ts` 且 `exclude: ["dist","node_modules","tests"]`，根本不会产生 `dist/tests/**` 输出。即修对路径也无文件可跑。 |
| 173 | `package.json:181` `test:e2e:stage-exit` 引用 `tests/unit/platform/control-plane/mission-services.test.ts`：文件位于 `unit/` 却挂在 `test:e2e:*` 命名下，命名/目录契约不符。 |
| 174 | **AGENTS.md 自定** “raw node test concurrency 非 `--test-concurrency=12` 固定契约”，但 `package.json:165, 166` 直接硬编码 `--test-concurrency=1`，绕过 layered runner。 |
| 175 | `package.json:223–235` 该段缩进异常（2 空格 vs 文件其余 4 空格）；`format` 任务会重格式化导致 lint-staged 风格抖动。 |

### 5.2 tsconfig 矩阵

| 编号 | 问题 |
|---|---|
| 176 | `tsconfig.build-test.json` 整文件未被任何脚本/工作流引用——`build:test` 实际指向 `tsconfig.build.json`，属死配置。 |
| 177 | `tsconfig.json:30` `include` 仅 `src/**/*.ts`、`tests/**/*.ts`，不含 `helpers/`；但 `eslint.config.js:13` 把 `helpers/**/*.ts` 列入 lint 范围。`helpers/fs.ts` 被 lint 但不被 typecheck。 |
| 178 | `tsconfig.json:48,68,70,71,72,73` 大量 `exclude` 与 package.json 中 `node --import tsx --test ...` 引用同一文件冲突：<br>     - 排除 `tests/e2e/execution-ticket-lifecycle.test.ts`(:48) ↔ `package.json:213` `dispatch:validate`<br>     - 排除 `tests/integration/platform/control-plane/**/*.test.ts`(:70) ↔ `:196` `test:replay`、`:231` `test:runbook-automation`<br>     - 排除 `tests/integration/platform/execution/**/*.test.ts`(:71) ↔ `:239` `validation:bundle` 引用 `stable-evidence-bundle.test.ts`<br>     - 排除 `tests/integration/platform/interface/**/*.test.ts`(:72) ↔ `:192` `schema:strict` 引用 `schemas.validation.test.ts`<br>     - 排除 `tests/integration/interaction/**/*.test.ts`(:68) ↔ `:216` `autonomy:validate`<br>     - 排除 `tests/integration/platform/model-gateway/**/*.test.ts`(:73) ↔ `:211` `model:provider:test` |
| 179 | `tsconfig.scripts.json:11` `include` 只覆盖 `scripts/**/*.mjs` 与 `eslint.config.js`；但 `scripts/validation/export-platform-validation-artifacts.ts`、`scripts/validation/platform-product-validation.ts`（被 `package.json:190, 236-238, 241` 调用）从未被 typecheck。 |

### 5.3 ESLint 配置

| 编号 | 问题 |
|---|---|
| 180 | `eslint.config.js:19-21, 33-35` 启用 `@typescript-eslint/no-floating-promises`、`no-misused-promises`、`require-await`、`no-unsafe-assignment`、`no-unsafe-member-access` 等需要 type-aware linting 的规则，但全配置未声明 `parser`/`parserOptions.project`/`projectService`，规则将无声失效或抛错。 |
| 181 | `eslint.config.js:14` 把 `deploy/**/*.mjs` 加入 lint 范围，但 `deploy/scripts/` 仅含 `.sh`，全树无 `.mjs`。 |
| 182 | `package.json:136` `lint = eslint . --ext .ts,.js,.mjs,.tsx`，flat config 下 `--ext` 被忽略；`.tsx` 是否覆盖完全取决于 flat config 的 files 字段，而其中并无 `.tsx`，且 ui 又被 ignores 排除。 |

### 5.4 容器与部署

| 编号 | 问题 |
|---|---|
| 183 | `Dockerfile:5` 复制 `tsconfig.json`，但 `tsconfig.json:2-4` 含 `references: [{"path":"./ui/tsconfig.json"}]`；build 阶段未 `COPY ui` → `tsc` 解析 references 时会告警/失败。 |
| 184 | `docker-compose.yml:18-19` 设 `AA_PG_DSN`，而 `.env.example:30` 注释推荐 `AA_STORAGE_POSTGRES_DSN`；`src/platform/five-plane-control-plane/config-center/startup-env-schema.ts:402-406` 又强制要求两者要么只配一个、要么相等。文档与 compose 自相矛盾。 |
| 185 | `docker-compose.yml:23, 130` 卷名 `phase1a-data` 与当前 0.1.0 的去 phase1a 化叙述不一致；`.env.example:13` `AA_DB_PATH=./data/sqlite/phase1a-demo.db` 同样遗留。 |
| 186 | `docker-compose.yml:54` `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}`，但 `.env.example:19` `POSTGRES_PASSWORD=` 留空且无注释，初次 `docker compose up` 直接失败。 |
| 187 | `.env.example` 缺失代码实际读取的环境变量：`embedding-provider.ts:160, 175` 读 `AA_OPENAI_API_KEY`、`AA_MINIMAX_API_KEY`，模板未列出；反之模板列出的 `AA_PG_DSN` 与 `storage-backend-config.ts:195` 中 `["AA_STORAGE_POSTGRES_DSN","AA_PG_DSN","DATABASE_URL"]` 顺序不一致。 |
| 188 | `deploy/kubernetes/manifests/automatic-agent-smoke.yaml` `image: ghcr.io/holdenshen-hz/automatic-agent-platform:latest` 中 owner namespace `holdenshen-hz` 与 `deploy/helm/automatic-agent/Chart.yaml:11-13` 中 `https://github.com/automatic-agent/automatic-agent-platform` 及 `deploy/helm/automatic-agent/values.yaml:7` `repository: automatic-agent-platform` 不匹配。 |
| 189 | `deploy/helm/automatic-agent/Chart.yaml:2` `name: automatic-agent`，与 `package.json:2` 包名 `automatic-agent-platform`、Helm `image.repository: automatic-agent-platform` 不一致。 |

### 5.5 Division catalog

| 编号 | 问题 |
|---|---|
| 190 | `config/quality/division-catalog.json` 仅枚举 6 个 division（qa、quality-assurance、engineering_ops、general_ops、operations、it-operations）；而 `divisions/` 目录有 32 个 division（含 analytics、coding、content、design、devops、research、security、support 等 26 个），未在 catalog 登记，与 AGENTS.md 中 “catalog 是权威家族图” 的定位不一致。 |

### 5.6 版本

| 编号 | 问题 |
|---|---|
| 191 | `CHANGELOG.md` 仅 `[Unreleased]` 与 `[0.1.0] - 2026-05-14` 两条；`package.json:3` 仍 `0.1.0`，但 `[Unreleased]` 累积了 post-0.1.0 hygiene、contract-governance、review taxonomy 等多项改动，版本未递进，README 也无对应表。 |
| 192 | `CHANGELOG.md:7` `[0.1.0] - 2026-05-14` 与文件系统 mtime（2026-05-26）及 `[Unreleased]` 累积比对，代表 12 天累积变更未发版；`prepack`/`build` 不阻止以 0.1.0 重复发包。 |

### 5.7 .gitignore 与提交内容

| 编号 | 问题 |
|---|---|
| 193 | `.gitignore:29, 36` 列 `.audit/`、`.test-db/`，但工作树同时存在（`.audit/` 1.4M：`delegation/`、`quality.md`；`.test-db/` 2.5M：`*.db-shm`、`*.db-wal`），与 ignore 意图相悖，不应被提交。 |
| 194 | `.gitignore:6` `data/` 已递归忽略，`.gitignore:7-19` 又重复列 `data/sqlite/`、`data/stable-*`、`data/soak/`、`data/validation/` 等子目录，纯属冗余。 |
| 195 | `.gitignore:33-35` `dist_temp/`、`dist_test`、`dist-test/` 与 `:3` `dist_*/` 重复；`dist_test`（无尾斜杠）会同时匹配同名文件，模式不规范。 |
| 196 | `.gitignore:51-56` 主动忽略 `src/platform/{control-plane,execution,interface,orchestration,state-evidence}` 五个 legacy 兼容符号链接，使 CLAUDE.md:63 所谓 “compatibility-only” surface 在 git 层不可审计。 |

### 5.8 Stryker

| 编号 | 问题 |
|---|---|
| 197 | `stryker.config.mjs:32-39` `ignorePatterns` 以 `**` 开头再白名单，把 `tsconfig.build.json`、`tests/helpers/**` 等 mutation 子进程实际所需的辅助文件排除，执行 `mutation-critical-tests.sh` 时会因缺失 helper 失败。 |
| 198 | `stryker.config.mjs:45` `tsconfigFile: "tsconfig.json"` 含 `references: [{ path: "./ui/tsconfig.json" }]`；Stryker typescript-checker 要求 ui project 完整可解析，而 ui 工作区在变异沙箱中通常未初始化。 |

### 5.9 孤儿脚本

| 编号 | 问题 |
|---|---|
| 199 | `scripts/` 中孤儿脚本（无 package.json/工作流引用）：`run-curated-tests.mjs`、`run-tracked-tests.mjs`、`reorg-code-structure.mjs`、`curated-test-selection.mjs`、`generate-src-module-test-matrix.mjs`。 |
| 200 | `scripts/ci/` 中孤儿 audit 脚本：`audit-codebase-inventory.mjs`、`audit-document-structure.mjs`、`audit-domain-configs.mjs`、`audit-harness-index-split.mjs`、`audit-implementation-remediation.mjs`、`audit-review-batch-resource-contracts.mjs`、`audit-review-dependency-upgrade-plan.mjs`、`audit-review-domain-duplication.mjs`、`audit-review-governance-closures.mjs`、`audit-review-guardrails.mjs`、`audit-review-magic-number-examples.mjs`、`audit-review-runtime-schema-audit-columns.mjs`、`audit-review-unsafe-type-assertions.mjs`、`audit-sync-async-service-pairs.mjs`（部分仅被同样孤儿的 `audit-review-batch-resource-contracts.mjs` 引用，形成孤儿环）。 |

### 5.10 translate_docs.py

| 编号 | 问题 |
|---|---|
| 201 | `translate_docs.py:13` `import translators as ts` 引入第三方 PyPI 包 `translators`，仓库无 `requirements.txt`/`pyproject.toml` 声明该依赖。 |
| 202 | `translate_docs.py:185-223` 代码块解析逻辑：`elif in_code_block: parts.append(line + '\n')`(208) 与 `current += line + '\n'`(210) 同时追加换行；最终 `''.join(parts)` 在代码块前后产生多余空行，输出文件持续膨胀。 |
| 203 | `translate_docs.py:165` 单进程裸调 `ts.translate_text(... translator='google')`，无重试/退避/速率控制，大批量极易触发限流。 |

### 5.11 GitHub Actions

| 编号 | 问题 |
|---|---|
| 204 | `.github/workflows/ci.yml:97-99` `test:pg-integration` 通过 `AA_TEST_PG_DSN` 注入连接串，但 package.json:165 脚本本身不消费该变量（消费侧仅 `tests/helpers/pg-test-helper.ts:9`）；docker-compose 与生产路径用 `AA_PG_DSN`/`AA_STORAGE_POSTGRES_DSN`，三套环境变量名义并存且无统一收敛文档。 |
| 205 | `.github/workflows/ci.yml:170` trivy-scan 重新 `docker build -t automatic-agent`（无标签前缀），不复用 publish-image.yml 中的 `${IMAGE_REGISTRY}/${IMAGE_REPOSITORY}` 命名，无法保证扫描的与发布的是同一上下文产物。 |

## 第二轮补充（与前 205 条不重复）

### 6.1 `src/` 安全 / 数据正确性

| 编号 | 问题 |
|---|---|
| 206 | `src/sdk/cli/migrate-sqlite-to-pg.ts:206,229,236` 直接把列名 / 表名拼进 SQL 字符串（`INSERT INTO ${table}(${columns})...`），未做白名单校验；若表清单来源被污染即为 SQL 注入。 |
| 207 | `src/platform/five-plane-state-evidence/truth/sqlite/idempotency-key-storage.ts:202-244` 多处 `${this.tableName}` 直拼 SQL，未在构造期对 `tableName` 做 `^[A-Za-z_][A-Za-z0-9_]*$` 校验。 |
| 208 | `src/platform/five-plane-state-evidence/memory/semantic-vector-store.ts:166,308-309` 通过 `process.env[name]` 间接读密钥但 `name` 来自配置对象，未做白名单，存在受配置注入读取任意环境变量的风险。 |
| 209 | `src/platform/five-plane-state-evidence/checkpoint/checkpoint-gc-service.ts:486-510` `fs.stat` → `fs.unlink` 之间无 fd 锁，存在 TOCTOU 攻击窗口（与 GC 并发的 writer 可被误删）。 |
| 210 | `src/platform/five-plane-state-evidence/snapshot/shadow-snapshot-service.ts:422` 在 `lstat` 与 `rename` 之间存在 symlink swap 时间窗，未使用 `O_NOFOLLOW` 等价路径。 |
| 211 | `src/platform/five-plane-control-plane/config-center/api-server-env.ts:171` 与文档不一致：代码读 `AA_API_KEYS_JSON`，README/部署文档写 `AA_API_KEYS`，造成生产配置静默失败。 |
| 212 | `src/platform/five-plane-control-plane/config-center/startup-env-schema.ts:376` JWT 密钥校验对 `undefined` 走 default-allow 分支，缺密钥时仍可启动并签发 token。 |

### 6.2 `src/` 并发 / 资源泄漏

| 编号 | 问题 |
|---|---|
| 213 | `src/sdk/client-sdk/api-client.ts:178,605` 把 `Retry-After` 直接 `parseInt`，未识别 RFC 7231 HTTP-date 形式，遇 `Retry-After: Wed, 21 Oct 2026 07:28:00 GMT` 会得到 NaN 并立即重试。 |
| 214 | `src/scale-ecosystem/multi-region/region-health-check-service.ts:426-447` `fetch` 调用未透传 caller `AbortSignal`，主流程取消后探活仍继续直到超时。 |
| 215 | `src/platform/shared/lifecycle/graceful-shutdown.ts:235` 用 `setImmediate(() =&gt; process.exit(code))` 退出，stdout/stderr 未 flush，CI 上经常截断最后几行日志。 |
| 216 | `src/platform/shared/observability/slo-alerting-channels.ts:357-362` 在 `queueMicrotask` 内做同步阻塞 I/O，等价于把 fs 写入塞进 microtask 队列，阻塞事件循环。 |
| 217 | `src/platform/five-plane-execution/distributed-lock/pg-advisory-lock-adapter.ts` 取锁后无 `try/finally` 保护，throw 路径下 advisory lock 会留至连接释放。 |

### 6.3 `src/` 重复 / 死代码

| 编号 | 问题 |
|---|---|
| 218 | `src/sdk/cli/release-pipeline.ts:80` 与 `:110` 两处 `https://github.com/automatic-agent/automatic-agent-platform/actions/runs/${runId}` 字面量完全相同，未抽常量。 |
| 219 | `src/platform/five-plane-execution/tool-executor/skill-execution-{cache,core,support,service}-methods.ts` 四份 `*-methods.ts` 切片彼此重名导出 `*Methods`，被同一聚合文件 import，事实上是同一类的物理拆片，互相循环依赖。 |
| 220 | `src/platform/agent-delegation/index.ts`、`src/platform/ops-maturity/index.ts`、`src/runtime/agent-runtime/index.ts` 三个 compat shim 入口在 `package.json#exports` 中均未暴露且仓库内零引用，纯死代码。 |

### 6.4 `docs_zh/` ADR / contracts 二次发现

| 编号 | 问题 |
|---|---|
| 221 | `docs_zh/adr/README.md` 索引中 ADR-001 / ADR-069 / ADR-072 状态与正文 frontmatter 标注不一致（README 写 `Accepted`，正文写 `Proposed` 或反之）。 |
| 222 | `docs_zh/adr/018-...` 已被 superseded，但 `docs_zh/contracts/release_rollout_and_rollback_contract.md` 仍把 ADR-018 列为权威依据，未指向后继 ADR。 |
| 223 | `docs_zh/architecture/00-platform-architecture.md` 仅 21 行 stub，但被 README.md / CLAUDE.md / AGENTS.md 反复声称为 “权威架构入口”。 |
| 224 | `docs_zh/architecture/03-module-diagrams.md` 含 `§37–§69` 60+ 处指向不存在章节的内部锚点。 |
| 225 | `docs_zh/buglist.md:3-4` 头部 `Generated: 2026-05-02`，但仓库内多份 review 已是 2026-05-26 之后版本，buglist 长期未刷新。 |
| 226 | `docs_zh/migration/01-migration-scope.md:100-101` 写 “113 contracts / 38 ADR”，实际仓库 `docs_zh/contracts/` 151 文件、`docs_zh/adr/` 120 文件。 |
| 227 | `docs_zh/contracts/README.md` 与 `docs_zh/architecture/README.md` 编号风格不一致；contracts README 仅列 v4.3 freeze 13 项，缺整体目录骨架。 |

### 6.5 UI 二次发现

| 编号 | 问题 |
|---|---|
| 228 | `ui/apps/web/src/feature-registry.ts:30-33` 4 个特性走 `../../../packages/features/...` 相对路径，其余 26 个走 `@aa/feature-*` 别名；`ui/tsconfig.json:18-64` `paths` 也未给这 4 个加映射。 |
| 229 | `ui/package.json:10-15` `workspaces` 列表不含 `packages/features/*`，工作区仅靠 npm hoisting 解析。 |
| 230 | `ui/apps/web/package.json` 仅声明 2 个 dependencies，但 `apps/web/src/**` 实际 import 30+ `@aa/*` 包，全部未在 dependencies 中显式声明。 |
| 231 | `ui/apps/electron-win/package.json:13` `electron@^42.1.0` —— Electron 至本仓库扫描日不存在 42.x 主版本（最新稳定为 31.x），install 必失败。 |
| 232 | `ui/apps/web/src/app-shell.tsx:222-230` `GuardedFeatureRoute` 内除既有 hooks 顺序问题外，第二处 `useMemo` 也位于条件 `return` 之后，是同文件内的二次违规。 |
| 233 | `ui/packages/features/governance-compliance/src/index.tsx` 与 `ui/packages/features/analytics/src/index.tsx` 自身路由清单（`subPages`）声明的页面在 `src/web/index.tsx` 中并未实现，自相矛盾。 |

### 6.6 tests 二次发现

| 编号 | 问题 |
|---|---|
| 234 | `tests/performance/**/*.perf.test.ts` 中多处 `rmSync` 路径基于 `process.cwd()` + 硬编码相对路径；测试在 layered runner 改 cwd 后会越界删除非测试目录。 |
| 235 | `tests/integration/sdk/cli/ops-cli.test.ts:33-43` 的 `serialTest` skip 通道也允许传字符串名字到 `optionsOrFn`，与官方 `node:test` API 形状不兼容，长期掩盖参数传错。 |
| 236 | `tests/golden/snapshots/*.golden` 37 份未被引用的快照文件外，还存在 `audit-golden-snapshots.mjs:62` 仅校验单向（被引快照存在），不校验反向，是审计盲点。 |

### 6.7 config / scripts / deploy 二次发现

| 编号 | 问题 |
|---|---|
| 237 | `.claude/scheduled_tasks.json` 含 `&lt;&lt;&lt;&lt;&lt;&lt;&lt; Updated stashes` git 冲突标记字面量，且 `.claude/` 已在 `.gitignore` 中却仍被提交。 |
| 238 | `.github/workflows/ci.yml:4` `workflow_call:` 触发器声明为空合约，且与 `push:` / `pull_request:` 同时触发，会在合并 PR 时三重运行。 |
| 239 | `.github/workflows/ci.yml:62` 任务链中无 build 步骤，而下游脚本依赖 `dist/src/sdk/cli/stable-validate.js` 等编译产物。 |
| 240 | `.github/workflows/ci.yml:64-71` `actions/upload-artifact` 未设 `retention-days`，也未对工件做 SHA 校验。 |
| 241 | `.github/workflows/ci.yml:173` `aquasecurity/trivy-action@0.32.0` 是 mutable 浮动 tag，应锁 commit SHA。 |
| 242 | `.github/workflows/deploy-environment.yml:191` `helm upgrade --set image.repository=...:tag` 中含 `:`，被 helm 解析为 map 而非字符串。 |
| 243 | `.github/workflows/deploy-environment.yml:215-225` Promote 步骤跳过了二次健康闸门，与 `docs_zh/contracts/release_rollout_and_rollback_contract.md` 描述的双闸不一致。 |
| 244 | 所有 workflow 缺 `concurrency:` 与 minimal `permissions:`，对 push spam 与 token 越权无防护。 |
| 245 | 仓库根缺 `.github/CODEOWNERS`，PR 强制评审人路由依赖人工 @ 提及。 |
| 246 | `Dockerfile` build stage 与 `tsconfig.json` references 已述（#183）；此外 `Dockerfile` 不复制 `package-lock.json`（仓库存在）走 `npm ci` 路径，导致 lock 校验缺失。 |
