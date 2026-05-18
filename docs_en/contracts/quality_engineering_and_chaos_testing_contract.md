# Quality Engineering And Chaos Testing Contract

## 1. Scope

This contract defines the formal test matrix, regression baseline library, and chaos engineering scope.

Related documents:

- `testing_singleton_reset_contract.md`
- `vcr_and_fixture_testing_contract.md`
- `startup_consistency_and_recovery_drill_contract.md`
- `slo_alerting_and_runbook_contract.md`

## 2. Goals

- Upgrade quality engineering from "test type list" to "coverage matrix".
- Establish cross-execution-mode, cross-storage, cross-tenant regression baselines.
- Verify recovery, alerting, and damage control logic through chaos drills.

## 3. Formal Test Matrix

Must cover at minimum the following dimensional crosses:

- Single-node / distributed
- SQLite / PostgreSQL
- supervised / auto / full-auto
- Single-tenant / multi-tenant
- Local tools / MCP tools / remote workers
- Short context / ultra-long context / malicious input
- OAPEFLIR closed-loop phases / rollout / feedback / learning

## 4. Regression Baseline Library

Fixed task set must include:

- Programming tasks
- Research tasks
- Content tasks
- Data tasks
- Cross-division tasks
- High-risk approval tasks
- Crash recovery tasks
- OAPEFLIR closed-loop tasks
- Rollout / rollback tasks
- Observe-compatible product chain tasks

Each baseline task must record at minimum:

- expected class
- success criteria
- cost ceiling
- latency band
- approval expectation
- recovery expectation

## 5. Testability Design Requirements

Critical execution chains should prioritize exposing narrow dependency injection surfaces rather than relying on global patches or module-level monkey patches.

Applicable at minimum to:

- query / model call
- compaction
- tool executor
- event dispatcher
- recovery drill

Rules:

- Dependency injection surfaces should be as narrow as possible, covering only high-frequency change points.
- Production implementations and test mock implementations should share the same signatures, avoiding test-specific bypass interfaces.
- If a module can only be tested through global state replacement, it should be treated as quality debt and enter the governance ledger.

## 6. Chaos Engineering Scope

Mature industrial platforms must drill at minimum:

- Random worker kill
- Random provider 429 / 500
- Random DB lock conflicts
- Random queue delays
- Random event duplication / loss
- Random MCP timeout
- Random OAPEFLIR stage interruption
- Random rollout gate blockage

## 7. Release Gates

Before release there must be:

- regression baseline pass
- fixture / VCR pass
- recovery drill pass
- migration compatibility pass
- chaos smoke scenario pass
- OAPEFLIR loop regression pass
- rollout / rollback regression pass

## 8. Test Artifacts

- `RegressionSuite`
- `ScenarioMatrix`
- `ChaosExperiment`
- `ReleaseGateReport`
- `FailureInjectionProfile`
- `ContractSuite`
- `InventoryBaseline`

## 8.1 Registry-backed contract suite

For stable registries or ecosystem boundaries, prioritize establishing shared contract suites rather than writing scattered assertions for each integration surface.

Applicable objects:

- gateway / channel registry
- plugin / extension registry
- workflow / division registry
- session binding / policy fallback registry

Rules:

- Shared contract suites should verify "whether registered, whether fields aligned, whether fallback as expected, whether ordering/output stable".
- For long-term stable boundaries, inventory baselines may be retained with explicit diff review upon changes.

## 8.2 Hook / lifecycle event contract suite

For hooks, lifecycle callbacks, and integration event boundaries, prioritize using formal event enumerations and contract suites rather than free-form strings.

Applicable objects:

- pre/post tool use
- session / execution start
- user input submit
- graceful stop / cancellation

Rules:

- Hook event names should be centrally defined and versioned.
- Plugins and integration layers must not arbitrarily create semantically similar but differently named event strings.
- Related tests should verify: event name legality, order legality, clear failure semantics when key events are missing.

## 9. Closure Conclusion

Industrial-grade quality engineering is not "write several types of tests".

It must answer:

- Which scenarios are covered
- Which environment combinations are verified
- Which failures have been injected
- Whether the system can recover and mitigate damage after failure
