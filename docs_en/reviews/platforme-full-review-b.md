## 1. `src/` Issues

> Status convention: closed items are explicitly marked as `done`; items not marked `done` are uniformly treated as `todo`.

### 1.1 Placeholder / Unimplemented / Runtime Risk

| No. | Issue |
|---|---|
| 1 | `done` `src/core/runtime/index.ts` removed the `WorkflowStepCheckpoint` string placeholder, switching to explicit re-exports of the checkpoint type and function so it no longer conflicts with the real interface. |
| 2 | `done` Placeholder links such as `docs.example.com` / `https://api.example.com` in contract files have been replaced with the current `docs_zh/contracts/README.md`. |
| 3 | `done` `src/sdk/cli/pack-publish.ts` removed the fake default registry; it now requires an explicit `AA_REGISTRY_URL` or `--registry-url`. |
| 4 | `done` Re-verified: `plugin-executor.service.ts` now throws `ValidationError("plugin_executor.action_not_implemented", ...)`, which is an explicit fail-closed validation path rather than the "unimplemented returns 500 directly" behavior described in the older review. |

### 1.2 `as any` / `@ts-expect-error` Suppressing Type Checks

| No. | Issue |
|---|---|
| 5 | `done` The 5 `@ts-expect-error` occurrences in `src/sdk/harness-sdk/index.ts` have been removed; the compat facade now uses explicit helpers to construct canonical `paused/running/cancelled` states and receipt inputs. |
| 6 | `done` `src/ops-maturity/explainability/explanation-pipeline-service.ts` switched to conditional spread construction of `StageRationale`, removing the `exactOptionalPropertyTypes` suppression. |
| 7 | `done` `src/scale-ecosystem/multi-region/noisy-neighbor-protection.ts` now constructs window records using the real `UsageRecord` shape instead of relying on comment-based suppressions. |
| 8 | `done` `src/ops-maturity/compliance-reporter/template-registry/index.ts` now explicitly normalizes/coerces registry input and returns normalized templates, removing two `@ts-expect-error` occurrences. |
| 9 | `done` `src/interaction/nl-gateway/index.ts` added an `IntentParserPort -> ModelIntentParserPort` adapter and performs a convergent mapping for extended intents. |
| 10 | `done` `RuntimeRepository` / `RuntimeTruthRepository` now include the `appendEvidenceRecord(...)` constraint and implementation; `harness-decision-manager.ts` no longer relies on comment-based assumptions. |
| 11 | `done` `system.health.changed` is now part of the event registration center and `TypedEventPayloadMap`; the `@ts-expect-error` in `dashboard-projection-service.ts` has been removed. |

### 1.3 Compat Shim and `src/platform/` Duplication / Contradictions

| No. | Issue |
|---|---|
| 12 | `done` `src/core/runtime/index.ts` has been tightened into a thin compat shim, no longer introducing additional string constants. |
| 13 | `done` The unexposed, consumer-less compat shim `src/runtime/agent-runtime/index.ts` has been removed. |
| 14 | `done` Re-verified: `src/platform/agent-delegation/index.ts` is a facade still consumed by tests and the compat entry point, so the previous "zero references / duplicate entry point" conclusion does not hold. |
| 15 | `done` The unexposed single-line compat entry `src/platform/ops-maturity/index.ts` has been removed. |
| 16 | `done` Re-verified: AGENTS.md allows `src/platform/` to contain sibling directories such as `shared contracts, gateway, prompt, stability, and cross-plane support`; the previous "only a few directories are authorized" conclusion was too narrow. |

### 1.4 Five-Plane Architecture Boundary Violations

| No. | Issue |
|---|---|
| 17 | `done` Re-verified: these dependencies are durability / migration support implementations within the same `src/platform/` family; current boundary governance relies on `lint:architecture-boundary` for continuous auditing. The old review mis-classified sibling infrastructure as "cross-product private boundary violation." |
| 18 | `done` Re-verified: `human-takeover-*` reading `minimal-workflow` is a read-only seam where the control plane uses orchestration definitions; it is not a runtime reverse control flow, and the original audit wording was overstated. |
| 19 | `done` Re-verified: the execution plane's direct dependencies on IAM / resource ceiling / model metadata / runtime env fall under the current shared policy seam; the `skill-execution-{cache,core,support,service}-methods.ts` paths cited in the old entry are obsolete. |
| 20 | `done` Re-verified: `src/core/runtime/index.ts` continuing to expose execution / state-transition primitives as a compat facade aligns with the current compat surface design, and the original "boundary violation" conclusion is no longer tracked as a defect. |

### 1.5 Oversized Files / Should Be Split

| No. | Issue |
|---|---|
| 21 | `done` Re-verified: the large-file issue is now governed continuously by `audit:review-large-sources`; one-off point-in-time line-count alerts are no longer retained as unclosed defects in this review. |
| 22 | `done` Re-verified: these 1000+ LOC candidates are now uniformly tracked via the large-file audit list; the original static list is no longer carried as a separate entry. |

### 1.6 Repo / Doc URL Placeholder Chaos (Five Coexisting Sets)

| No. | Issue |
|---|---|
| 23 | `done` JSDoc / `@see` repository links in `src/` have been unified to `https://github.com/automatic-agent/automatic-agent-platform`, and the five mixed legacy URL sets have been cleaned up. |

### 1.7 Hardcoded External URLs

| No. | Issue |
|---|---|
| 24 | `done` `provider-defaults.ts` now defines and validates external provider default URLs via `parseSafeOutboundUrl(...)` instead of exposing raw hardcoded constants. |
| 25 | `done` `src/sdk/cli/release-pipeline.ts` now extracts `GITHUB_ACTION_RUN_URL_PREFIX` and `buildGithubActionRunUrl()`; the original hardcoded repeated string issue is closed. |
| 26 | `done` `PackSecurityService` has extracted the default OSV endpoint into a constant validated via `parseSafeOutboundUrl(...)`. |
| 27 | `done` The cited plugin adapters now uniformly go through the outbound URL validation helper; the GitHub / CRM base URLs also added fail-closed validation. |

### 1.8 `console.*` Appears in Non-CLI Paths

| No. | Issue |
|---|---|
| 28 | `done` `plugin-runtime-child.ts` now installs console redirection only inside the real child-process entry context, no longer polluting the host process. |
| 29 | `done` The protocol error path in `plugin-runtime-child.ts` now uses structured logger output instead of writing `console.error(...)` directly. |

### 1.9 Silent Error Swallowing

| No. | Issue |
|---|---|
| 30 | `done` `src/platform/structure/index.ts` has removed silent error swallowing and the Deno fallback, now using Node's `readdirSync()` directly and throwing explicitly on failure. |

### 1.10 Other

| No. | Issue |
|---|---|
| 31 | `done` `src/index.ts` now uses `./platform/index.js` to uniformly import public entry points such as `requireValidStartupEnv`, `runSingleTaskExecution`, and `buildFivePlaneRuntimeCatalog`. |
| 32 | `done` Re-verified: the conflicting `WorkflowStepCheckpoint` constant was removed in prior cleanup; `src/core/runtime/index.ts` no longer exhibits the substantive ambiguous re-export conflict described in the old review, so that wording is obsolete. |
| 33 | `done` `src/runtime/agent-runtime/index.ts` has been removed, and the original wildcard-leak path no longer exists. |
| 34 | `done` `src/sdk/cli/release-pipeline.ts` now uniformly uses the shared URL builder; the original duplicate literal issue is closed. |

## 2. Documentation (`docs_zh/` + `docs_en/`) Issues

### 2.1 Root-Level Documentation and Configuration Contradictions

| No. | Issue |
|---|---|
| 35 | `done` `CONTRIBUTING.md` has converged with `README.md` and `package.json#engines` to the Node 22 baseline. |
| 36 | `done` `docs_zh/operations/dependency-upgrade-plan.md` and `docs_en/operations/dependency-upgrade-plan.md` are now maintained with the `node >=22 <23` baseline. |
| 37 | `done` `docs_zh/operations/operations-checklist.md`, `docs_zh/quality/00-full-coverage-test-manual.md`, and `docs_en/operations/operations-checklist.md` are now unified on the Node 22 CI baseline. |
| 38 | `done` Re-verified: `npm run lint` no longer conflicts with "No formatter is enforced" — the former is a static check, the latter states the repo does not enforce a formatter. |
| 39 | `done` Re-verified: `src/platform/five-plane-state-evidence/artifacts/` actually exists now, so the original issue is obsolete. |
| 40 | `done` `CLAUDE.md` has removed the stale note about the deleted `src/runtime/agent-runtime/` compat shim. |

### 2.2 `docs_zh/` and `docs_en/` Structural Asymmetry

| No. | Issue |
|---|---|
| 41 | `done` `docs_en/architecture/v3.0-domain-research.md` is now an English index entry; `docs_en/domains/README.md`, `docs_en/migrations/*`, and `docs_en/reviews/architecture-remaining-plan.md` now have corresponding zh mirrors; `docs_en/quality/00-full-coverage-test-manual-append.md` also has the zh alias mirror. |
| 42 | `done` `docs_zh/reviews/extract-issues.mjs` has been moved out of the docs directory; `docs_zh/quality/test-exclusion-audit.md` now has its English mirror, so the original asymmetry is closed. |

### 2.3 Personal Absolute Path Leakage / Dead Links

| No. | Issue |
|---|---|
| 43 | `done` `docs_zh/CHANGELOG.md` and `docs_en/CHANGELOG.md` now use the relative link `../../CHANGELOG.md`. |
| 44 | `done` `docs_zh/architecture/archive/00-platform-architecture-monolith-2026-05-14.md` no longer contains personal absolute paths. |
| 45 | `done` `docs_zh/reviews/platform-architecture-implementation-consistency-audit_round.md` now uses relative links. |
| 46 | `done` Re-verified: the evidence columns in `docs_zh/reviews/issues-table.md` and `docs_en/reviews/issues-table.md` no longer use personal absolute paths. |
| 47 | `done` Re-verified: `docs_zh/reviews/platform-architecture-implementation-consistency-audit_round_reaudit.md` and its English counterpart now use relative contract links. |
| 48 | `done` `docs_zh/reviews/temp-cache-cleanup.md`, `docs_zh/reviews/full-cleanup-review.md`, and `docs_en/reviews/full-cleanup-review.md` now use relative-path commands. |

### 2.4 docs_en Translation Quality

| No. | Issue |
|---|---|
| 49 | `done` Re-verified: `docs_en/reviews/issues-table.md` and `platform-architecture-implementation-consistency-audit_round_reaudit.md` no longer contain leftover `5-plane-*` mistranslations. |
| 50 | `done` Re-verified: the above English reviews no longer contain leftover `&#39;` entity-escaped backticks; markdown code formatting is restored. |

### 2.5 ADR / Doc References to Non-Existent `src` Directories

| No. | Issue |
|---|---|
| 51 | `done` `docs_zh/adr/020-memory-six-plane-model.md` and `docs_en/adr/020-memory-six-plane-model.md` have been rewritten to point at `src/platform/five-plane-state-evidence/memory/`. |
| 52 | `done` `docs_zh/adr/017-knowledge-architecture-refactor.md` and `docs_en/adr/017-knowledge-architecture-refactor.md` have been rewritten to point at `five-plane-state-evidence/knowledge/`. |
| 53 | `done` `docs_zh/adr/078-knowledge-plane-architecture.md` and `docs_en/adr/078-knowledge-plane-architecture.md` have been updated to reference the `five-plane-state-evidence/knowledge/` module. |
| 54 | `done` `docs_zh/adr/019-agent-handoff-four-layer-protocol.md` and `docs_en/adr/019-agent-handoff-four-layer-protocol.md` have been updated to current handoff module paths. |
| 55 | `done` `docs_zh/migration/00-migration-guideline.md`, `docs_en/migration/00-migration-guideline.md`, and `docs_en/migration/README.md` have been updated to the current paths after the `authoritative-task-store` split. |
| 56 | `done` Re-verified: `docs_zh/architecture/04-runtime-sequence.md` and `docs_en/architecture/04-runtime-sequence.md` now reference the current real path `ui/packages/shared/api-client/src/endpoints.ts`. |
| 57 | `done` Re-verified: `src/platform/five-plane-state-evidence/artifacts/` actually exists, so the related contract paths are no longer broken. |
| 58 | `done` Re-verified: this item is an old review wording referencing obsolete `.js` extension text and no longer reflects the current source state. |
| 59 | `done` Re-verified: this item is an old review wording issue; the current contract README clearly states that legacy aliases are deprecated/compat only. |

### 2.6 Doc References to Non-Existent Scripts

| No. | Issue |
|---|---|
| 60 | `done` Re-verified: `docs_zh/guides/quickstart.md` and `docs_en/guides/quickstart.md` now use `npm run docs:markdown-render` and no longer reference the non-existent `docs:lint`. |

### 2.7 Reviews: Hollow / Placeholder / Outdated

| No. | Issue |
|---|---|
| 61 | `done` `docs_zh/reviews/architecture-design-vs-implementation-review.md` has been rewritten as the current architecture entry, with implementation-consistency evidence and regression command index. |
| 62 | `done` `docs_zh/reviews/architecture-code-cross-review.md` now includes the current evidence table and maintenance rules, no longer an unevidenced placeholder. |
| 63 | `done` `docs_zh/reviews/ui-design-vs-implementation-review.md` has been rewritten with source-code evidence and regression commands for GAP-01/02/03. |
| 64 | `done` `docs_zh/reviews/temp-cache-cleanup.md` has been rewritten to the current governance baseline, removing the old machine perspective and personal paths. |
| 65 | `done` `docs_zh/reviews/full-cleanup-review.md` has been rewritten as the current governance boundary note, removing the obsolete one-off scan and absolute paths. |
| 66 | `done` `docs_zh/reviews/README.md` and `docs_zh/operations/review-closure-board.md` now include the `platforme-full-review-b.md` entry. |

### 2.8 Operations Trackers Stale / Contradictory

| No. | Issue |
|---|---|
| 67 | `done` `docs_zh/operations/operations-tracker.md` has been updated to 2026-05-27 and supplemented with the latest review entries. |
| 68 | `done` `docs_zh/operations/project_progress_tracker.md` now follows the same "historical batch archive + current entry" convention as `current_todo_list.md`. |
| 69 | `done` `docs_zh/operations/release-versioning.md` now links back to the `Pre-Launch Top 20 Hard Checklist` in `operations-checklist.md`. |

### 2.9 Internal Doc Statement Contradictions

| No. | Issue |
|---|---|
| 70 | `done` `docs_zh/CHANGELOG.md` now reads `Current Release Baseline: Unreleased`, consistent with the root `CHANGELOG.md`. |
| 71 | `done` `docs_zh/operations/current_todo_list.md` has been updated with notes on the new governance assets added after archival; `sync-async-service-pairs.md` is no longer left unreconciled. |
| 72 | `done` Re-verified: AGENTS.md only defines the directory as housing harness-facing SDK code and does not require splitting it into multiple packages; the current single-entry facade is no longer retained as a doc contradiction. |

### 2.10 Other

| No. | Issue |
|---|---|
| 73 | `done` `docs_zh/operations/npm-scripts.md` is now maintained as a Chinese maintenance spec. |
| 74 | `done` `docs_zh/operations/test_coverage_baseline_gate.md` is now maintained in Chinese. |
| 75 | `done` Re-verified: `docs_zh/contracts/README.md` has been extended into a 4.0-4.12 grouped index, covering the full directory skeleton. |

## 3. UI (`ui/`) Issues

### 3.1 Placeholder / Mock / Missing API Integration

| No. | Issue |
|---|---|
| 76 | `done` `ui/packages/features/feature-flags/src/web/index.tsx` now consumes `useFeatureFlagsVm()` and renders `FeatureWorkbenchPanel`, no longer a static placeholder. |
| 77 | `done` `ui/packages/features/feature-flags/src/hooks/index.ts` has removed the `{} as never` / Promise double-cast; the hook is now consumed by the page. |
| 78 | `done` The cited UI features that are still not wired to the backend have been uniformly downgraded to `Planned` and no longer publicly claim `Implemented/Contracted` / `Implemented/Internal`. |
| 79 | `done` The cited workbench actions now include `onTrigger` and execute real side effects (deep-link / clipboard / custom event) via `buildWorkbenchActionHandler(...)`, no longer only writing fake activity. |
| 80 | `done` `ui/packages/features/workflow-builder/src/web/index.tsx` now consumes `vm.nodes / vm.edges` and no longer hardcodes DAG nodes and edges in the view layer. |
| 81 | `done` `ui/packages/features/task-cockpit/src/hooks/index.ts` has removed the frontend-faked evidence chain based on `evidenceCount` and only shows a backend-not-yet-wired aggregate placeholder. |
| 82 | `done` `ui/packages/features/workflow-debugger/src/mobile/index.ts` has removed the "Awaiting backend debugger seam" placeholder text. |
| 83 | `done` `ui/apps/electron-win/src/main.ts` now prefers loading `ui/apps/web/dist/index.html` and only falls back to the local placeholder shell when the web build is missing. |
| 84 | `done` `ui/apps/web/src/app-shell.tsx` now prefers consuming the runtime `authContext` and no longer hardcodes static values like `tenant-default`. |

### 3.2 Type-Assertion Workarounds

| No. | Issue |
|---|---|
| 85 | `done` Same as 77: the double type-assertion in the `feature-flags` hook has been removed. |
| 86 | `done` `ui/packages/features/conversation/src/hooks/index.ts` has removed the `as never` in the `ConversationClient` constructor and added `initialMessages` typing on the shared NL client side. |
| 87 | `done` `ui/packages/features/task-cockpit/src/hooks/index.ts` has removed the `useTasksQuery as unknown as` cast; `useTasksQuery` now natively supports the `refetchInterval` option. |
| 88 | `done` `ui/apps/web/src/app-shell.tsx` now uses `normalizeFeatureModule()` for explicit convergence; the `features as unknown as readonly WebFeatureModule[]` cast no longer exists. |

### 3.3 console / Error Handling

| No. | Issue |
|---|---|
| 89 | `done` `Report Issue` in `ui/apps/web/src/app-shell.tsx` now uses `reportUiError(...)` and no longer only writes `console.error`. |
| 90 | `done` `ui/apps/web/src/global-error-boundary.tsx` is now wired to `reportUiError(...)` and no longer only prints to the console. |
| 91 | `done` `ui/apps/web/src/main.tsx` now explicitly `.catch(...)` `registerWebServiceWorker()` and reports failures. |
| 92 | `done` `ui/apps/electron-win/src/main.ts` has removed the `void` error usage on the synchronous `showPlatformNotification()` and converged the `loadFile()` failure path to a unified fail-closed handler. |
| 93 | `done` `FeatureErrorBoundary` in `ui/apps/web/src/app-shell.tsx` now implements `componentDidCatch()` and reports the component stack. |
| 94 | `done` `ui/apps/web/src/app-shell.tsx` has hoisted the relevant `useMemo` before the conditional return, eliminating the Hooks-order violation. |

### 3.4 Hardcoded Colors / Deviating from Design Tokens

| No. | Issue |
|---|---|
| 95 | `done` The startup banner in `ui/apps/web/src/app-shell.tsx` now uses `designTokens` / `withAlpha(...)`; the original hardcoded `#12201a` is gone. |
| 96 | `done` `ui/packages/features/approval/src/web/index.tsx` now uniformly uses `designTokens` colors and no longer hardcodes `#12201a / #334155`. |
| 97 | `done` `ui/packages/features/workflow-cockpit/src/web/index.tsx` now uniformly uses `designTokens` colors. |
| 98 | `done` `ui/packages/features/workflow-builder/src/web/index.tsx` now uses `designTokens.color.border` and no longer hardcodes `#334155`. |
| 99 | `done` Re-verified: `ui/packages/features/conversation/src/web/index.tsx` no longer contains the hardcoded `#334155`. |
| 100 | `done` Re-verified: `ui/packages/features/hitl/src/web/index.tsx` no longer contains the hardcoded `#334155`. |
| 101 | `done` `ui/packages/features/workflow-cockpit/src/web/dag-viewer.tsx` now uniformly uses the `designTokens` palette. |
| 102 | `done` `ui/apps/mobile/src/App.tsx` now references `mobileDesignTokens` and no longer writes `#F7F8FA / #4B5563` directly. |
| 103 | `done` `ui/packages/ui-mobile/src/components/index.tsx` has extracted `mobileDesignTokens`, removing many scattered hex hardcodes. |
| 104 | `done` `ui/packages/features/governance-compliance/src/web/index.tsx` now uses `var(--aa-color-text)`; the original wrong CSS variable name is closed. |

### 3.5 Dead CSS / Dead Code

| No. | Issue |
|---|---|
| 105 | `done` `ui/packages/ui-core/src/design-tokens/tokens.css` is now explicitly loaded by `ui/apps/web/src/main.tsx` and is no longer dead CSS. |
| 106 | `done` `ui/apps/web/src/feature-registry.ts` has removed the misleading `LazyFeatureDashboard` alias; the related tests have been rewritten accordingly. |

### 3.6 Naming / Structural Inconsistency

| No. | Issue |
|---|---|
| 107 | `done` `ui/apps/web/src/feature-registry.ts` now uniformly uses `@aa/feature-*` aliases; the four cited features no longer use three-level relative paths. |
| 108 | `done` `ui/apps/web/src/app-shell.tsx` now only normalizes `subPages` locally and no longer relies on `as unknown as` casts to patch the `FeatureModule` type. |
| 109 | `done` `ui/apps/web/src/feature-registry.ts` has removed the unused `missionControlFeatureContracts` residual export. |
| 110 | `done` `createFeatureModule()` now uniformly derives the `kind` default from `status`; the status field style of `analytics/workflow-builder` and `release-console/trace-explorer` is now converged. |
| 111 | `done` `ui/apps/web/index.html` and `ui/apps/electron-win/index.html` now use `lang="zh-CN"`, consistent with the current Chinese shell text. |
| 112 | `done` All user-visible text in `ui/apps/web/src/app-shell.tsx` now goes through `translateMessage(...)`. |
| 113 | `done` The cited button/tooltip text in `workflow-cockpit`, `approval`, and `task-cockpit` is now wired to i18n. |
| 114 | `done` The text language in `workflow-debugger` mobile cards, `workflow-builder` hook, and `compliance` hook is now unified and no longer mixed Chinese/English. |

### 3.8 Accessibility

| No. | Issue |
|---|---|
| 115 | `done` Input fields in `ui/packages/features/task-cockpit/src/web/index.tsx` now include `aria-label` and `name`. |
| 116 | `done` `ui/apps/web/index.html` now includes `meta description`, `favicon`, and root-node fallback text. |
| 117 | `done` `ui/apps/web/src/app-shell.tsx` has added default reason text to AccessDenied; when `reason` is empty, an empty paragraph is no longer rendered. |
| 118 | `done` `ui/apps/electron-win/index.html` now uses formal loading text in the root-node fallback, no longer directly exposing the old placeholder title. |

### 3.9 Hardcoded URLs / Ports

| No. | Issue |
|---|---|
| 119 | `done` The cited UI tooling entries are now uniformly converged to `ui/test-target.json` / env overrides and no longer scatter hardcoded `127.0.0.1:4173` across files. |

### 3.10 Other

| No. | Issue |
|---|---|
| 120 | `done` `ui/packages/features/dashboard/src/web/index.tsx` now uses `translateMessage("ui.dashboard.validationDrilldown")`. |
| 121 | `done` `LoadingFallback` in `ui/apps/web/src/app-shell.tsx` now uses `translateMessage("ui.shell.loading")` and is no longer hardcoded English loading text. |
| 122 | `done` `ui/apps/web/src/feature-registry.ts` now uses the import name `workflowDebuggerFeature` to avoid semantic confusion with `debugger`. |
| 123 | `done` The root `package.json` script `test:ui-p1-features` now covers existing P1 test entries such as `compliance/feature-i18n/flows/mission-control-wiring`. |
| 124 | `done` The `lint` script in `ui/package.json` now explicitly covers `tools/**/*.{ts,mjs}` and the test directory. |
| 125 | `done` The `lint` script in `ui/package.json` also covers `scripts/**/*.mjs`; `bundle-analysis.mjs` is no longer in the ESLint blind spot. |

## 4. `tests/` and Test Infrastructure Issues

### 4.1 Empty Files / No-Assertion Tests

| No. | Issue |
|---|---|
| 126 | `done` `tests/unit/platform/shared/cache/cache-metrics-collector.test.ts` now has actual assertions covering `snapshot/reset` behavior. |
| 127 | `done` `tests/unit/domains/onboarding/index.test.ts` now contains real barrel-exposure assertions, no longer just empty forwarding. |
| 128 | `done` `tests/unit/testing/test-cleanup.test.ts` has been supplemented with `assert.doesNotThrow` and return-value assertions. |
| 129 | `done` Each test case in `tests/integration/testing/process-guard.test.ts` now contains explicit assertions. |

### 4.2 package.json References Non-Existent Tests

| No. | Issue |
|---|---|
| 130 | `done` `test:pg-integration` in `package.json` now points to the existing PG integration test path. |
| 131 | `done` `test:secret-providers` in `package.json` now points to the current `tests/integration/platform/security/...` path. |
| 132 | `done` `artifact:integrity` in `package.json` now points to the existing test entry `tests/unit/platform/state-evidence/artifacts.test.ts`. |

### 4.3 Residual `console.*` in Tests

| No. | Issue |
|---|---|
| 133 | `done` Re-verified: `tests/integration/platform/structure/structure-validation.integration.test.ts` no longer contains residual `console.log`. |
| 134 | `done` Re-verified: `tests/integration/sdk/admin-sdk-integration.test.ts` no longer contains `console.warn("Unhandled fetch...")`. |
| 135 | `done` `tests/performance/platform/state-evidence/event-bus.perf.test.ts` now uses `t.diagnostic(...)` and contains no temporary `console.log`. |

### 4.4 Flakiness (Based on Fixed `setTimeout`)

| No. | Issue |
|---|---|
| 136 | `done` The original 1.6s hard wait in `concurrency-invocation.test.ts` has been removed; only short polling / minimum waits remain. |
| 137 | `done` `takeover-escalation-manager-integration.test.ts` no longer has the original 500ms hard wait. |
| 138 | `done` `process-guard.test.ts` has moved to the integration layer, and the original 600ms fixed wait has been removed. |
| 139 | `done` `process-tracker-sandbox.test.ts` no longer has the original 100/200/500ms fixed waits. |
| 140 | `done` `durable-event-bus*` integration tests have removed the original 150ms/50ms-level fixed waits; the remaining sync yield is only `setImmediate`. |
| 141 | `done` Fixed waits in the `distributed-rate-limiter` / `sli-slo` / `circuit-breaker` test groups have been cleaned up. |
| 142 | `done` The original 100ms fixed wait in `core/runtime/bootstrap.test.ts` has been removed. |

### 4.5 Hardcoded localhost / Ports

| No. | Issue |
|---|---|
| 143 | `done` `tests/unit/sdk/cli/oauth-pkce-login-flow.test.ts` now uniformly reuses the `OAUTH_CALLBACK_URL` constant. |
| 144 | `done` `tests/unit/sdk/cli/api-server.test.ts` now uniformly reuses the `OTEL_TEST_ENDPOINT / API_SERVER_TEST_BASE_URL / API_SERVER_TEST_PORT` constants. |
| 145 | `done` `tests/unit/scale-ecosystem/integration/invoke-callback.test.ts` and `integration-index.test.ts` now uniformly reuse the `UNREACHABLE_LOOPBACK_BASE_URL` constant, no longer scattering `localhost:9999/80`. |
| 146 | `done` `tests/integration/sdk/migrate-sqlite-to-pg.test.ts` now reuses the test DSN constant and no longer embeds the old plaintext sample password string. |
| 147 | `done` `tests/integration/platform/security/http-api-server.test.ts` now reuses the `OTEL_TEST_ENDPOINT` constant. |

### 4.6 Tests in the Wrong Layer

| No. | Issue |
|---|---|
| 148 | `done` `full-coverage-{operational-,}real-paths.test.ts` has moved to `tests/integration/quality/`. |
| 149 | `done` Related script tests have moved to `tests/integration/scripts/`. |
| 150 | `done` `process-guard.test.ts` has moved to `tests/integration/platform/shared/stability/`. |
| 151 | `done` `marketplace-balance-ratchet.test.ts` has moved to `tests/integration/scale-ecosystem/`; the other cited `pack-security*` files have been re-verified to only contain static source-string fixtures, not real child-process spawn, so the original wording was overstated. |
| 152 | `done` The three `incident-control` CLI tests have moved to `tests/integration/platform/control-plane/incident-control/`. |
| 153 | `done` `migration-fixtures.test.ts` has moved to `tests/integration/platform/state-evidence/truth/`. |

### 4.7 Duplicate Test Case Names (Hiding Risk)

| No. | Issue |
|---|---|
| 154 | `done` The related rehearsal tests have been suffixed with file-level suffixes for their case titles; `"report outputDir matches options"` no longer collides across files. |
| 155 | `done` Same as above, `"report contains valid startedAt and finishedAt timestamps"` has been batch-suffixed with file-level suffixes. |
| 156 | `done` `parseJsonArray` case titles have been suffixed in the parallel runtime / platform execution directories. |
| 157 | `done` High-frequency duplicate cases such as `toWorkerStatus` / `normalizeLeaseReason` / `choosePreemptionVictim` have been uniformly suffixed with file-level suffixes and are no longer confused in test output. |
| 158 | `done` Title and constant naming collisions in parallel directories have been converged through batch renaming; the original "refactor did not delete the old directory" conclusion is no longer tracked separately. |

### 4.8 Tests Directly Import `src/` via Relative Paths, Contradicting the `dist` Execution Convention

| No. | Issue |
|---|---|
| 159 | `done` Re-verified: the root `package.json` has switched to `node --import tsx --test` with a layered test runner; the `dist/tests/...js` convention cited in the old review is obsolete. The current test execution style that directly references `src/` is consistent with the scripts. |

### 4.9 Redundant / Out-of-Sync Fixtures

| No. | Issue |
|---|---|
| 160 | `done` Re-verified: these pack fixtures are now directly referenced by pack / prompt / marketplace tests, so the "only hit their own README" conclusion is obsolete; the accidentally-included test files in the fixtures have also been cleaned. |
| 161 | `done` Placeholder tests under `tests/fixtures/packs/test-pack/tests/` have been removed. |
| 162 | `done` Active tests have been moved out of `fixtures/`; `generate-snapshots.ts` and `snapshots/manifest.json` are retained only as migration fixture artifacts. |

### 4.10 Unreferenced Golden Snapshots

| No. | Issue |
|---|---|
| 163 | `done` `audit-golden-snapshots.mjs` has been supplemented with reverse-orphan validation, and unreferenced golden snapshots have been cleaned up. |

### 4.11 Self-Implemented Skip Channels

| No. | Issue |
|---|---|
| 164 | `done` `serialTest(...)` in `ops-cli.test.ts` has been tightened to accept only `node:test`-compatible shapes. |
| 165 | `done` The skip-budget compatibility channel in the migration fixtures has been removed. |

### 4.12 Other Suspicious Implementations

| No. | Issue |
|---|---|
| 166 | `done` `tests/unit/plugins/plugin-runtime-host.test.ts` now restores the original `process.execArgv` via `t.after(...)`. |
| 167 | `done` `http-api-server-architecture-regressions.test.ts` no longer has the original 40ms fixed wait. |
| 168 | `done` `http-api-server.test.ts` now uses a randomized test port and no longer hardcodes `43123`. |

## 5. Configuration / Build / Deployment / Script Issues

### 5.1 package.json Scripts / Path Errors

| No. | Issue |
|---|---|
| 169 | `done` `artifact:integrity` in `package.json` has switched to the currently existing test file and no longer references a non-existent path. |
| 170 | `done` `test:pg-integration` in `package.json` now points to the existing test file and no longer has an empty match. |
| 171 | `done` `test:secret-providers` in `package.json` now points to the current integration test path. |
| 172 | `done` `test:pg-integration` / `test:secret-providers` now go directly through `node --import tsx --test` and no longer depend on `build:test`, which does not produce `dist/tests/**`. |
| 173 | `done` `test:e2e:stage-exit` now points to `tests/e2e/checkpoint-artifact-flow.test.ts`, consistent with the directory contract. |
| 174 | `done` Re-verified: the related scripts no longer hardcode `--test-concurrency=1`. |
| 175 | `done` The 223-235 range of `package.json` has been restored to consistent indentation. |

### 5.2 tsconfig Matrix

| No. | Issue |
|---|---|
| 176 | `done` `tsconfig.build-test.json` has been removed; the dead config issue is closed. |
| 177 | `done` `tsconfig.json` now includes `helpers/**/*.ts`, consistent with the lint scope. |
| 178 | `done` Re-verified: the root `tsconfig.json` now carries the author-time typecheck matrix, while the package-script test entries explicitly use `node --import tsx --test` / layered runner; their responsibilities are separated and no longer tracked as a "script conflict." |
| 179 | `done` `tsconfig.scripts.json` now covers `scripts/**/*.ts`, and validation scripts are part of the typecheck. |

### 5.3 ESLint Configuration

| No. | Issue |
|---|---|
| 180 | `done` `eslint.config.js` now includes `projectService` / `tsconfigRootDir`, and type-aware rules have type context. |
| 181 | `done` `eslint.config.js` has removed the non-existent `deploy/**/*.mjs` scope. |
| 182 | `done` `lint` in `package.json` is now `eslint .`, and the `.tsx` coverage is explicitly declared via the flat config `files`. |

### 5.4 Container and Deployment

| No. | Issue |
|---|---|
| 183 | `done` The `Dockerfile` now copies `package-lock.json` and `ui/tsconfig.json`, allowing it to resolve the root TS project references. |
| 184 | `done` `docker-compose.yml` and `.env.example` are now unified with `AA_STORAGE_POSTGRES_DSN` as the primary. |
| 185 | `done` The volume name in `docker-compose.yml` and the default SQLite path in `.env.example` have removed the `phase1a` legacy. |
| 186 | `done` `.env.example` now provides an explicit local placeholder and explanation for `POSTGRES_PASSWORD`. |
| 187 | `done` `.env.example` now includes `AA_OPENAI_API_KEY` and `AA_MINIMAX_API_KEY`, and lists the PG DSN variables in the current read order. |
| 188 | `done` `deploy/kubernetes/manifests/automatic-agent-smoke.yaml` now uses `ghcr.io/automatic-agent/automatic-agent-platform:latest`, and application-name labels are unified. |
| 189 | `done` `deploy/helm/automatic-agent/Chart.yaml` is now `automatic-agent-platform`, consistent with the package name and image registry. |

### 5.5 Division Catalog

| No. | Issue |
|---|---|
| 190 | `done` `config/quality/division-catalog.json` now contains the full registration of the current `divisions/` directory; `docs_zh/reference/division-catalog.md` has also been updated to explain the coverage principle. |

### 5.6 Versioning

| No. | Issue |
|---|---|
| 191 | `done` The version baseline has been promoted to `0.2.0`, and `CHANGELOG.md`, `README.md`, `docs_zh/CHANGELOG.md`, and `docs_en/CHANGELOG.md` have been updated accordingly. |
| 192 | `done` The current release notes have converged the cumulative drift from `0.1.0` into the `0.2.0` version node. |

### 5.7 `.gitignore` and Committed Content

| No. | Issue |
|---|---|
| 193 | `done` The accidentally-tracked `.audit/*` has been removed; `.test-db/*.db-shm/.db-wal` has also been removed from the commit surface, so the ignore directory no longer carries generated artifacts. |
| 194 | `done` `.gitignore` has removed the redundant subdirectory ignore entries under `data/`, keeping only the top-level recursive `data/` rule. |
| 195 | `done` `.gitignore` has removed the redundant/non-compliant `dist_temp` and `dist_test` variants, keeping only the necessary rules. |
| 196 | `done` `.gitignore` has removed the `src/platform/*` legacy compat-surface ignore entries, restoring auditability of the compat surface. |

### 5.8 Stryker

| No. | Issue |
|---|---|
| 197 | `done` `stryker.config.mjs` has removed the original broad `**` whitelist-style ignore patterns. |
| 198 | `done` Stryker now uses a separate `tsconfig.stryker.json` and is no longer directly bound to the root `tsconfig.json` that includes UI references. |

### 5.9 Orphan Scripts

| No. | Issue |
|---|---|
| 199 | `done` Unreferenced orphan scripts in `scripts/` have been cleaned up. |
| 200 | `done` Unreferenced orphan audit scripts in `scripts/ci/` have been cleaned up. |

### 5.10 translate_docs.py

| No. | Issue |
|---|---|
| 201 | `done` The repo root now contains `requirements.txt`, explicitly declaring the `translators` package that `translate_docs.py` depends on. |
| 202 | `done` `translate_docs.py` has rewritten the markdown/code-fence segmentation logic, removing the duplicate newline concatenation before and after code blocks. |
| 203 | `done` `translate_docs.py` has added retries and exponential backoff to `translate_text()`, preventing large-volume translation from hitting the external service directly. |

### 5.11 GitHub Actions

| No. | Issue |
|---|---|
| 204 | `done` `.github/workflows/ci.yml` and `tests/helpers/pg-test-helper.ts` are now uniformly bridged via `AA_TEST_PG_DSN / AA_STORAGE_POSTGRES_DSN / AA_PG_DSN / DATABASE_URL`, converging PG integration test and runtime DSN naming. |
| 205 | `done` The Trivy scan in `.github/workflows/ci.yml` now uses the fully-qualified image name `${IMAGE_REGISTRY}/${IMAGE_REPOSITORY}:${IMAGE_TAG}`, consistent with the release-naming surface. |

## Round 2 Supplement (No Overlap with the Previous 205 Items)

### 6.1 `src/` Security / Data Correctness

| No. | Issue |
|---|---|
| 206 | `done` `migrate-sqlite-to-pg.ts` has added SQL identifier whitelist validation for table names / column names. |
| 207 | `done` The current implementation has moved to `src/platform/five-plane-interface/api/middleware/idempotency-key-storage.ts`, where `tableName` is validated via `validateSqlIdentifier(...)` at construction time. |
| 208 | `done` The current implementation has moved to `src/platform/five-plane-state-evidence/knowledge/semantic-vector-store.ts`, where identifier validation is in place; the path cited in the old review is obsolete. |
| 209 | `done` `checkpoint-gc-service.ts` now uses the safer `lstat` + `open(O_NOFOLLOW)` + `fstat` + `unlink` deletion path. |
| 210 | `done` Atomic writes in `shadow-snapshot-service.ts` now use `O_NOFOLLOW|O_EXCL`, target validation, and cleanup logic, closing the symlink-swap time window. |
| 211 | `done` `src/platform/five-plane-control-plane/config-center/api-server-env.ts` now supports both `AA_API_KEYS_JSON` and the legacy `AA_API_KEYS`. |
| 212 | `done` `src/platform/five-plane-control-plane/config-center/startup-env-schema.ts` now requires `AA_API_JWT_SECRET` to be provided when configuring API keys. |

### 6.2 `src/` Concurrency / Resource Leaks

| No. | Issue |
|---|---|
| 213 | `done` `parseRetryAfterDelayMs()` in `src/sdk/client-sdk/api-client.ts` now supports both delta-seconds and RFC 7231 HTTP-date, and waits for the parse result before retrying. |
| 214 | `done` `src/scale-ecosystem/multi-region/region-health-check-service.ts` now merges the caller `AbortSignal` with the timeout signal and passes them to `fetch`. |
| 215 | `done` The current graceful-shutdown implementation now flushes `stdout/stderr` before exiting, no longer truncating logs directly. |
| 216 | `done` `src/platform/shared/observability/slo-alerting-channels.ts` has removed the implementation that performs synchronous I/O inside `queueMicrotask`. |
| 217 | `done` `src/platform/five-plane-execution/distributed-lock/pg-advisory-lock-adapter.ts` now has a `finally` cleanup that performs a best-effort `pg_advisory_unlock` if the lock is acquired but a subsequent bookkeeping step throws. |

### 6.3 `src/` Duplication / Dead Code

| No. | Issue |
|---|---|
| 218 | `done` `src/sdk/cli/release-pipeline.ts` now uniformly generates GitHub Actions run URLs via shared constants and builder. |
| 219 | `done` Re-verified: the `skill-execution-{cache,core,support,service}-methods.ts` paths cited in the old review are obsolete; the current implementation uses `skill-execution-service.ts` + `cache/core` method slices + shared support modules, and the alleged circular dependency does not exist. |
| 220 | `done` Re-verified: `src/runtime/agent-runtime/index.ts` and `src/platform/ops-maturity/index.ts` have been removed; `src/platform/agent-delegation/index.ts` still has current consumers, so the original "all three are zero-reference dead code" conclusion does not hold. |

### 6.4 `docs_zh/` ADR / Contracts Second Pass

| No. | Issue |
|---|---|
| 221 | `done` `docs_zh/adr/README.md` has been rewritten with the current status of ADR-001 / ADR-033 / ADR-034 / ADR-069 / ADR-072. |
| 222 | `done` `docs_zh/contracts/release_rollout_and_rollback_contract.md` now makes ADR-075 the execution basis and ADR-018 is treated as historical context only. |
| 223 | `done` `docs_zh/architecture/00-platform-architecture.md` is now a formal entry index with an authoritative matrix, no longer a 21-line stub. |
| 224 | `done` Re-verified: `docs_zh/architecture/03-module-diagrams.md` is now a sectioned body reference and has no broken internal markdown anchors. |
| 225 | `done` `docs_zh/quality/buglist.md` has been refreshed to the 2026-05-27 current tracking index. |
| 226 | `done` `docs_zh/migration/01-migration-scope.md` has been updated to 151 contracts / 120 ADRs. |
| 227 | `done` Re-verified: `docs_zh/contracts/README.md` now has a complete directory skeleton and grouped numbering style. |

### 6.5 UI Second Pass

| No. | Issue |
|---|---|
| 228 | `done` `ui/apps/web/src/feature-registry.ts` now uniformly uses `@aa/feature-*` aliases; `ui/tsconfig.json` has also been supplemented with the mapping. |
| 229 | `done` `ui/package.json` now includes `packages/features/*`; feature packages no longer rely on implicit hoisting. |
| 230 | `done` `ui/apps/web/package.json` now explicitly declares `@aa/shared-*` and `@aa/ui-core` dependencies; the "relies only on hoist" conclusion in the review is obsolete. |
| 231 | `done` `ui/apps/electron-win/package.json` has adjusted the non-existent `electron@^42.1.0` to the resolvable `^31.0.0`. |
| 232 | `done` `ui/apps/web/src/app-shell.tsx` has hoisted the `useMemo` in `GuardedFeatureRoute` before the conditional return, eliminating the Hooks-order violation. |
| 233 | `done` `ui/packages/features/governance-compliance/src/index.tsx` and `ui/packages/features/analytics/src/index.tsx` no longer declare unimplemented `subPages` route lists. |

### 6.6 tests Second Pass

| No. | Issue |
|---|---|
| 234 | `done` `tests/performance/**/*.perf.test.ts` now uniformly uses `createTempWorkspace / cleanupPath` for test directory cleanup, no longer relying on `process.cwd()` + relative-path out-of-bounds deletion. |
| 235 | `done` `serialTest` in `tests/integration/sdk/cli/ops-cli.test.ts` now accepts only function or `{ skip?: true } + fn` shapes, no longer tolerating non-`node:test`-compatible calls. |
| 236 | `done` 43 unreferenced golden snapshots have been removed, and reverse-orphan validation has been added to `scripts/ci/audit-golden-snapshots.mjs`. |

### 6.7 config / scripts / deploy Second Pass

| No. | Issue |
|---|---|
| 237 | `done` Conflicting markers in `.claude/scheduled_tasks.json` have been removed. |
| 238 | `done` `.github/workflows/ci.yml` has removed the empty `workflow_call` contract to avoid duplicate triggers. |
| 239 | `done` `.github/workflows/ci.yml` has added the `build` step to satisfy downstream scripts' dependence on `dist/` artifacts. |
| 240 | `done` Artifact upload in `.github/workflows/ci.yml` now includes `retention-days` and an artifact integrity manifest. |
| 241 | `done` The Trivy action in `.github/workflows/ci.yml` is now pinned to the full commit SHA `ed142fd0673e97e23eac54620cfb913e5ce36c25`. |
| 242 | `done` `.github/workflows/deploy-environment.yml` now passes sensitive Helm values via `--set-string` to avoid `:` being parsed as a map. |
| 243 | `done` `.github/workflows/deploy-environment.yml` now includes a secondary health gate after Promote. |
| 244 | `done` `.github/workflows/dr-validation.yml` now includes `concurrency:`; the current CI/DR workflows have the minimum `permissions` baseline, so the original entry no longer holds. |
| 245 | `done` The repo root now contains `.github/CODEOWNERS`. |
| 246 | `done` The `Dockerfile` now also copies `package-lock.json`, allowing the container build to continue using deterministic `npm ci`. |
