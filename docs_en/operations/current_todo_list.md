# Current Todo List

> This remediation list is now driven exclusively by [architecture-design-vs-implementation-review.md](../reviews/architecture-design-vs-implementation-review.md).
> It replaces the earlier `W0-W6` status language and only keeps repository-actionable work that can be implemented, tested, and written back to documentation.

## 1. Execution Boundary

- Only include gaps that can be closed inside this repository.
- External infrastructure and external-system work such as `S4` clustered K8s sharding, real enterprise IdP wiring, and standalone WCAG frontend rework are tracked as follow-up notes, not active todo items.
- Every wave must close code, tests, documentation, and review status together.

## 2. Priority Mapping

| Priority | Review gaps | Remediation wave |
| --- | --- | --- |
| `P0` | `II-1`, `III-1`, `IV-1`, `VI-1~VI-3` | `R1-R3` |
| `P1` | `I-2`, `II-2`, `III-2`, `IV-2~IV-4`, `VI-4~VI-9` | `R2-R5` |
| `P2` | `IV-5~IV-7`, `VI-10~VI-13` | `R4-R5` |
| `P3` | `II-3`, `VI-14/15`, `IX-1` | `R5-R6` |

## 3. Active Remediation Waves

### R0. Reset todo/review language

Status: `in_progress`

- Rewrite `current_todo_list` into an `R0-R6` review-driven structure.
- Remove the earlier `W1-W5 done` language.
- Deduplicate repeated review blocks and keep one authoritative gap ledger.
- Add a stable `review id -> remediation wave` mapping.

### R1. Harness P0/P1 runtime closure

Status: `in_progress`

- Extend `ConstraintPack` with `risk_policy` and `output_policy`.
- Upgrade `HarnessRun` to multi-state lifecycle semantics.
- Add `PlanBundle`, `WorkProduct`, `EvaluationReport`, `ContextSnapshot`, `WorkflowSleepLease`, and `RecoveryCheckpoint`.
- Add iteration/re-entry/resume/recovery runtime entrypoints.
- Close review `VI-1 ~ VI-6`.

### R2. ACP, OAPEFLIR↔Harness mapping, ModelGateway closure

Status: `in_progress`

- Add formal `collaboration-protocol` support under `agent-delegation`.
- Wire ACP into delegation validation, completion evidence, and takeover audit paths.
- Add explicit OAPEFLIR↔Harness semantic mapping recorded in Harness steps/reports.
- Add `embed()` and `complete()` to `UnifiedChatProvider`.
- Close review `II-1`, `I-2`, `II-2`.

### R3. Domain meta-model, recipe expansion, canonical domain IDs

Status: `in_progress`

- Add `src/domains/canonical-meta-model/` with Q1-Q12, validator, completeness scoring, and 24-domain seeders.
- Connect descriptor review and baseline bootstrap to meta-model validation.
- Expand recipe prototypes from 4 to 12.
- Normalize the 12 mismatched `domain_id` values and add legacy alias compatibility.
- Close review `III-1`, `III-2`, `IV-1`.

### R4. 24-domain specialized config and runtime surface

Status: `in_progress`

- Add formal per-domain config, workflow, tool, risk, eval, latency, and ownership wiring.
- Replace the generic `intake -> deliver` workflow as the final baseline.
- Prioritize `quant-trading`, `financial-services`, `finance-accounting`, `legal`, and `healthcare`.
- Close review `IV-2 ~ IV-7`.

### R5. Harness P2/P3 subsystems and product closure

Status: `todo`

- Add `ToolbeltAssembler`, five-layer guardrails, formal HITL runtime, `FeedbackEnvelope`, memory namespace support, async harness, and evaluation harness.
- Attach these capabilities to the main `HarnessRun` chain.
- Add Harness observability, replay, and audit linkage.
- Close review `VI-7 ~ VI-15`.

### R6. Roadmap, ADRs, ops-maturity stub reduction, final document closure

Status: `todo`

- Fix `RoadmapService` to include Phase 8/9 registration.
- Add the missing ADR set called out by the review.
- Align `harness/` directory structure, exports, todo, and review language.
- Reduce high-stub leaf tools in `ops-maturity`.
- Write back `review / coverage-matrix / current_todo_list` so all implemented items show `✅`.

## 4. Test Rules

Each wave must include:

1. code
2. targeted tests
3. documentation updates
4. fixes for failures triggered by that wave

Minimum coverage:

- Harness: `unit + integration`
- ACP / delegation: `unit + contract`
- domains: `unit + smoke + registry + rollout/governance wiring`
- ModelGateway: `unit + integration`
- documentation consistency: `docs + links + health`

## 5. Current Progress Snapshot

- `R0` is underway: the todo language has been reset to review-driven remediation.
- `R1` now has its mainline closure in place: the extended ConstraintPack, Harness multi-lifecycle state machine, PlanBundle/WorkProduct/EvaluationReport/ContextSnapshot/WorkflowSleepLease/RecoveryCheckpoint, and resume/recovery/sleep runtime paths are landed with targeted tests.
- `R3` now has its mainline implementation in place: Q1-Q12 meta-model support, 12 recipe prototypes, 12 canonical domain IDs, legacy alias compatibility, descriptor/bootstrap wiring, and targeted tests are landed.
- `R4` now has its first mainline implementation in place: all 24 domains expose formal config entrypoints plus domain-specific workflow/tool/eval/latency/ownership metadata, with unit and integration coverage.
- `R5` now has its second subsystem implementation in place: `ToolbeltAssembler`, `GuardrailEngine`, `HitlRuntime`, `HarnessMemoryManager`, `AsyncHarnessService`, `EvalRunService`, plus timeline/invariant enforcement are wired into the Harness mainline and protected by unit/integration coverage.
- `R1-R6` remain governed by the review gap ledger rather than the older `W* done` status.
- Future `done` states require code, tests, and documentation to land together.
