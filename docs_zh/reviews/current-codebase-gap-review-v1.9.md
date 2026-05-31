# Current Codebase Gap Review v1.9

| 字段 | 内容 |
|---|---|
| 文档版本 | v1.9 |
| 扫描日期 | 2026-05-31 |
| 扫描方式 | 自动扫描（`scripts/scan-current-codebase-gap.mjs`） |
| 适用文档 | `docs_zh/reference/automatic_agent_system_harness_improvement_plan_v1_9_architecture_release.md` |
| 结论 | 现有系统与 v1.9 方向无顶层架构冲突；应以复用、包装、扩展现有实现为主，禁止按目标名词平行新建第二套子系统 |
| 当前阻断项 | `lint:architecture-boundary` 已落地但尚未接入 CI enforce；真实 Owner/Reviewer 未绑定 |

---

## 1. 扫描范围

1. `src/platform/`
2. `src/org-governance/`
3. `src/sdk/`
4. `ui/`
5. `tests/`
6. `scripts/`
7. `.github/workflows/`
8. `package.json`

---

## 2. 现有命令与工作流证据

### 2.1 已存在的聚合命令

| 命令 | 当前实现 |
|---|---|
| `test:integration` | `AA_RUNNING_TESTS=1 AA_PRESERVE_DIST=1 node scripts/run-layered-tests.mjs integration` |
| `test:e2e` | `AA_RUNNING_TESTS=1 AA_PRESERVE_DIST=1 node scripts/run-layered-tests.mjs e2e` |
| `gate:stable` | `npm run build && node --enable-source-maps dist/src/sdk/cli/stable-gate.js` |
| `validate:stable:compiled` | `node --enable-source-maps dist/src/sdk/cli/stable-validate.js` |
| `prompt-injection:stable` | `npm run build && node --enable-source-maps dist/src/sdk/cli/stable-prompt-injection.js` |
| `security:tenant` | `node --import tsx --test tests/e2e/tenant-boundary-flow.test.ts tests/unit/platform/control-plane/iam/access-model-authorization.test.ts` |
| `observability:smoke` | `node scripts/validation/platform-validation-closure.mjs monitoring && node --import tsx --test tests/golden/deploy/prometheus-alerts.test.ts tests/golden/deploy/alertmanager-receivers.test.ts` |
| `docs:markdown-render` | `node scripts/validation/mission-operating-model-closure.mjs markdown-render` |
| `lint:architecture-boundary` | `node scripts/architecture-boundary-scan.mjs` |
| `scan:current-codebase-gap` | `node scripts/scan-current-codebase-gap.mjs` |

### 2.2 已存在的 CI workflow

1. `.github/workflows/ci.yml`
2. `.github/workflows/deploy-environment.yml`
3. `.github/workflows/dr-validation.yml`
4. `.github/workflows/publish-image.yml`
5. `.github/workflows/secret-provider-integration.yml`
6. `.github/workflows/ui-quality.yml`

结论：仓库已经存在可复用的测试、验证、发布和 UI 质量工作流；v1.9 文档里的多数 P0 验收命令应先绑定到这些现有 aggregate 命令，而不是先造新目录或新命令名。

---

## 3. 能力映射结论

| 能力 | 当前实现证据 | 当前状态 | 推荐动作 | 风险 | 工作量 | 结论 |
|---|---|---|---|---|---|---|
| Tool execution / registry boundary | `src/platform/five-plane-execution/tool-executor、src/platform/five-plane-orchestration/harness/toolbelt` | partial | wrap | medium | L | 不应先新建第二套执行栈；应在现有 tool-executor 前加 facade / contract。 |
| Policy / Approval / Risk | `src/platform/five-plane-control-plane/risk-control/、src/platform/five-plane-control-plane/approval-center/、src/org-governance/approval-routing/` | partial | extend | medium | L | 以现有风控、审批、路由收敛为主。 |
| Event Bus / Outbox / Receipt | `src/platform/five-plane-state-evidence/events/、src/platform/shared/outbox/、src/platform/five-plane-state-evidence/side-effect-ledger/` | partial | extend | medium | L | 应补齐统一 receipt contract，不应先拆新 receipt 子系统。 |
| Authoritative Task Store / Truth | `src/platform/five-plane-state-evidence/truth/、src/platform/five-plane-state-evidence/truth/authoritative-task-store.ts` | implemented | keep | low | M | 不允许复制第二套任务真源。 |
| Memory governance | `src/platform/five-plane-state-evidence/memory/、src/platform/five-plane-orchestration/harness/memory-manager.ts` | partial | wrap | medium | L | 应补 facade / proposal / revoke contract，而非新建平行 memory 包。 |
| Release / Rollout gate | `src/platform/shared/stability/stable-release-gate.ts、src/sdk/cli/release-pipeline.ts、src/platform/five-plane-control-plane/config-center/` | partial | extend | medium | L | 应在现有稳定性门禁上补 release contract。 |
| Evaluation / Harness grading | `src/platform/five-plane-orchestration/harness/evaluation/、src/platform/five-plane-orchestration/harness/eval-harness/` | implemented | keep | low | M | 不要复制独立 eval stack。 |
| Observability | `src/platform/shared/observability/` | partial | extend | low | M | 应补 agent trace 口径，不应新建第二套日志/指标体系。 |
| Sandbox / execution guard | `src/platform/five-plane-execution/tool-executor/command-security.ts、src/platform/five-plane-execution/tool-executor/tool-path-scope.ts、src/platform/five-plane-orchestration/harness/sandbox/` | partial | wrap | medium | M | 可以提炼共享 contract；仅在现有边界不够时再拆目录。 |
| Approval UI / API | `ui/packages/features/approval/、src/platform/five-plane-interface/api/http-server/approval-routes.ts、src/platform/five-plane-interface/console/hitl/` | partial | extend | low | M | 补齐能力即可，不必重建 admin console。 |
| Architecture boundary scan automation | `scripts/、.github/workflows/` | partial | new | high | M | 扫描脚本已落地；下一步应把 detect-only 结果接入 CI workflow，并补 enforce 切换策略。 |

---

## 4. 汇总

1. implementationStatus: implemented=2, partial=9, missing=0
2. migrationMode: keep=2, wrap=3, extend=5, new=1
3. 真正需要补强的能力主要是自动化扫描接入 CI 和边界 lint enforce，而不是新的业务子系统。

---

## 5. 越层导入候选

1. tool executor 越层导入候选：0
2. memory 越层导入候选：10
3. stable release gate 越层导入候选：0

说明：这是启发式扫描结果，用于后续 `lint:architecture-boundary` 脚本落地前的初筛，不等同最终违规判定。

---

## 6. 当前结论

1. v1.9 文档与当前系统方向一致。
2. 当前系统已经具备大部分实施基础。
3. 风险主要来自重复建设，而不是方向冲突。
4. 下一步应优先实现 `lint:architecture-boundary`，并将本扫描纳入 CI 可复现产物。
