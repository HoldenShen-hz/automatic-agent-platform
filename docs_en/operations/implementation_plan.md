# Implementation Plan

> **Structure Migration Note** - This document references old structure `src/core/`, `src/cli/`, `src/gateway/`.
> The current codebase has migrated to `src/platform/` five-plane structure + upper-layer business domains (`domains/`, `interaction/`, `ops-maturity/`, etc.).
> Plan content may need verification against [architecture/README.md](../architecture/README.md) for execution status.

## Goal

Without shaking the existing document structure, advance implementation and productization in the sequence Phase 1a -> 1b -> 2a -> 2b -> 2c -> 3 -> 4.

Supplementary execution principles:

- `Phase 1a` only does single-agent stable operation.
- `Phase 1b` only does single-division workflow and minimum orchestration.
- Full multi-agent platform capabilities are gradually introduced in `Phase 2`.
- Remote coordination, Marketplace, and multi-tenancy are not permitted to race ahead in `Phase 1a / 1b`.
- New recommendation items appearing in `research/analysis` must first pass the migration-boundary judgment in [../migration_scope.md](../migration_scope.md), then decide whether to absorb into the formal plan, defer to a later phase, or explicitly reject.

## Unified Execution Baseline

These 4 execution documents use the same baseline:

| Document | Role | Question Answered | Source of Truth |
|----------|------|-------------------|-----------------|
| `implementation_plan.md` | Phase and scope master plan | Which phase is currently allowed, what to do in that phase, what not to do | `Yes` |
| `development_sequence_roadmap.md` | Development sequence and dependencies | Which batch first, what can be parallel, what are the exit criteria | `Yes` |
| `project_progress_tracker.md` | Actual project progress | What has been done, what is complete, what is blocked | `Yes` |
| `current_todo_list.md` | Current short-term todo | What to specifically work on in the next 1 to 2 iterations | `Yes` |

Unified status semantics:

| Status | Meaning |
|--------|---------|
| `not_started` | Not yet entered that phase or batch |
| `ready` | Passed gate, can begin, but not yet started |
| `in_progress` | Started, actively advancing |
| `blocked` | Started but has blocking issues |
| `done` | Reached current phase acceptance criteria |

Supplementary notes:

- `Work package done` does not automatically equal `phase closed done`.
- If a phase's work packages are complete but the phase closure evidence is explicitly delayed (e.g., 24h/72h long-duration verification), they should be recorded separately as "work packages complete" and "phase sign-off still in progress."
- External research conclusions are not permitted to skip the absorption matrix and enter implementation directly; they must first be mapped through `research_analysis_absorption_matrix.md` to roadmap / backlog / contract / phase.
- Reference conclusions must also follow the same rule: clearly state `adopted / adapted / not_adopted` before entering formal implementation. The current boundary conclusion is in [../migration_scope.md](../migration_scope.md).

Unified update rules:

1. When phase boundaries, non-goals, or allowed scope change, first update `implementation_plan.md`.
2. When development sequence, dependencies, or batch switching changes, then update `development_sequence_roadmap.md`.
3. After actual status changes, update `project_progress_tracker.md`.
4. Active items for the current 1 to 2 iterations are maintained only in `current_todo_list.md`.
5. If the 4 documents conflict, judge by priority: scope -> sequence -> progress -> todo.
6. If research analysis conclusions conflict with the current plan, use [../migration_scope.md](../migration_scope.md) and the current platform architecture documents as standard, then write back to the formal plan.

## Pre-Work Threshold

Before starting any phase implementation, the following must be satisfied:

- `operations/gap-analysis.md` and `operations/operations-checklist.md` give an executable conclusion for the current phase.
- `operations/operations-checklist.md` shows the active phase gate and required readiness checks.
- `operations/operations-checklist.md` has passed the current phase document sign-off.
- Applicable items in `operations/operations-checklist.md` have passed.
- Module acceptance items in `operations/operations-checklist.md` that belong to the current phase are identified and verifiable.
- `operations/gap-analysis.md` and `operations/operations-checklist.md` have no P0 document gaps blocking the current phase.
- If the current phase goal includes "stable operation," then `operations/gap-analysis.md` and `operations/operations-checklist.md` have been incorporated into the execution baseline.

## Current Execution Sequence

Before entering code implementation, prioritize tightening the foundation according to the first 20 items in [system_improvement_roadmap.md](./operations-roadmap.md).
If the goal is to first achieve "stable operation," prioritize advancing according to the three-batch sequence in [stable_launch_execution_plan.md](./operations-roadmap.md).
If new external references or comparative analysis conclusions are added, first make an absorption judgment according to [../migration_scope.md](../migration_scope.md), then modify roadmap / backlog / phase sequence.

## Current Implementation Batch

Current revision is locked to:

- Current phase: `Phase 1a Evidence`
- Current phase status: `in_progress`
- Current development batch: `Phase 1a Evidence`
- Current batch status: `in_progress`
- Current short-term work package: `P1A-EVID-24` has been completed and generated a formal evidence bundle; current main line switched to `P1A-EVID-72` 72h long-duration evidence. `Phase 3`'s `P3-01` PMF metric validation, `P3-02` billing capability, `P3-03` perception MVP, `P3-04` Web/API productization, `REF-HERMES-01` gateway target directory, `REF-HERMES-02` memory provider seam, `REF-HERMES-03` provider credential pool, `REF-HERMES-04` conservative model routing, `REF-HERMES-05` shadow snapshot rollback, `REF-HERMES-06A` tool name fuzzy matching, `REF-HERMES-06B` tool parameter security correction, `REF-HERMES-07` turn-scoped fallback auto-recovery, `REF-HERMES-08` context file security scanning, `REF-HERMES-09` profile multi-instance isolation, `REF-HERMES-10` prompt static/dynamic partition cache, `Phase 4`'s `P4-01 / P4-02`, `UI-01` console / cockpit program, and `PLATFORM-01A / PLATFORM-01B / PLATFORM-01C / IND-01A / IND-01B / IND-01C` are all complete; this round also completed five layers of industrial governance joint slices: first, `INTENT-01 / IND-P0-08`, upgrading `IntakeRouter` to support 8-class intent / continuation / confidence structured routing, and upgrading `LlmEvalService` to deterministic structured CI gate with baseline prompt regression; second, `IND-P0-08 / IND-P1-03`, adding `PromptModelPolicyGovernanceService`, supporting prompt/model/policy release registration, unified governance gate, rollback target, governance snapshot, and model failure `degrade_to_fallback` decision; third, incorporating eval/governance tables into SQLite migration 31, and realistically integrating governance snapshot into `model-routing` runtime/CLI fallback; fourth, `IND-P1-04 / IND-P1-05 / IND-P1-06 / IND-P1-07`, adding `EnterpriseGovernanceService` / CLI, consolidating incident handoff persistence, schema compatibility gate, package-lock SBOM / dependency policy scan, and Datadog / Grafana / OTel payload bundle export into a unified evidence package; fifth, `IND-P1-08 / IND-P1-09 / IND-P1-10`, adding real Telegram/Slack/webhook gateway adapter, API key -> bearer token exchange + HS256 JWT/RBAC/admin boundary, coordinator snapshot persistence + summary/select CLI/API. Current remaining work is `P1A-EVID-72` long-duration evidence, and industrial-grade P0/P1/P2 program formally incorporated into execution (see `current_todo_list.md` section 3 and section 7.3); among these, `IND-P0-09` has advanced to real publish execute, release bundle/export ledger, release execution ledger and workflow receipt audit baseline, `IND-P0-10` has advanced to environment overlay, deployment matrix, secret/config injection plan, deployment execution / promotion history ledger, workflow receipt audit and release execute chained trigger deployment, `IND-P0-05` has advanced to secret registry / usage audit / rotation event, env-backed provider seam, and has been integrated into `deployment-execution` and release pipeline execution chain, `IND-P0-01` has also completed eleven rounds of PostgreSQL baseline: first tightening driver configuration, DSN, SSL, pool, dual-run and shadow SQLite path fail-close boundaries, then supplementing doctor/CLI structured storage backend profile, then supplementing authoritative storage backend factory seam and connecting `phase1a / phase1b` runtime to unified entry, then supplementing three batches of CLI authoritative storage factory wiring, service signature decoupling, eighth round `sql/sqlite` handle layering, ninth round CLI `storage.store` context sinking, tenth round generic `phase1a-store` / `authoritative-sql-database` facade import decoupling, and eleventh round top-level `sqlite-database` facade / authoritative import uplift; when postgres driver is selected, the execution plane truthfully fail-closes, and currently only `doctor` direct sqlite and a few sqlite-specific consumers retain concrete SQLite exceptions. `IND-P1-08 / IND-P1-09` currently have executable baselines, while `IND-P1-10` currently truthfully remains at selection foundation, not equivalent to true multi-coordinator HA.

Current main line execution sequence:

1. `P1A-EVID-72` 72h long-duration evidence advances as the current main line.
2. `IND-P0-09 / IND-P0-10 / IND-P0-05` can advance in parallel during the long-duration evidence run (container/CI, multi-environment deployment, and secret management baselines), but must not skip continuous observation and documentation updates for the evidence task.
3. Immediately after `P1A-EVID-72` completes, enter the industrial-grade `IND-P0` main line, rather than claiming the system is fully complete.
4. After closing `IND-P0`, proceed to `IND-P1`; after closing `IND-P1`, proceed to `IND-P2`.
5. New implementations should preferentially enter industrial-grade P0/P1/P2 program, rather than reverting to completed Hermes Delta work packages.
6. Each work package must go through `build -> targeted unit/integration -> sandbox/security -> npm test -> documentation update`. Partial implementation without regression is not acceptable.

First batch work package definitions:

| Work Package ID | Name | Corresponding Batch |
|-----------------|------|---------------------|
| `P1A-01` | Directory skeleton | `Week 1` |
| `P1A-02` | Core types and state machine skeleton | `Week 1` |
| `P1A-03` | SQLite schema and migration skeleton | `Week 1` |
| `P1A-04` | Minimum single-agent happy path | `Week 1` |
| `P1A-05` | Event tiering, event bus, stream bridge baseline | `Week 2` |
| `P1A-06` | Tool executor and timeout / cancel / cleanup | `Week 2` |
| `P1A-07` | Minimum approval / policy / budget guard | `Week 2` |
| `P1A-08` | Inspect / health / structured log baseline | `Week 2` |
| `P1A-09` | Recovery drill test baseline | `Week 3` |
| `P1A-10` | Golden tasks and regression fixtures | `Week 4` |
| `P1A-11` | `24h / 72h` soak test framework | `Week 5` |

Current writebacks:

- `P1A-01` through `P1A-04` have completed the first version skeleton implementation.
- `P1A-06` has completed the first version of tool executor / timeout / cancel / cleanup and sandbox tests.
- `P1A-05` through `P1A-08` have completed the `Week 2` baseline.
- `P1A-09` has completed the `Week 3` startup consistency and recovery drill baseline.
- `P1A-10` has completed the `Week 4` golden tasks, timeline / diagnostics, and doctor self-check baseline.
- `P1A-11` has completed the `Week 5` stable validation script and soak test framework.
- Post-`Week 5` first round of stability consolidation is complete: workflow static validator, admission control, stalled execution detection, and doctor integration have landed.
- `P1A-EVID-24` has been completed and generated a formal evidence bundle; `P1A-EVID-72` now continues as the current long-duration evidence main line.
- `I-74 / I-79` current revision closure in `system_gap_analysis_20260412a.md` is complete: main chain event payload has continued to be typed, stability tools canonical namespace has been unified to `src/core/stability/`.
- This round also continued absorbing 5 references: cache orchestration, staged agent team, validation-repair loop, memory plane layering, and evolution boundary governance; related implementations and "not copying verbatim" reasons have been fixed in `reference_20260413_system_alignment_review.md`.
- `Phase 1a` should currently be understood as "development work packages complete, but phase sign-off not closed"; `Phase 1b` should currently be understood as "development work packages complete, phase sign-off continues with overall stability and phase strategy."
- `REF-HERMES-06B` is complete: `tool-argument-coercion` module, runtime middleware wiring, and `command_exec / question / todo_write / edit_replace` service boundary security correction have landed; high-risk ambiguous parameters remain fail-closed, and completed targeted unit / integration / sandbox-security / full `npm test` `1048/1048` and stable validation.
- `REF-HERMES-07` is complete: turn-scoped fallback lease has landed in `model-routing-service.ts` and `model-routing` CLI, allowing reuse of temporary degraded results within the same turn, next turn defaults to automatically recovering the primary profile; completed targeted unit / integration / sandbox-security / full `npm test` `1053/1053` and stable validation.
- `P1B-01` through `P1B-04` are complete, `Phase 1b` has entered the minimum orchestration implementation phase.
- `P1B-05 / P1B-06` are complete, `P1B-07 / P1B-08` are also complete, `Phase 1b` coding work packages are closed.
- `P2A-01` through `P2A-10` are complete, current main line has supplemented multi-division loading chain, artifact lineage, artifact-aware diagnostics, runtime recovery repository / division recovery overview, dead-letter / recovery decision audit, recovery replay report / CLI, stable cross-division recovery drill, execution ticket / dispatch baseline, worker claim / heartbeat handshake, and authoritative worker writeback / completion handshake.
- `Week 6+` first item PG semantics preparation is complete: SQLite migration ledger, checksum validation, schema freshness gate, and startup / doctor fail-closed integration have landed.
- `Week 6+` second item queue semantics preparation is complete: dispatch reconciliation, orphan queue claim / terminal ticket repair, and `dispatch-reconcile` / `stable-dispatch-reconcile` CLI have landed.
- `Week 6+` `QUEUE-01` current slice is complete: added `stable-queue-delivery` rehearsal / CLI, formally covering "queue replay can be rebuilt from authoritative DB truth as dispatchable ticket" and "duplicate delivery will be intercepted by worker capacity / lease fencing, and after authoritative terminal writeback, cleaned up by reconciliation" two drill semantics; `stable-evidence` / `stable-gate` / `stable-package` now incorporate queue delivery evidence into pre-production checks, and completed build / targeted integration+CLI / sandbox/security / `npm test` `445/445` full regression.
- `Week 6+` `DB-39` / PG migration compatibility current slice is complete: added `stable-migration-compatibility` rehearsal / CLI, performing PostgreSQL portability preflight on SQLite migration plan; SQLite runtime `PRAGMA` in phase1a schema has been separated from migration SQL to connection bootstrap, migration ledger has also been made compatible with old checksums, avoiding existing libraries being mistakenly judged damaged after portability tightening; `stable-evidence` / `stable-gate` / `stable-package` have formally incorporated migration compatibility evidence, and completed build / targeted unit+integration+CLI / sandbox/security `44/44` / `npm test` `450/450` full regression. This slice is still portability preflight, not equivalent to live PostgreSQL execution acceptance.
- `Week 6+` `DBQ-01` DB/queue disconnect drill is complete: added `stable-db-queue-disconnect` rehearsal / CLI, formally drilling "queue unavailable when dispatch explicitly blocked and silently drops no ticket," "after queue reconnect, missing dispatch ticket can be rebuilt from authoritative DB truth + agent execution plan metadata," "authoritative worker writeback returns `authoritative_store_unavailable` and fail-closes on DB failure, retry succeeds after recovery" three semantics; `stable-evidence` / `stable-gate` / `stable-package` now incorporate DB/queue disconnect evidence into pre-production checks, and completed build / targeted unit+runtime+evidence+gate+package+CLI / sandbox/security `49/49` / `npm test` `470/470` full regression.
- `Week 6+` `DB-42` authoritative store writability fail-close drill is complete: added `stable-db-writability` rehearsal / CLI, formally drilling "health enters `read_only_operations_only` when DB is not writable, doctor overall `fail_closed`," "phase1b intake admission fail-closes, does not accept new tasks requiring authoritative state," "dispatch blocked and pending authoritative ticket preserved" three semantics; `stable-evidence` / `stable-gate` / `stable-package` now incorporate DB writability evidence into pre-production checks, and completed build / targeted unit+integration+CLI / sandbox/security `47/47` / `npm test` `475/475` full regression.
- `Week 6+` `SCHED-03` dispatch affinity / load skew hotspot remediation is complete: added `worker-load-balancing` helper, consolidating active lease, saturation, tool backlog, and CPU into a load-aware dispatch score; health / doctor has supplemented sticky load skew detection and operator finding, hot-spot workers are proactively demoted even when queue affinity hits when there is healthy idle capacity; completed build / targeted unit+integration+CLI `113/113` / sandbox/security `44/44` / `npm test` `481/481` full regression.
- `Week 6+` `SEC-36` tier_1 audit event integrity chain current slice is complete: added tamper-evident audit event integrity chain and migration, tier_1 audit events write to integrity ledger on ingestion, doctor added `audit_integrity` self-check and `fail_closed` on checksum / chain / missing event anomalies; completed build / targeted unit+integration+CLI `85/85` / sandbox/security `52/52` / `npm test` `485/485` full regression.
- `Phase 2b` `MEM-05` memory repository / recall / quality baseline current slice is complete: extended `memories` schema, landed `MemoryService` / `memory` CLI, supporting scope/trust/lifecycle recall filtering, hit counting, revocation, and quality reporting; runtime recovery dead-letter path also automatically writes failure memory, forming a minimum memory feedback loop; completed build / targeted unit+integration+CLI `14/14` / sandbox/security `53/53` / `npm test` `491/491` full regression.
- `P3-01` is complete: landed PMF validation service, `pmf` CLI, report persistence/export, artifact evidence, and division-scoped validation report, and completed unit / integration / sandbox-security / full `npm test` `957/957` and `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`.
- `P3-02` is complete: landed billing service, `billing` CLI, `billing_accounts / usage_events / quota_counters / ledger_entries / entitlement_decisions` persistence, summary/export closure, and completed unit / integration / CLI / sandbox-security, full `npm test` `964/964` and `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`.
- `P3-03` is complete: landed perception service, `perception` CLI, `perception_sources / intel_items / intel_briefs / action_proposals` persistence, and brief/proposal/export closure, and completed unit / integration / CLI / sandbox-security, full `npm test` `969/969` and `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`.
- `P3-04` is complete: landed Mission Control aggregate, versioned HTTP API, minimal Web console, OpenAPI documentation, and `api` CLI, and completed unit / integration / sandbox-security, full `npm test` `973/973` and `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`.
- `REF-HERMES-01` is complete: landed gateway target directory, session-history fallback, canonical target resolve, `gateway-targets` CLI, versioned API and console target directory, and completed unit / integration / sandbox-security, full `npm test` `976/976` and `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`.
- `REF-HERMES-02` is complete: landed built-in memory provider seam, supporting `initialize / system_prompt_block / prefetch / queue_prefetch / sync_turn / shutdown` lifecycle, FTS-safe prefetch, same-session experience filtering, and `memory` CLI extensions, and completed unit / integration / sandbox-security, full `npm test` `981/981` and `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`.
- `REF-HERMES-03` is complete: landed `provider-credential-pool.ts` and MiniMax cooldown/failover governance, supporting same-provider multi-credential rotation, unified `retry-after-ms` / `retry-after` / `reset_at` cooldown semantics, and completed unit / integration / sandbox-security / full `npm test` regression.
- `REF-HERMES-04` is complete: landed `model-routing-service.ts` and `model-routing` CLI, supporting conservative cheap-vs-strong route, sticky/preferred/pinned profile, provider health fallback and route trace, and completed unit / integration / sandbox-security / full `npm test` `998/998`.
- `REF-HERMES-05` is complete: landed `shadow-snapshot-service.ts` and `shadow-snapshot` CLI, using workspace-external git metadata repo to provide create/list/restore, common generated directory exclusion, super large directory fail-close, and symlink/workspace path rejection, and completed unit / integration / sandbox-security / full `npm test` `1005/1005`.
- `PLATFORM-01C` is complete: landed `DataPlaneFlowService`, `data-plane` CLI, migration 25, analytics/archive/replay/movement job tenant-aware data plane flow, and completed targeted unit / CLI / security, full `npm test` `1030/1030` and stable validation.
- `REF-HERMES-06A` is complete: landed tool name exact / alias / normalized / fuzzy unique resolution, correction trace, and promote typo fail-close/correction visibility, and completed targeted unit / security, full `npm test` `1035/1035` and stable validation.
- `P4-01` is complete: landed `enterprise-capability-matrix-service.ts` and `enterprise-capability` CLI, supporting environment readiness registration, enterprise capability summary/export, JSON/Markdown artifact export, and DB persistence, and completed unit / integration / sandbox-security / `npm run test:integration` `385/385` / full `npm test` `1011/1011` / `AA_VALIDATION_ITERATIONS=2 npm run validate:stable`.
- `Phase 2b` `MEM-01` token estimation precision current slice is complete: added more precise token estimator, prioritizing message parts / provider usage, and switched context compaction budget, trim / summarize counting to the new baseline; tool result trim recalculates based on rendered content, abandoning the rough `chars/4` estimation; completed build / targeted unit+integration `7/7` / sandbox/security `53/53` / `npm test` `495/495` full regression.
- `Phase 2b` `MEM-02` STM -> LTM consolidation current slice is complete: added memory consolidation, which can consolidate threshold-satisfying `layer_3` memories into `layer_5` summary memories within explicit boundaries, and performs auditable revocation of source memories; `memory` CLI now supports `consolidate`, stably reproducing consolidation closure; completed build / targeted unit+integration+CLI `12/12` / sandbox/security `54/54` / `npm test` `501/501` full regression.
- `Week 6+` third item scheduling explainability preparation is complete: dispatch decision trace, worker evaluation audit, and `dispatch:decision_recorded` event and dispatch CLI / rehearsal integration have landed.
- `Week 6+` fourth item scheduling observability closure is complete: inspect / diagnostics / repro bundle / inspect CLI have structurally exposed dispatch decision traces, and supplemented regression tests.
- `Week 6+` fifth item worker maintenance semantics are complete: worker registry / dispatch / handshake / writeback now support `draining`, laying the foundation for lossless maintenance and subsequent remote worker evolution.
- `Week 6+` sixth item version and configuration visibility is complete: doctor report and stable evidence bundle now carry application/build/config/schema/flags snapshots, closing `OPS-58` baseline.
- `Week 6+` seventh item worker heartbeat telemetry is complete: worker snapshot / handshake / writeback now carry cpu, memory, tool backlog, current step, and last progress, doctor report has summarized stale workers and worker telemetry.
- `Week 6+` eighth item worker restart semantics are complete: worker logical id, runtime instance id, restart chain, and generation are persisted, heartbeat / writeback / doctor / CLI have restart audit semantics.
- `Week 6+` ninth item `AGENT-21` agent execution record is complete: dispatched worker execution has persisted plan / step / tool / decision / error / retry / restart evidence, and exposed execution evidence in inspect / approval / CLI.
- `Week 6+` tenth item `SEC-33` command security classifier closure is complete: unknown command has been changed to default deny, command classification results carry TTL cache, command executor's security judgment no longer defaults to allow for unmodeled commands.
- `Week 6+` eleventh item `SEC-34` configuration tampering protection is complete: `config/`, `divisions/`, and `AGENTS.md` have established protected integrity hash / drift detection, and integrated into doctor / sandbox/security / full regression.
- `Week 6+` twelfth item `DB-40` storage quota is complete: artifact / debug / backup directories have established quota inventory, oldest-first safe cleanup, and pin allowlist, and integrated into doctor / sandbox/security / full regression.
- `Week 6+` `TOOL-23` current slice is complete: builtin tool metadata contract validator has landed, startup consistency and doctor now default fail-close on invalid tool contract, and completed unit / integration / full regression.
- `Week 6+` `AGENT-20` current slice is complete: execution resource ceiling guard has performed runtime constraints on `tool calls / memory footprint / elapsed time`; skill execution, worker heartbeat/writeback, and doctor now fail-close or degrade-expose on over-limit, and completed unit / integration / sandbox/security / full regression.
- `Week 6+` `AGENT-19` current slice is complete: doctor now outputs structured escalation package based on stalled execution detection, summarizing trace / correlation, current step, runtime instance, warnings, incident root cause hints, and suggested operator action, and completed unit / integration / sandbox-security / full regression.
- `Week 6+` `SEC-32` current slice is complete: artifact store now performs secret redaction and injection risk scanning before text/json/markdown artifact persistence; diagnostics export return values and minimal reproduction export files are also synchronously sanitized, and completed unit / integration / sandbox-security / full regression.
- `Week 6+` `WF-16` current slice is complete: startup consistency checker now identifies workflow/task/session terminal state inconsistencies, runtime repair automatically reconciles task/session terminal state, doctor defaults to degrade-expose for this class of inconsistency, and completed integration / sandbox/security / full regression.
- `Week 6+` `OPS-55` current slice is complete: startup preflight has supplemented config validation and default provider readiness fail-fast; doctor CLI directly fail-closes on bad config, config symlink escape, and missing provider credentials, and completed unit / integration / CLI / sandbox/security / full regression.
- `Week 6+` `AGENT-17` current slice is complete: session lifecycle boundaries have been tightened, `awaiting_user` no longer allows pause again, terminated session is no longer reopened in human takeover retry and runtime repair requeue paths, but creates a new recovery session; startup consistency checker and runtime repair can now identify and repair dirty state of active tasks bound to terminal sessions, and completed unit / integration / sandbox-security / full regression.
- `Week 6+` `DB-37` current slice is complete: SQLite write transaction now maps real competing write locks to stable `sqlite.write_contention` fail-close error; `stable-concurrency` drill has added competing write scenario, verifying that competing writes do not pollute committed data and can be resubmitted after competition clears, and completed unit / integration / CLI / full regression.
- `Week 6+` `DB-38` current slice is complete: added periodic orphan cleanup service and `orphan-cleanup` CLI, which can close orphan sessions, re-queue orphan claimed tickets, and clean up invalid `runningExecutions` references in worker snapshots; completed unit / integration / sandbox/security / full regression.
- `Week 6+` `DB-39` current slice is complete: SQLite migration now executes per single migration transaction, and partial schema / ledger state is not left on failure; legacy schema automatic upgrade and post-failure repair retry recovery use cases have been supplemented, and completed integration / sandbox/security / full regression.
- `Week 6+` `DB-41` current slice is complete: SQLite now supports nested savepoint transactions and consistent read transactions; key write paths like dispatch / writeback now uniformly read execution/task/workflow/session through repository authoritative aggregate, and task snapshot has explicitly marked `authoritative` consistency, and completed unit / integration / sandbox/security / full regression.
- `Week 6+` `SCHED-06` current slice is complete: stale execution repair now actively recovers stale lease ownership, synchronously clears worker `runningExecutions` occupancy, and rebuilds pending tickets when original dispatch ticket is already claimed or missing, ensuring a clear redispatch path after repair; completed integration / sandbox/security / full regression.
- `Week 6+` `SCHED-08` current slice is complete: dispatch now supports conservative priority preemption MVP, only reclaiming old lease when `urgent` ticket hits "single-concurrent worker + clear resumable step boundary + low-priority executing run," setting original execution to `blocked`, workflow to `paused`, rebuilding pending ticket, and recording `dispatch:execution_preempted` / `dispatch:ticket_requeued` audit events and CLI/trace visibility; completed build / targeted unit+integration+CLI / sandbox/security / full regression.
- `Week 6+` `WF-13` current slice is complete: phase1a / phase1b workflow step snapshot has been unified into a stable checkpoint structure, containing decision context, resume context, and upstream artifact refs; runtime recovery view can now directly expose latest checkpoint, and completed unit / integration / sandbox/security / full regression.
- `Week 6+` `WF-14` current slice is complete: workflow runtime now supports crash injection at `step_started / tool_completed / before_commit`; phase1a / phase1b recovery drill has verified stale execution detection, checkpoint visibility, and repair closure, and completed unit / integration / sandbox/security / full regression.
- `Week 6+` `WF-15` current slice is complete: human takeover now supports manually setting workflow `currentStepIndex` / `resumableFromStep` and manually writing step output, preserving operator action audit, `workflow:step_completed` event, and workflow outputs writeback; `takeover` CLI and multi-step workflow regression have been supplemented, and completed integration / CLI / sandbox/security / full regression.
- `Week 6+` `TOOL-24` Tool timeout and retry standardization is complete: tool metadata's `defaultTimeoutMs / recoveryStrategy / retryableErrorCodes` is now uniformly consumed by skill/tool execution chain; `command_exec`, `edit_replace`, and skill runner have closed default timeout, timeout failure form, and fail-closed retry judgment.
- `Week 6+` `TOOL-25` Tool return value unified structure is complete: `command_exec` and `edit_replace` now uniformly expose `success / output / data / error / durationMs / metadata` consumer fields, upper layer no longer needs to branch-parse basic execution results by tool type.
- `Week 6+` `TOOL-26` Large output externalization is complete: `command_exec` above-threshold output now writes full sanitized result to `ArtifactStore`, message main chain only retains truncated summary and artifact reference, and completed regression verification.
- `Week 6+` thirteenth item `TOOL-27` Skill failure semantics are complete: skill has supplemented step-level events, failure retry, and output recording, and completed observability closure using existing execution / inspect / event infrastructure.
- `Week 6+` fourteenth item `TOOL-28` Skill cache correctness is complete: cacheable skill now incorporates git HEAD / source hash into cache key, records cache provenance on hit, and supports explicit disable switch.
- `Week 6+` `TOOL-29` Skill composition permission closure is complete: skill execution now falls back to execution `allowedToolsJson` when `allowedTools` is not explicitly passed, and performs runtime permission checks on `resolvedToolName` after model override; skill composition and model-aware tool switching cannot cross execution-level tool permissions.
- `Week 6+` `TOOL-30` MCP tool isolation verification is complete: MCP tool now enforces `mcp_<server>_<tool>` namespaced naming, blocks collision naming with builtin tools, and requires explicit metadata admission; MCP return content is treated as untrusted external content and separately sanitized, and forged `function_call / tool_use / tool_calls` payloads are blocked by fail-close.
- `Week 6+` `SEC-35` current direct tool permission and write path scope slice is complete: execution `allowedToolsJson / allowedPathsJson` and request `allowedPathRoots` are now directly consumed by `edit_replace` / `command_exec`; direct tool cannot cross execution-level tool allowlist, and must default fail-closed on malformed allowlist configuration, while satisfying both sandbox and path scope two-layer path constraints.
- `Week 6+` fifteenth item `P2-26` message Parts-ization is complete: `messages.parts_json` supports structured persistence, phase1b tool result now writes by `summary / artifact_ref / tool_result` parts, and Stage 1 context compaction prioritizes trimming `tool_result` part while preserving summary and artifact reference.
- `Week 6+` fifteenth item `P2-27` Typed event bus is complete: event registry has supplemented `payloadSchemaRef / compatibilityPolicy` metadata, and added `TypedEventBus` wrapper layer to close skill execution event publishing to compile-time verifiable boundaries.
- `Week 6+` fifteenth item `P2-28` Model-aware tool selection is complete: skill step now supports `modelOverrides`, can resolve logical tools to actual tool variants by `model profile / tier / capability`, and writes requested/resolved tool to step output and execution evidence; unknown profile and undeclared override targets default to fail-closed.
- `Week 6+` remote repo version consistency gate is complete: worker heartbeat now reports `repoVersion`, execution ticket can declare `requiredRepoVersion`, dispatch defaults fail-closed on repo mismatch, and rejection reason is linked into trace / CLI / migration compatibility replay.
- `Week 6+` `REMOTE-45` remote session telemetry / dispatch readiness current acceptable slice is complete: worker heartbeat / snapshot now persists `remoteSessionStatus`, `lastAcknowledgedStreamOffset`, resume/credential/session consistency telemetry, and key remote worker metrics; dispatch now defaults to rejecting new dispatches to non-`connected`, resume offset missing, or consistency mismatch remote workers and writes rejection trace, handshake / heartbeat / writeback have also fail-closed on `viewer_only`, consistency mismatch, and offset missing, inspect CLI added `workers` query, health / doctor has supplemented remote session degradation judgment.
- `Week 6+` `REMOTE-46` remote workspace sync conflict semantics current acceptable slice is complete: worker heartbeat / snapshot now persists `workspaceSyncStatus / workspaceSyncCheckedAt`; dispatch, handshake, writeback, and `worker-handshake` / `worker-writeback` / `worker-register` CLI default fail-close to `remote_workspace_sync_conflict` on dual-end workspace conflicts, health has also supplemented remote workspace conflict degradation judgment.
- `Week 6+` `SCHED-04` remote degradation strategy closure current acceptable slice is complete: dispatch now explicitly fail-closes to `remote.partial_available` on `require_remote + partial_available`; inspect / diagnostics / inspect CLI have supplemented remote routing summary to `healthy / partial_available / degraded / unavailable` bucket counting.
- `Week 6+` `OBS-51` alert convergence current acceptable slice is complete: diagnostics `DebugDump` now provides `warningSummary` aggregated by task, preserving compatible `warnings[]` deduplication output while supplementing same-type alert repetition suppression counting, severity classification, and escalation path definitions.
- `Week 6+` `OBS-52` incident timeline generator current acceptable slice is complete: diagnostics has added `incident` / `incident-export` output, can automatically assemble incident timeline report from events, dispatch, step outputs, messages, structured logs, and compaction records, providing candidate root cause, warning summary, and source counts, and exporting `incident-timeline-<taskId>.json/.md` dual artifacts.
- `Week 6+` `OBS-53` observability data retention policy current acceptable slice is complete: added observability retention service, which cleans `tier_2 / tier_3` events by retention period, performs controlled cleanup of non-summary messages from terminal sessions, and preserves `tier_1` audit events, `summary / compaction_summary`, and compaction records; doctor / diagnostics / stable evidence have supplemented retention summary, structured logger has changed to fixed-capacity circular buffer.
- `Week 6+` `REMOTE-47` graceful maintenance drain rehearsal current acceptable slice is complete: added `stable-maintenance` rehearsal / CLI, outputting `stable-maintenance-report.json` and `stable-maintenance-playbook.json`, verifying that draining worker does not receive new dispatch, active lease hands over at step boundary, and stale write fail-closes after handover, and integrated maintenance readiness into `stable-evidence`, `stable-gate`, and `stable-package`.
- `Week 6+` `REMOTE-48` distributed remote log aggregation current acceptable slice is complete: added `remote_log_entries` persistence and worker handshake / writeback `AA_REMOTE_LOGS_JSON` ingestion, task timeline has supplemented `remote_log` entries, diagnostics CLI added `remote-timeline` read-only view, and remote warn/error logs are aggregated into incident timeline source counts, context summary, and root cause hints.
- `Week 6+` `REMOTE-43` worker scheduling health state explicitation current acceptable slice is complete: worker registry, dispatch trace, inspect workers, health/doctor summary now uniformly expose `healthy / degraded / draining / quarantined / offline / unavailable` scheduling health state, operations surface no longer needs to infer from `idle / busy` whether worker is in a healthy schedulable range.
- `Week 6+` `REMOTE-42` trusted remote worker registry current acceptable slice is complete: added challenge-style remote worker registration, capability allowlist, trusted registration persistent field, and `worker-register` CLI; dispatch / handshake / writeback now default fail-closed on unverified remote workers, remote execution ownership path has been closed from heartbeat self-report to trusted registration closure.
- `Week 6+` `QA-59` launch gate checklist current acceptable slice is complete: `stable-gate` now formally exposes `requiredCriteria / optionalCriteria` gate results, `stable-package` now generates structured `stable-release-checklist.json` and summary markdown, consolidating smoke, long-run soak, recovery, rollback, runbook, and ownership into formal checklist artifacts.
- `Week 6+` `QA-60` fixed standard task set current acceptable slice is complete: golden task has expanded to 7 categories of fixed inventory: programming, research, content, data, cross-division, high-risk approval, and crash recovery, and `stable-runtime-validator` persists `golden-task-inventory.json`.
- `Week 6+` `QA-61` regression baseline current acceptable slice is complete: `stable-runtime-validator` now writes `stable-validation-baseline.json` on first run, subsequent re-runs output `baselineComparison`, `caseSummaries`, and correctness regression / duration drift comparison, providing formal artifacts for version degradation quantification.
- `Week 6+` `QA-63` rollback playbook current acceptable slice is complete: `stable-rollback` now synchronously persists `stable-rollback-playbook.json` in addition to `stable-rollback-report.json`, consolidating `application_binary / config_bundle / feature_flag / worker_version / prompt_bundle` rollback owner, prechecks, health validation, audit requirements, and rehearsal evidence into formal machine-readable playbook.
- `Week 6+` `SEC-31` Prompt Injection red team set current acceptable slice is complete: `stable-prompt-injection` now covers 5 payload categories: instruction override, system prompt dump, remote shell pivot, credential harvest, and benign control, consolidating matched rules / injection risk / redaction / warning into formal machine-readable red team report, and integrated into `stable-evidence` summary judgment.
- `Week 6+` execution handover semantics current acceptable slice is complete: execution lease service now supports controlled `handover`, which can transfer active lease from old worker to new worker, explicitly records old lease / new lease / lineage, monotonically increments fencing token, and synchronizes execution owner and worker snapshot; stable lease rehearsal / CLI has supplemented handover scenarios.
- `24h / 72h` long-duration stability evidence continues to be deferred per current decision, current implementation main line remains on `Week 6+` remote / PG-Redis / enterprise prep.

### Phase 1a

- Establish `src/`, `config/`, `divisions/`, `tests/` directory skeletons.
- Implement core types and enumerations for task, workflow, approval, event, and cost guards.
- Establish minimum storage abstraction and SQLite schema initial version.
- Implement minimum single-agent happy path.
- Tighten state machine, error model, event tiering, idempotency, and recovery checks.

### Phase 1b

- Introduce VP Operations and VP Orchestration foundations.
- Implement HQ-side limited task splitting and aggregation, keeping within single-division workflow and minimum orchestration boundaries.
- Integrate SSE / streaming output.
- Enhance context compression and state visualization.
- Keep within single-division workflow and minimum orchestration scope; do not do remote worker / marketplace / multi-tenancy ahead of schedule.

Current `Phase 1b` work packages:

| Work Package ID | Name | Corresponding Batch |
|-----------------|------|---------------------|
| `P1B-01` | `intake_router` deterministic triage runtime | `Batch 1` |
| `P1B-02` | `workflow_planner` and dependency graph expression | `Batch 1` |
| `P1B-03` | Single-division multi-agent orchestration runner | `Batch 1` |
| `P1B-04` | Task board and basic status query | `Batch 1` |
| `P1B-05` | Two-stage context compaction and pruning | `Batch 2` |
| `P1B-06` | Edit fuzzy / context-anchored enhancement | `Batch 2` |
| `P1B-07` | VCR replay and stream chunk replay enhancement | `Batch 3` |
| `P1B-08` | Debug dump / provider success rate / backpressure enhancement | `Batch 3` |

### Phase 2a

- Land multiple division samples.
- Enhance division loader, artifact, and recovery.
- Establish cross-division verification tests.

Current `Phase 2a` work packages:

| Work Package ID | Name | Corresponding Batch |
|-----------------|------|---------------------|
| `P2A-01` | Multi-division division loader and declarative workflow/role loading chain | `Batch 1` |
| `P2A-02` | Artifact store, step artifact lineage, and recovery snapshot baseline | `Batch 1` |
| `P2A-03` | Inspect / timeline artifact visibility and minimal repro bundle export | `Batch 1` |
| `P2A-04` | Runtime recovery repository, precheck persistence, and division recovery overview | `Batch 1` |
| `P2A-05` | Dead-letter repository and recovery decision audit | `Batch 1` |
| `P2A-06` | Recovery replay report and CLI replay chain | `Batch 1` |
| `P2A-07` | Cross-division recovery drill report and CLI | `Batch 1` |
| `P2A-08` | Execution ticket repository, dispatch service, and stable dispatch rehearsal | `Batch 1` |
| `P2A-09` | Worker claim / heartbeat handshake and stable worker rehearsal | `Batch 1` |
| `P2A-10` | Worker authoritative writeback / completion handshake and stable rehearsal | `Batch 1` |

### Phase 2b

- Land memory layer by ROI.
- Strengthen multi-channel, governance, stability, and observability.
- Establish long-running review.
- Currently completed three initial code slices: `MEM-05` memory repository / recall / quality baseline, `MEM-01` token estimation precision, and `MEM-02` STM -> LTM consolidation.

### Phase 2c

- Establish skill system.
- Introduce HR Agent boundary capabilities.
- Implement evolution MVP and approval chain.

### Phase 3

- Launch PMF metric validation.
- Land billing capability and perception module MVP.
- Strengthen Web / API product experience.

### Phase 4

- Advance enterprise capability matrix.
- Introduce marketplace / ecosystem governance.
- Establish SLA, organizational governance, and scaled operations system.

## Notes

- `Week 5` stability consolidation has supplemented release gate checklist, prompt injection red team set, rollback playbook, disaster recovery playbook, rolling upgrade playbook, and tenant-gray rollout playbook; but `24h / 72h` long-duration evidence remains an outstanding item before phase closure.
- Current revision has completed development work packages for `Phase 1a`, `Phase 1b`, `Phase 2a`, `Phase 2b`, and `Phase 2c`, and has entered `Phase 3` per current decision; `Phase 1a`'s `24h / 72h` long-duration evidence remains as an item to be closed.
- Subsequent phase documents are prepared, but phase scope must still be observed; do not use `Phase 2a` to race ahead on long-term remote platform / marketplace / tenant platform layer.
- Improvement item priorities are based on `operations-roadmap.md`, `current_status_and_gap_analysis.md`, and special reviews.
- Actual project status is based on `project_progress_tracker.md`; current short-term execution items are based on `current_todo_list.md`.
