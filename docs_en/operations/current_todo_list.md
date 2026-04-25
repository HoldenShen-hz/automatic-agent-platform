# Current Todo List

> The current remediation list uses [../reviews/architecture-design-vs-implementation-review.md](../reviews/architecture-design-vs-implementation-review.md) as the primary index, with repository code and runnable test results serving as the final reconciliation.
> This file covers previously prematurely marked-as-done `W0-W6`口径, retaining only remediation tasks that can be landed in-repository, tested, and documented.

## 0. 2026-04-23 Item-by-Item Review Conclusions

> `R0-R6` historical closure no longer equates to "all reviews closed". Based on this round's item-by-item review, current review status is:

- `open`: none
- `partial`: none
- `closed`: `P0-1`, `P0-2`, `P0-3`, `P1-1`, `P1-2`, `P1-3`, `P1-4`, `P1-5`, `P1-6`, `P1-7`, `P2-1`, `P2-2`, `P2-3`

Subsequent `done` in this file only indicates the corresponding historical wave completed remediation within its scope at that time, and no longer serves as evidence that current review gaps have been cleared. New conclusions from this round: `P1-1 ~ P1-7`, `P2-1`, `P2-2`, `P2-3` have formed a three-way closed loop of source code, tests, and documentation.

## 1. Execution Boundary

- Only include tasks that can be developed in-repository, verified, and closed in this round's documentation write-back.
- External infrastructure/external system items such as `S4 K8s cluster-level sharding`, real enterprise IdP integration, and standalone frontend WCAG rework are not counted in this round's todo.
- Each wave must simultaneously complete: code, tests, documentation write-back, and review status sync.

## 2. Priority Mapping

| Priority | Review gaps | This round's wave |
| --- | --- | --- |
| `P0` | `II-1`, `III-1`, `IV-1`, `VI-1~VI-3` | `R1-R3` |
| `P1` | `I-2`, `II-2`, `III-2`, `IV-2~IV-4`, `VI-4~VI-9` | `R2-R5` |
| `P2` | `IV-5~IV-7`, `VI-10~VI-13` | `R4-R5` |
| `P3` | `II-3`, `VI-14/15`, `IX-1` | `R5-R6` |

## 3. Current Remediation Waves

### R0. Todo / Review口径 Reset

Status: `done`

- Rewrote `current_todo_list` into `R0-R6` structure.
- Removed old `W1-W5 done`口径, unified to "review as source of truth".
- Cleaned up duplicate review gap blocks, keeping one authoritative gap ledger.
- Established `review id → remediation wave` mapping in todo.

Completion definition:

- Chinese and English `current_todo_list` no longer show old `W*` completion口径.
- `review / coverage-matrix / todo` no longer conflict with each other.

### R1. Harness P0/P1 Core Runtime Closure

Status: `done`

- Extended `ConstraintPack`, added `risk_policy / output_policy`.
- Upgraded `HarnessRun` to multi-lifecycle state: `created / running / waiting_hitl / sleeping / recovering / completed / aborted`.
- Added `PlanBundle / WorkProduct / EvaluationReport / ContextSnapshot / WorkflowSleepLease / RecoveryCheckpoint` contracts.
- Added formal runtime entrypoints for iteration, re-entry, resume, and recovery to Harness.
- Closed review `VI-1 ~ VI-6`.

Completion definition:

- Harness is no longer just a single-turn `planner → generator → evaluator` skeleton.
- Harness core contracts, state machine, and recovery entrypoints can all be verified by targeted tests.

### R2. ACP, OAPEFLIR↔Harness Semantic Mapping, ModelGateway Gap Filling

Status: `done`

- Added `agent-delegation/collaboration-protocol`, landed ACP message schema, 8 message types, required fields and invariant validation.
- Wired ACP back to existing delegation main chain: pre-delegation validation, completion report evidence constraints, takeover notice audit entry.
- Added explicit OAPEFLIR↔Harness semantic mapping, written into Harness step/report.
- Added `embed()` and `complete()` to `UnifiedChatProvider`, reusing existing provider routing / degradation / cost attribution main chain.
- Closed review `II-1`, `I-2`, `II-2`.

Completion definition:

- Collaboration protocol is no longer missing.
- Relationship between Harness and OAPEFLIR no longer stays at documentation description.
- `ModelGateway` external capabilities filled to facade-level interface as required by review.

### R3. Domain Meta-Model, Recipe Extension, Canonical domain_id Consolidation

Status: `done`

- Added `src/domains/canonical-meta-model/`, implementing Q1-Q12, validator, completeness calculation, 24-domain seeder.
- Connected `DomainDescriptorOrchestrationService` and `bootstrapVerticalDomainBaselines()` to meta-model validator.
- Extended `DomainRecipe` prototype to 12 types.
- Fixed 12 mismatched `domain_id` values, with legacy alias → canonical compatibility mapping.
- Closed review `III-1`, `III-2`, `IV-1`.

Completion definition:

- All 24 domains use canonical `domain_id` as specified by review.
- Domain meta-model completeness is calculable, testable, and can enter descriptor review.

### R4. 24-Domain Specialized Config and In-Domain Runtime Surface

Status: `done`

- Added formal config entrypoints for 24 domains and domain-specialized workflow/tool/risk/eval/latency/division wiring.
- No longer treating generic `intake → deliver` dual-step workflow as final delivery.
- Prioritized filling 5 key domains: `quant-trading`, `financial-services`, `finance-accounting`, `legal`, `healthcare`.
- Closed review `IV-2 ~ IV-7`.

Completion definition:

- Each domain has at least domain-specific workflow, tool bundle, risk/eval profile, and ownership assignment.
- 24-domain smoke / registry / rollout / governance wiring tests filled.

### R5. Harness P2/P3 Subsystems and Product-Level Runtime Closure

Status: `done`

- Added `ToolbeltAssembler`, five-layer Guardrails, formal HITL Runtime, `FeedbackEnvelope`, Memory Namespace, Async Harness, Evaluation Harness.
- Wired these capabilities into `HarnessRun` main chain, not just as helpers.
- Filled Harness observability: iteration timeline, prompt lineage, failure-to-learning, replay entrypoint, audit link.
- Closed review `VI-7 ~ VI-15`.

Completion definition:

- Harness has product-level long-running, HITL, feedback and learning loop closure.
- Related integration / contract tests are executable.

### R6. Roadmap, ADRs, ops-maturity Stub Reduction and Final Documentation Closure

Status: `done`

- Fixed `RoadmapService`, filled Phase 8/9 registration.
- Filled ADR files called out as missing by review.
- Handled `harness/` directory structure, export surface, and documentation口径 inconsistency.
- Reduced high-stub-count leaf tools under `ops-maturity`.
- Final write-back `review / coverage-matrix / current_todo_list`, changing all implemented items to `✅`.

Completion definition:

- Documentation, directory, export surface, and test status are unified.
- Remaining review items only retain external infrastructure type remnants.

## 4. Test Requirements

Each wave must simultaneously complete:

1. Code implementation
2. Targeted tests
3. Documentation write-back
4. Fix failing tests triggered by that wave

Minimum test baseline:

- Harness: `unit + integration`
- ACP / delegation: `unit + contract`
- domains: `unit + smoke + registry + rollout/gov wiring`
- ModelGateway: `unit + integration`
- Documentation consistency: `docs + link + health`

## 5. Final Write-Back Results

- `R0` completed: `todo / review / coverage-matrix` reconciled against repository implementation, expired gaps and landed capabilities no longer conflict.
- `R1` completed: Harness core contracts, multi-lifecycle, sleep/resume/recovery main chain landed, `runLoop()` now explicitly wired to `HarnessLoopController`.
- `R2` completed: ACP, OAPEFLIR↔Harness semantic mapping, `UnifiedChatProvider.complete()/embed()` facade and barrel visibility closed.
- `R3` completed: `canonical-meta-model`, 12 recipe types, canonical `domain_id` and legacy alias mapping entered bootstrap / descriptor / registry main chain.
- `R4` completed: 24-domain baseline, workflow/tool/risk/eval/latency/ownership wiring entered unit + integration regression.
- `R5` completed: `ToolbeltAssembler`, `GuardrailEngine`, `HitlRuntime`, `HarnessMemoryManager`, `AsyncHarnessService`, `EvalRunService`, `DurableHarnessService`, `ContextAssembler`, `RecoveryController` wired back to Harness main chain, loop/structure/performance regression filled.
- `R6` completed: `RoadmapService`, ADR index, `harness/` canonical subdirectory export surface, ops-maturity leaf services, and three authoritative documents synchronized for closure.

Completion verification:

- `npm run build`
- `npx tsx --test tests/unit/platform/control-plane/iam/access-model.test.ts tests/unit/platform/control-plane/iam/policy-engine.test.ts tests/unit/platform/control-plane/iam/sandbox-policy-modes.test.ts tests/unit/platform/control-plane/config-center/config-governance-service.test.ts tests/unit/platform/interface/api/http-server/task-routes.test.ts tests/golden/openapi-document.test.ts tests/unit/platform/orchestration/hitl/hitl-approval-orchestration-service.test.ts tests/unit/platform/orchestration/hitl/hitl-inbox-service.test.ts tests/unit/domains/vertical-domain-architecture-service.test.ts tests/integration/domains/domains-mainline-integration.test.ts`
- `review / coverage-matrix / current_todo_list` authoritative write-back sync completed

Current closeout status:

- `P1-1 ~ P1-6` completed and closed.
- `npm run build` passed.
- Above targeted `unit / integration / golden` all passed.
- `npm run build:test` still blocked by existing in-repository `audit-export`, `risk-config-loader`, `tenant-boundary-registry-service` type debt; these errors were not introduced by this round's `P1-1 ~ P1-6` changes.
- `review` old gap descriptions have been realigned with current implementation, no longer marking landed P1 items as incomplete.

Currently retained out-of-repository or non-blocking items:

- `I-1`: `S4 K8s` cluster-level sharding
- `II-3`: Additional LLM provider richness expansion

## 5.1 2026-04-23 P0-1 ~ P0-3 Closure Notes

Status: `done`

- `P0-1` completed: Added `AnomalyEventClass` / `ClassifiedAnomalyEvent` authoritative contract, wired anomaly detection and tier-1 event surface to `E1-E6` classification.
- `P0-2` completed: Added `UnifiedSeverity` / `UNIFIED_SEVERITY_SLA` and cross anomaly / alert / runbook / diagnostic severity mapper, incident package and alert event can now output `SEV1-SEV4`.
- `P0-3` completed: Added `threat-model/`, `ThreatMatrixRegistry` and `config/security/threat-matrix.json` under IAM, STRIDE six-dimensional no longer just scattered across security components.

Completion verification:

- `npm run build`
- `npx tsx --test tests/unit/platform/contracts/types/unified-severity.test.ts tests/unit/platform/contracts/types/anomaly-event-classification.test.ts tests/unit/platform/contracts/types/index.test.ts tests/unit/platform/control-plane/iam/stride-framework.test.ts tests/unit/platform/shared/observability/anomaly-detection-service.test.ts tests/unit/platform/shared/observability/slo-alerting-service.test.ts tests/unit/platform/state-evidence/events/event-types.test.ts tests/unit/platform/state-evidence/events/typed-event-payloads.test.ts`

Known not included in this blocking:

- `npm run build:test` still blocked by existing integration/type errors in-repository, currently not introduced by `P0-1 ~ P0-3` changes.

## 5.2 2026-04-23 P1-1 ~ P1-6 Closure Notes

Status: `done`

- `P1-1` completed: Added `src/platform/control-plane/iam/access-model.ts`, formed 6 canonical principal types, wired to `policy-engine` and `approval policy context`.
- `P1-2` completed: `SandboxMode` switched to `read_only / workspace_write / scoped_external_access / restricted_exec` four tiers, synchronized plugin executor and config governance.
- `P1-3` completed: `/v1/tasks` and `/v1/workflows` now support cursor pagination, OpenAPI/golden synchronized.
- `P1-4` completed: Added `src/platform/orchestration/hitl/hitl-modes.ts`, HITL seven modes wired to approval packet / inbox main chain and per-mode tests.
- `P1-5` completed: `policy-engine` now explicitly evaluates `RBAC -> capability -> context-aware` three-layer authorization, with audit evidence supplemented.
- `P1-6` completed: Added `src/domains/vertical-domain-architecture-service.ts`, elevating 24-domain baseline to consumable vertical domain-specific architecture surface.

Completion verification:

- `npm run build`
- `npx tsx --test tests/unit/platform/control-plane/iam/access-model.test.ts tests/unit/platform/control-plane/iam/policy-engine.test.ts tests/unit/platform/control-plane/iam/sandbox-policy-modes.test.ts tests/unit/platform/control-plane/config-center/config-governance-service.test.ts tests/unit/platform/interface/api/http-server/task-routes.test.ts tests/golden/openapi-document.test.ts tests/unit/platform/orchestration/hitl/hitl-approval-orchestration-service.test.ts tests/unit/platform/orchestration/hitl/hitl-inbox-service.test.ts tests/unit/domains/vertical-domain-architecture-service.test.ts tests/integration/domains/domains-mainline-integration.test.ts`

Known not included in this blocking:

- `npm run build:test` currently blocked by existing in-repository test type debt: `tests/unit/platform/control-plane/audit-export/audit-export-service.test.ts`, `tests/unit/platform/control-plane/risk-control/risk-config-loader.test.ts`, `tests/unit/platform/control-plane/tenant/tenant-boundary-registry-service.test.ts`.

## 6. Cross-Platform UI Main Track (UI0-UI7)

> This track uses [../architecture/05-cross-platform-ui-architecture.md](../architecture/05-cross-platform-ui-architecture.md) as the sole UI authoritative specification, and does not cover `R0-R6` backend remediation history.

### UI0. Engineering and Todo Baseline

Status: `done`

- Added in-repository `ui/` monorepo root directory.
- Appended `UI0-UI7` waves to `current_todo_list`, not covering `R0-R6`.
- Clarified this round's boundary: `Web runnable + six-platform shell smoke-ready + typed seam + docs/tests sync`.

### UI1. Shared Core

Status: `done`

- Landed `shared/types`, `api-client`, `auth`, `state`, `sync`, `domain`, `i18n`, `telemetry`, `nl-client`.
- Landed DTO→VM→Props, permission guards, field redaction, offline queue, REST/WS client baseline.

### UI2. Adapter / Design System / Cross-Platform Base

Status: `done`

- Landed authoritative `PlatformAdapter` interface.
- Landed `ui-core`, `ui-mobile`, design tokens, feature scaffold, mobile navigation baseline.

### UI3. Implemented-First Feature Modules

Status: `done`

- Landed `dashboard / task-cockpit / workflow-cockpit / approval / stability / takeover / alerts / dispatch / inspect / health / incidents / policy / audit / workers / queues / conversation / hitl / domain-wizard / settings`.
- Web now connects shared data flow and page rendering for Dashboard / Tasks / Approvals / Settings / Conversation.

### UI4. Planned Modules and API Seam

Status: `done`

- Landed formal feature packages for `workflow-builder / workflow-debugger / agent-manager / explainability / cost-center / marketplace / analytics / governance-compliance`.
- Planned modules uniformly use typed seam + feature gate copy, without fabricating backend completion.

### UI5. Six-Platform Shells

Status: `done`

- Landed `apps/web`, `apps/electron-win`, `apps/tauri-macos`, `apps/tauri-linux`, `apps/mobile`.
- Among these, `apps/web` is buildable and runnable; others are adapter/shell smoke-ready baseline.

### UI6. Tooling and Tests

Status: `done`

- Landed `tools/codegen`, `tools/mock-server`, `tools/e2e`.
- Filled UI shared/feature/app/docs targeted tests, incorporated into `ui` sub-project `typecheck / test / build`.

### UI7. Documentation and Acceptance

Status: `done`

- `todolist` written back.
- `05-cross-platform-ui-architecture.md` supplemented with in-repository `Phase 1-4` alignment snapshot and `v3.2` write-back.
- UI docs consistency tests now cover `UI0-UI7`, `Phase 1-4`, and architecture doc alignment.

## 7. Cross-Platform UI Phase 1-4 Alignment Plan

> This section directly aligns with `Phase 1-4` in [../architecture/05-cross-platform-ui-architecture.md](../architecture/05-cross-platform-ui-architecture.md) §7.4, serving as the phased execution view for `UI0-UI7`.

### Phase 1. Web MVP (Doc §7.4)

Status: `done`

- Aligned Web MVP routes and pages for `Implemented/Contracted` and `Implemented/Internal`.
- Filled first-level IA gaps for Web: `policy / audit / workers / queues`.
- Put Dashboard / TaskCockpit / Approval / Stability / Conversation / HITL / Settings onto unified route guard, Query, DTO→VM→Props main chain.
- Continued documentation write-back and docs tests for Phase 1 status.

### Phase 2. Desktop (Doc §7.4)

Status: `done`

- Hardened `electron-win / tauri-macos / tauri-linux` shell manifest, PlatformAdapter injection, and smoke bootstrap.
- Aligned desktop-specific capabilities: `windowing / shell / process / analyticsConsent` baseline behavior and test doubles.
- Officially reused shared layer between Web runtime and desktop adapter, avoiding each shell implementing its own version.

### Phase 3. Mobile (Doc §7.4)

Status: `done`

- Hardened `apps/mobile` navigation, secure storage, deep link, haptics, screen security baseline.
- Aligned mobile approval/HITL/conversation entry and offline sync main chain.
- Filled mobile smoke test and platform capability contract tests.

### Phase 4. Enhanced Capabilities (Doc §7.4)

Status: `done`

- Continued closing `workflow-builder / workflow-debugger / agent-manager / explainability / cost-center / marketplace / analytics / governance-compliance` per doc.
- Established unified closure method: `planned feature → typed seam → feature gate → docs status`.
- Wrote back `05-cross-platform-ui-architecture.md` fine-grained status labels to match in-repository implementation truth.

Completion definition:

- `Phase 1-4` have all formed code baseline, documentation write-back, and targeted test closure within repository scope.
- Does not include app-store distribution, real signing release, external MDM/enterprise store integration, etc., which are out-of-repository items.

## 8. UI Review Item-by-Item Verification and Remediation Main Track (UIR0-UIR6)

> This track uses [../reviews/ui-design-vs-implementation-review.md](../reviews/ui-design-vs-implementation-review.md) as the sole remediation entrypoint. First verify each review conclusion item-by-item against repository implementation, then close remaining real gaps in order.

### UIR0. Review Item-by-Item Audit and Authoritative Ledger Reconstruction

Status: `done`

- Verified each table row, feature depth row, and `P0-P3` gap item in `ui-design-vs-implementation-review.md`.
- Reclassified each as: `implemented`, `partial implementation`, `not implemented`, `documentation expired`.
- Attached in-repository evidence paths for each conclusion.
- First wrote back obviously expired items: feature structure, shared core depth, feature depth matrix, test inventory, feature inventory.

### UIR1. P0 Closure: Reactive State Binding and Duplicate Route Cleanup

Status: `done`

- Switched `shared/state` from `getState()` snapshot reads to bindings that genuinely trigger React re-renders.
- Kept `zustand/vanilla` store factories, but added formal React binding layer.
- Formally closed duplicate `compliance` and `governance-compliance` feature / route semantics.
- Synchronized feature registry, route map, review documentation, and tests.

### UIR2. Four-Layer Architecture and Feature Depth Matrix Re-rating

Status: `done`

- Re-evaluated `L1 Platform Shell / L2 Feature Modules / L3 Shared Core / L4 Platform Adapters`.
- Re-evaluated 28 features' `L0-L3` depth levels.
- Rewrote REST / WebSocket / PlatformAdapter / testing coverage conclusions.
- Made review structure, scale, depth, and testing conclusions exactly match current `ui/` truth.

### UIR3. P1 Code Gaps: Real Transport, Themes, Charts, and Key Feature Deepening

Status: `done`

- Filled real transport implementations under existing `RESTClient / WSClient` interfaces, keeping mock seam.
- Filled light theme and typography, motion, breakpoints, shadows, icon sizes and other design tokens.
- Introduced ECharts / React Flow, wired to `dashboard/analytics` and `workflow-builder`.
- Prioritized deepening `dashboard / task-cockpit / workflow-cockpit / approval / stability / conversation / settings / workflow-builder / analytics / explainability`.

### UIR4. P2 Platform Layer: Desktop, Tauri, Mobile, and Real Adapter Layer

Status: `done`

- Upgraded `apps/electron-win` to real Electron project baseline.
- Upgraded `apps/tauri-macos`, `apps/tauri-linux` to real Tauri 2 project baseline.
- Upgraded `apps/mobile` to real React Native project baseline, with explicit Android/iOS difference entry.
- Split `PlatformAdapter` into formal web / electron / tauri / mobile / mock implementation layers.

### UIR5. P3 Testing, Tooling, and Placeholder Package Completion

Status: `done`

- Added component, integration, smoke tests across shared/core/features/apps.
- Upgraded `tools/mock-server`, `tools/codegen`, `tools/e2e` from empty shells to minimum runnable.
- Upgraded `shared-i18n`, `shared-telemetry`, `shared-nl-client` from placeholders to formal minimum implementation.
- Upgraded Storybook from placeholder directory to actual project entrypoint.

### UIR6. Final Documentation Write-Back and Closure

Status: `done`

- Fully rewrote `ui-design-vs-implementation-review.md`.
- Synchronously wrote back `05-cross-platform-ui-architecture.md`, `current_todo_list.md` and English mirror.
- Output final closed-loop table: `review item → current status → evidence path → remediated?`.
- Current in-repository UI sub-project has completed `typecheck / test / build` closure; desktop and mobile accepted as smoke-ready project baselines.
