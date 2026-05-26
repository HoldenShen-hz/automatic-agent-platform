# Current Codebase Gap Review v1.9

| Field | Content |
|---|---|
| Document Version | v1.9 |
| Scan Date | 2026-05-26 |
| Scan Method | Automated scan (`scripts/scan-current-codebase-gap.mjs`) |
| Applicable Document | `docs_zh/reference/automatic_agent_system_harness_improvement_plan_v1_9_architecture_release.md` |
| Conclusion | No top-level architecture conflicts between current system and v1.9 direction; prioritize reusing, wrapping, and extending existing implementations. Parallel new second subsystem based on target terminology is prohibited. |
| Current Blocker | `lint:architecture-boundary` has been implemented but not yet connected to CI enforce; real Owner/Reviewer not bound |

---

## 1. Scan Scope

1. `src/platform/`
2. `src/org-governance/`
3. `src/sdk/`
4. `ui/`
5. `tests/`
6. `scripts/`
7. `.github/workflows/`
8. `package.json`

---

## 2. Existing Commands and Workflow Evidence

### 2.1 Existing Aggregate Commands

| Command | Current Implementation |
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

### 2.2 Existing CI Workflows

1. `.github/workflows/ci.yml`
2. `.github/workflows/deploy-environment.yml`
3. `.github/workflows/dr-validation.yml`
4. `.github/workflows/publish-image.yml`
5. `.github/workflows/secret-provider-integration.yml`
6. `.github/workflows/ui-quality.yml`

Conclusion: The repository already has reusable test, validation, release, and UI quality workflows; most P0 acceptance commands from the v1.9 document should first be bound to these existing aggregate commands, rather than creating new directories or new command names first.

---

## 3. Capability Mapping Conclusions

| Capability | Current Implementation Evidence | Current Status | Recommended Action | Risk | Workload | Conclusion |
|---|---|---|---|---|---|---|
| Tool execution / registry boundary | `src/platform/five-plane-execution/tool-executor/、src/platform/five-plane-orchestration/harness/toolbelt/` | partial | wrap | medium | L | Should not build a second execution stack first; add facade/contract in front of existing tool-executor. |
| Policy / Approval / Risk | `src/platform/five-plane-control-plane/risk-control/、src/platform/five-plane-control-plane/approval-center/、src/org-governance/approval-routing/` | partial | extend | medium | L | Consolidate with existing risk control, approval, and routing. |
| Event Bus / Outbox / Receipt | `src/platform/five-plane-state-evidence/events/、src/platform/shared/outbox/、src/platform/five-plane-state-evidence/side-effect-ledger/` | partial | extend | medium | L | Should complete unified receipt contract, not build new receipt subsystem first. |
| Authoritative Task Store / Truth | `src/platform/five-plane-state-evidence/truth/、src/platform/five-plane-state-evidence/truth/authoritative-task-store.ts` | implemented | keep | low | M | Duplicating second task source is not allowed. |
| Memory governance | `src/platform/five-plane-state-evidence/memory/、src/platform/five-plane-orchestration/harness/memory-manager.ts` | partial | wrap | medium | L | Should add facade/proposal/revoke contract, not build parallel memory package. |
| Release / Rollout gate | `src/platform/shared/stability/stable-release-gate.ts、src/sdk/cli/release-pipeline.ts、src/platform/five-plane-control-plane/config-center/` | partial | extend | medium | L | Should add release contract on existing stability gate. |
| Evaluation / Harness grading | `src/platform/five-plane-orchestration/harness/evaluation/、src/platform/five-plane-orchestration/harness/eval-harness/` | implemented | keep | low | M | Do not duplicate independent eval stack. |
| Observability | `src/platform/shared/observability/` | partial | extend | low | M | Should add agent trace口径, not build second logging/metrics system. |
| Sandbox / execution guard | `src/platform/five-plane-execution/tool-executor/command-security.ts、src/platform/five-plane-execution/tool-executor/tool-path-scope.ts、src/platform/five-plane-orchestration/harness/sandbox/` | partial | wrap | medium | M | Can extract shared contract; only split directory when existing boundaries are insufficient. |
| Approval UI / API | `ui/packages/features/approval/、src/platform/five-plane-interface/api/http-server/approval-routes.ts、src/platform/five-plane-interface/console/hitl/` | partial | extend | low | M | Complete capability, no need to rebuild admin console. |
| Architecture boundary scan automation | `scripts/、.github/workflows/` | partial | new | high | M | Scan script has been implemented; next step is to connect detect-only results to CI workflow and add enforce toggle strategy. |

---

## 4. Summary

1. implementationStatus: implemented=2, partial=9, missing=0
2. migrationMode: keep=2, wrap=3, extend=5, new=1
3. The capabilities that truly need strengthening are mainly automated scan connected to CI and boundary lint enforce, not new business subsystems.

---

## 5. Cross-layer Import Candidates

1. tool executor cross-layer import candidates: 0
2. memory cross-layer import candidates: 12
3. stable release gate cross-layer import candidates: 0

Note: This is heuristic scan result for initial screening before `lint:architecture-boundary` script implementation, not equivalent to final violation determination.

---

## 6. Current Conclusions

1. v1.9 document is aligned with current system direction.
2. Current system already has most implementation foundations.
3. Risks mainly come from redundant construction, not direction conflicts.
4. Next step should prioritize implementing `lint:architecture-boundary` and including this scan in CI reproducible artifacts.