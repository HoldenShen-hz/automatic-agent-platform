# Quality Engineering And Chaos Testing Contract

## 1. Scope

This contract defines the formal test matrix, regression baseline library, and chaos engineering scope.

Related documents:

- `testing_singleton_reset_contract.md`
- `vcr_and_fixture_testing_contract.md`
- `startup_consistency_and_recovery_drill_contract.md`
- `slo_alerting_and_runbook_contract.md`

## 2. Goals

- Elevate quality engineering from "test type list" to "coverage matrix".
- Establish cross-runtime-mode, cross-storage, cross-tenant regression baselines.
- Verify recovery, alerting, and damage control logic through chaos drills.

## 3. Formal Test Matrix

Must cover at least the following dimension combinations:

- Single-machine / distributed
- SQLite / PostgreSQL
- Supervised / auto / full-auto
- Single-tenant / multi-tenant
- Local tools / MCP tools / remote workers
- Small context / super-long context / malicious input
- OAPEFLIR closed-loop stages / rollout / feedback / learning

## 4. Regression Baseline Library

Fixed task set must include at least:

- Programming class
- Research class
- Content class
- Data class
- Cross-business division class
- High-risk approval class
- Crash recovery class
- OAPEFLIR closed-loop class
- Rollout / rollback class
- Observe-compatible product chain class

Each benchmark task must record at minimum:

- expected class
- success criteria
- cost ceiling
- latency band
- approval expectation
- recovery expectation

## 5. Testability Design Requirements

Key execution chains should preferentially expose narrow dependency injection surfaces rather than relying on global patches or module-level monkey patches.

Must apply at minimum to:

- query / model call
- compaction
- tool executor
- event dispatcher
- recovery drill

Rules:

- Dependency injection surfaces should be as narrow as possible, only covering high-frequency change points.
- Production implementation and test mock implementation should reuse the same signatures, avoiding test-specific bypass interfaces.
- If a module can only be tested through global state replacement, it should be treated as quality debt and entered into the governance ledger.

## 6. Chaos Engineering Scope

Mature industrial platforms must drill at minimum:

- Random kill worker
- Random provider 429 / 500
- Random DB lock conflict
- Random queue delay
- Random event duplication / loss
- Random MCP timeout
- Random OAPEFLIR stage interruption
- Random rollout gate block

## 7. Release Gate

Before release, must have:

- Regression baseline pass
- Fixture / VCR pass
- Recovery drill pass
- Migration compatibility pass
- Chaos smoke scenario pass
- OAPEFLIR loop regression pass
- Rollout / rollback regression pass

## 8. Test Artifacts

- `RegressionSuite`
- `ScenarioMatrix`
- `ChaosExperiment`
- `ReleaseGateReport`
- `FailureInjectionProfile`
- `ContractSuite`
- `InventoryBaseline`

## 8.1 Registry-backed Contract Suite

For stable registries or ecosystem boundaries, prioritize establishing shared contract suites rather than writing scattered assertions for each ingress.

Applicable objects include:

- gateway / channel registry
- plugin / extension registry
- workflow / division registry
- session binding / policy fallback registry

Rules:

- Shared contract suite should verify "whether registered, whether fields align, whether fallback meets expectations, whether ordering/output is stable".
- For long-term stable boundaries, inventory baseline can be retained, with explicit diff review at change time.

## 8.2 Hook / Lifecycle Event Contract Suite

For boundaries like hooks, lifecycle callbacks, and integration events, prioritize using formal event enums and contract suites rather than free-form strings.

Applicable objects include:

- pre/post tool use
- session / execution start
- user input submit
- graceful stop / cancellation

Rules:

- Hook event names should be centrally defined and versioned.
- Plugins and integration layers must not arbitrarily create semantically similar but differently named event strings.
- Related tests should verify: event name legality, order legality, and clear failure semantics when key events are missing.

## 9. Closure Conclusion

Industrial-grade quality engineering is not "write a few types of tests".

It must answer:

- Which scenarios are covered
- Which environment combinations are verified
- Which faults have been injected
- Whether the system can recover and mitigate damage after failure
