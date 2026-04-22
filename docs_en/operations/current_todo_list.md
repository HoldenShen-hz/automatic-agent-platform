# Current Todo List

> Short-term execution list.
> This file turns the master phase plan and roadmap into the single active entry for “what we implement next”.

## 1. Locked Scope

Execution is locked to the current [00-platform-architecture.md](../architecture/00-platform-architecture.md) boundaries:

- Deliver full platform capability for `Phase 1` through `Phase 8c`.
- Deliver baseline implementations for all 24 vertical domains in `Phase 9`.
- `S1` to `S3` must be runnable and testable inside the repository.
- `S4` is implemented as formal modules, contracts, orchestration, deployment assets, and test doubles; we do not claim local single-node infrastructure equals real clustered closure.
- External compatibility first: preserve existing CLI / API / startup paths while moving internals to canonical boundaries.

## 2. Current Objective

Move the repository from “many implemented capabilities with inconsistent entrypoints and phase language” to:

1. Canonical root entry, architecture bootstrap, app startup plan, and platform surface catalog.
2. Stable formal entrypoints for the 9 top-level modules.
3. End-to-end closure of the five-plane chain: `Request → Control → Orchestration → Execution → Evidence → Feedback/Learn/Improve`.
4. All 24 domains registered with runnable baseline governance, eval, rollout, and smoke coverage.

## 3. Active Work Packages

### W0. Architecture kernel and startup convergence

Status: `done`

- Converge `src/index.ts` as the single root platform entry.
- Freeze `platform-architecture-bootstrap`, `platform-application-kernel`, and `platform-module-catalog`.
- Freeze the five startup targets: `summary / demo / api / console / worker`.
- Upgrade `apps/*` manifests with explicit `requiredLayers / startupCommand / startupMode`.
- Fix canonical `index.ts` coverage and type/value export problems across major `platform/*` surfaces.

Done when:

- `src/index.ts` and `src/platform/index.ts` import cleanly.
- `AA_PLATFORM_ENTRY_MODE=summary|api|console|worker` produces stable output.
- Architecture and directory guard tests pass.

### W1. Five-plane convergence

Status: `in_progress`

- `P1 Interface Plane`: unify `api / webhook / scheduler / console-backend / ingress`.
- `P2 Control Plane`: unify `approval / config / iam / incident / policy / rollout / tenant / risk`.
- `P3 Orchestration Plane`: unify `agent-delegation / escalation / hitl / oapeflir / planner / replan / routing`.
- `P4 Execution Plane`: unify `dispatcher / distributed-lock / execution-engine / ha / lease / queue / recovery / worker-pool / tool-executor`.
- `P5 State & Evidence Plane`: unify `truth / events / projections / audit / artifacts / memory / knowledge / checkpoints / dlq / incident`.

Done when:

- All five planes export main capabilities from canonical entries.
- Core CLI / API / services stop using deep non-canonical files as primary boundaries.
- Export-path and structure-related tests are green.

### W2. AI operations and Harness convergence

Status: `in_progress`

- Complete `model-gateway`.
- Complete `prompt-engine`.
- Complete `platform/compliance`.
- Merge `Phase 8a-8c` Harness capabilities into the main platform runtime chain.

### W3. Intelligent interaction and organizational governance convergence

Status: `todo`

- Complete `interaction`.
- Complete `org-governance`.
- Align all `Phase 5` capabilities to real code, startup wiring, and tests.

### W4. Scale/ecosystem and ops-maturity convergence

Status: `todo`

- Complete `scale-ecosystem`.
- Complete `ops-maturity`.
- Make `S1-S3` runnable in-repo; make `S4` formalized via contracts, deployment assets, and test doubles.

### W5. Full 24-domain baseline delivery

Status: `in_progress`

Each domain must have:

- `DomainDescriptor`
- `DomainRiskProfile`
- `DomainKnowledgeSchema`
- `DomainEvalFramework`
- `DomainPromptLibrary`
- `DomainRecipe`
- `DomainInteractionPolicy`
- `DomainGovernancePolicy`
- registry / onboarding / smoke / rollout baseline

## 4. Execution Order

Strict order:

1. `W0`
2. `W1`
3. `W2`
4. `W3`
5. `W4`
6. `W5`

## 5. Test and Closure Rules

Every wave must include:

1. Code
2. Tests
3. Documentation updates
4. Fixes for failures triggered by that wave

Minimum test expectations:

- architecture kernel: `unit + docs + startup import`
- five planes: `unit + integration`
- API / CLI / console: `unit + integration + golden`
- risk / approval / recovery / DLQ / replay / audit: `unit + integration + contract`
- domains: at least `smoke + registry + governance/eval wiring`

## 6. Current Completion Snapshot

Already completed in the current revision:

- root platform entry, startup targets, application kernel, and platform surface catalog
- directory/code-structure guardrails for canonical entries
- upgraded app manifests and startup-plan output
- stable import path for `src/index.ts` and `src/platform/index.ts`
- aligned top-level canonical barrels for `domains / interaction / org-governance / scale-ecosystem / ops-maturity / plugins / sdk`
- added missing second-level entrypoints for `business-pack`, `chaos`, and `monitoring`, now protected by structure tests
- converged `prompt-engine` into the formal `eval / registry / renderer / rollout + conversation-template` export surface
- updated `execution/index.ts` to expose execution capabilities primarily through canonical submodule entries
- added smoke/barrel coverage for the nine top-level layers and key root barrels
- added a formal `platform/orchestration/harness` module and wired it into the orchestration root export and platform catalog
- created a unified catalog for all 24 `Phase 9` vertical domain baselines with one-shot register + activate bootstrap
- each baseline now includes `DomainDefinition / RiskProfile / KnowledgeSchema / EvalFramework / PromptLibrary / Recipe / InteractionRule / GovernancePolicy`
- added targeted tests for 24-domain bootstrap, registry activation, descriptor review, and knowledge namespace wiring
- added capability baseline catalogs for `interaction / org-governance / scale-ecosystem / ops-maturity` as formal `W3/W4` baselines
- added `platform-mainline-bootstrap` to capture the `W1/W2` critical surfaces: five planes plus `model-gateway`, `prompt-engine`, and `compliance`
- the five `W1` planes now each have a plane baseline catalog, plus a shared `five-plane-runtime-bootstrap` registered through `ServiceRegistry`
- the five `W1` planes now also have dedicated plane bootstraps for `interface / control-plane / orchestration / execution / state-evidence`, and the shared runtime bootstrap now composes those per-plane registrations instead of registering everything in one file
- `W1` now also includes a formal `five-plane-startup-plan`, which fixes the startup order, bootstrap service ids, entry modules, and capability counts for the five planes
- `W1` now also includes a `five-plane-runtime-orchestrator`, which starts the five planes in order from the startup plan, exposes readiness snapshots, and gives the application kernel a reusable plane-startup view
- the root `src/index.ts` summary output now includes the five-plane startup order and capability counts, not just the static architecture-layer summary
- `W2` now also has capability baselines and bootstraps for `model-gateway / prompt-engine / compliance / harness`, plus a formal `ai-operations-startup-plan` and `ai-operations-runtime-orchestrator`
- both the application kernel and the root summary now expose the `W2` startup order and capability counts alongside the `W1` five-plane view
- `W2` now also includes an `ai-operations-runtime-catalog` that aggregates `model-gateway / prompt-engine / compliance / harness` into one runtime catalog and feeds both the application kernel and root summary
- `W2` baseline service names now align with canonical submodule exports, and `model-gateway / prompt-engine / compliance / harness` surface catalogs no longer reference placeholders or incorrect exports
- `W2` now includes `ai-operations-mainline-integration` full-chain integration tests covering prompt rollout, model governance fallback, compliance evidence, and harness loop main-chain closure
- `W3` now also has formal bootstraps for `interaction / org-governance`, plus a unified `interaction-governance-runtime-catalog`, `interaction-governance-startup-plan`, and `interaction-governance-runtime-orchestrator`
- both the application kernel and the root summary now begin exposing the `W3` startup order and capability counts alongside `W1` and `W2`

Immediate next step:

- continue `W3` intelligent interaction and organizational governance closure
- continue advancing `interaction / org-governance` formal services, governance chain, and targeted tests
- `W4` begin supplementing `scale-ecosystem / ops-maturity` formal catalog, bootstrap, and verification
- `W5` continue advancing from “24 domains registrable baseline” toward richer tool/plugin/connector baseline

## 7. Completion Criteria

This file can be marked `done` when:

- All `Phase 1-8c` platform capabilities have real implementation and tests, no “only exists in documents” functionality
- All `Phase 9` 24 domains have baseline and pass respective smoke / wiring tests
- `S1-S3` runnable and verifiable in-repo; `S4` has formal interfaces, scheduling, deployment, and double verification
- Root entry, catalog, canonical boundary, documentation, and tests are consistent
