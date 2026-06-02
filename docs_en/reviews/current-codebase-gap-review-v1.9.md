# Current Codebase Gap Review v1.9

| Field | Value |
|---|---|
| Document version | v1.9 |
| Scan date | 2026-05-31 |
| Scan method | Automated scan (`scripts/scan-current-codebase-gap.mjs`) |
| Applicable document | `docs_zh/reference/automatic_agent_system_harness_improvement_plan_v1_9_architecture_release.md` |
| Conclusion | No top-level architecture conflicts exist between the current system and the v1.9 direction; the priority is to reuse, wrap, and extend existing implementations. Do not create a parallel second subsystem based on target names. |
| Current blockers | `lint:architecture-boundary` is implemented but not yet wired into CI enforce; real Owner/Reviewer are not yet bound. |

---

## 1. Scan scope

1. `src/platform/`
2. `src/org-governance/`
3. `src/sdk/`
4. `ui/`
5. `tests/`
6. `scripts/`
7. `.github/workflows/`
8. `package.json`

---

## 2. Existing commands and workflow evidence

### 2.1 Existing aggregate commands

| Command | Current implementation |
|---|---|
| `test:integration` | `AA_RUNNING_TESTS=1 AA_PRESERVE_DIST=1 node scripts/run-layered-tests.mjs integration` |
| `test:e2e` | `AA_RUNNING_TESTS=1 AA_PRESERVE_DIST=1 node scripts/run-layered-tests.mjs e2e` |
| `gate:stable` | `npm run build && node --enable-source-maps dist/src/sdk/cli/stable-gate.js` |
| `validate:stable:compiled` | `node --enable-source-maps dist/src/sdk/cli/stable-validate.js` |
| `prompt-injection:stable` | `npm run build && node --enable-source-maps dist/src/sdk/cli/stable-prompt-injection.js` |
| `security:tenant` | `node scripts/run-node-tests.mjs tests/e2e/tenant-boundary-flow.test.ts tests/unit/platform/control-plane/iam/access-model-authorization.test.ts` |
| `observability:smoke` | `node scripts/validation/platform-validation-closure.mjs monitoring && node scripts/run-node-tests.mjs tests/golden/deploy/prometheus-alerts.test.ts tests/golden/deploy/alertmanager-receivers.test.ts` |
| `docs:markdown-render` | `node scripts/validation/mission-operating-model-closure.mjs markdown-render` |
| `lint:architecture-boundary` | `node scripts/architecture-boundary-scan.mjs` |
| `scan:current-codebase-gap` | `node scripts/scan-current-codebase-gap.mjs` |

### 2.2 Existing CI workflows

1. `.github/workflows/ci.yml`
2. `.github/workflows/deploy-environment.yml`
3. `.github/workflows/dr-validation.yml`
4. `.github/workflows/publish-image.yml`
5. `.github/workflows/secret-provider-integration.yml`
6. `.github/workflows/ui-quality.yml`

Conclusion: the repository already has reusable test, validation, release, and UI quality workflows. Most of the P0 acceptance commands in the v1.9 document should first be bound to these existing aggregate commands, rather than creating new directories or new command names.

---

## 3. Capability mapping conclusion

| Capability | Current implementation evidence | Current state | Recommended action | Risk | Effort | Conclusion |
|---|---|---|---|---|---|---|
| Tool execution / registry boundary | `src/platform/five-plane-execution/tool-executor`, `src/platform/five-plane-orchestration/harness/toolbelt` | partial | wrap | medium | L | Do not create a second execution stack; add a facade / contract in front of the existing tool-executor. |
| Policy / Approval / Risk | `src/platform/five-plane-control-plane/risk-control/`, `src/platform/five-plane-control-plane/approval-center/`, `src/org-governance/approval-routing/` | partial | extend | medium | L | Converge on the existing risk control, approval, and routing. |
| Event Bus / Outbox / Receipt | `src/platform/five-plane-state-evidence/events/`, `src/platform/shared/outbox/`, `src/platform/five-plane-state-evidence/side-effect-ledger/` | partial | extend | medium | L | Should add a unified receipt contract rather than splitting out a new receipt subsystem. |
| Authoritative Task Store / Truth | `src/platform/five-plane-state-evidence/truth/`, `src/platform/five-plane-state-evidence/truth/authoritative-task-store.ts` | implemented | keep | low | M | Do not duplicate a second task source of truth. |
| Memory governance | `src/platform/five-plane-state-evidence/memory/`, `src/platform/five-plane-orchestration/harness/memory-manager.ts` | partial | wrap | medium | L | Add facade / proposal / revoke contracts instead of creating a parallel memory package. |
| Release / Rollout gate | `src/platform/shared/stability/stable-release-gate.ts`, `src/sdk/cli/release-pipeline.ts`, `src/platform/five-plane-control-plane/config-center/` | partial | extend | medium | L | Add release contract on top of the existing stability gate. |
| Evaluation / Harness grading | `src/platform/five-plane-orchestration/harness/evaluation/`, `src/platform/five-plane-orchestration/harness/eval-harness/` | implemented | keep | low | M | Do not duplicate an independent eval stack. |
| Observability | `src/platform/shared/observability/` | partial | extend | low | M | Add agent trace conventions rather than creating a second log/metric system. |
| Sandbox / execution guard | `src/platform/five-plane-execution/tool-executor/command-security.ts`, `src/platform/five-plane-execution/tool-executor/tool-path-scope.ts`, `src/platform/five-plane-orchestration/harness/sandbox/` | partial | wrap | medium | M | Extract shared contracts; only split directories when the existing boundary is insufficient. |
| Approval UI / API | `ui/packages/features/approval/`, `src/platform/five-plane-interface/api/http-server/approval-routes.ts`, `src/platform/five-plane-interface/console/hitl/` | partial | extend | low | M | Fill in capabilities; no need to rebuild the admin console. |
| Architecture boundary scan automation | `scripts/`, `.github/workflows/` | partial | new | high | M | Scan script is in place; next step is to wire detect-only results into the CI workflow and add an enforce toggling policy. |

---

## 4. Summary

1. implementationStatus: implemented=2, partial=9, missing=0
2. migrationMode: keep=2, wrap=3, extend=5, new=1
3. The real capability to strengthen is mainly automated scan wiring into CI and boundary lint enforce, not new business subsystems.

---

## 5. Cross-layer import candidates

1. tool executor cross-layer import candidates: 0
2. memory cross-layer import candidates: 10
3. stable release gate cross-layer import candidates: 0

Note: this is a heuristic scan result, used for initial filtering before the `lint:architecture-boundary` script is in place; it is not equivalent to a final violation determination.

---

## 6. Current conclusion

1. The v1.9 document is consistent with the current system direction.
2. The current system already has most of the implementation foundation.
3. The risk comes mainly from duplicated construction, not from direction conflicts.
4. The next step is to prioritize implementing `lint:architecture-boundary` and incorporating this scan into a CI-reproducible artifact.
