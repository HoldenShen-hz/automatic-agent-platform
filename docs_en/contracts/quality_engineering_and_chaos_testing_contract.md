# Quality Engineering And Chaos Testing Contract

## 1. Scope

This contract defines the formal testing matrix, regression baseline library, and chaos engineering scope.

Related documents:

- `testing_singleton_reset_contract.md`
- `vcr_and_fixture_testing_contract.md`
- `startup_consistency_and_recovery_drill_contract.md`
- `slo_alerting_and_runbook_contract.md`

## 2. Goals

- Upgrade quality engineering from "test type list" to "coverage matrix".
- Establish cross-execution-mode, cross-storage, cross-tenant regression baselines.
- Verify recovery, alerting, and loss-control logic through chaos drills.

## 3. Formal Testing Matrix

At minimum cover the following dimension intersections:

- Standalone / distributed
- SQLite / PostgreSQL
- supervised / auto / full-auto
- Single-tenant / multi-tenant
- Local tools / MCP tools / remote workers
- Small context / ultra-long context / malicious input
- OAPEFLIR closed-loop stages / rollout / feedback / learning

## 4. Regression Baseline Library

Fixed task set includes at minimum:

- Programming class
- Research class
- Content class
- Data class
- Cross-division class
- High-risk approval class
- Crash recovery class
- OAPEFLIR closed-loop class
- Rollout / rollback class
- Observe-compatible product chain class

Each baseline task records at minimum:

- expected class
- success criteria
- cost ceiling
- latency band
- approval expectation
- recovery expectation

## 5. Testability Design Requirements

Key runtime chains should prioritize exposing narrow dependency injection surfaces rather than relying on global patches or module-level monkey patches.

At minimum applies to:

- query / model call
- compaction
- tool executor
- event dispatcher
- recovery drill

Rules:

- Dependency injection surfaces should be as narrow as possible, covering only high-frequency change points.
- Production implementation and test mock implementation should reuse the same signature, avoiding test-specific bypass interfaces.
- If a module can only be tested through global state replacement, it should be treated as quality debt and entered into governance ledger.

## 6. Chaos Engineering Scope

Mature industrial platform drills at minimum:

- Random kill worker
- Random provider 429 / 500
- Random DB lock conflict
- Random queue delay
- Random event duplicate / loss
- Random MCP timeout
- Random OAPEFLIR stage interrupt
- Random rollout gate block

## 7. Release Gate

Before release must have:

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

## 8.1 Registry-backed Contract Suite

For stable registries or ecosystem boundaries, prioritize establishing shared contract suites rather than writing scattered assertions repeatedly for each integration surface.

Applicable objects include:

- gateway / channel registry
- plugin / extension registry
- workflow / division registry
- session binding / policy fallback registry

Rules:

- Shared contract suite should verify "whether registered, whether fields align, whether fallback meets expectations, whether ordering/output is stable".
- For long-term stable boundaries, inventory baseline can be retained, with explicit diff review on changes.

## 8.2 Hook / Lifecycle Event Contract Suite

For boundaries like hook, lifecycle callback, and integration event, prioritize using formal event enumeration and contract suite rather than free-form strings.

Applicable objects include:

- pre/post tool use
- session / execution start
- user input submit
- graceful stop / cancellation

Rules:

- Hook event names should be centrally defined and versioned.
- Plugins and integration layers are not allowed to arbitrarily create event strings with similar semantics but different names.
- Related tests should verify: event name legality, order legality, and clear failure semantics when key events are missing.

## 9. Closure Conclusion

Industrial-grade quality engineering is not "write several types of tests".

It must answer:

- Which scenarios are covered
- Which environment combinations are verified
- Which failures have been injected
- Whether the system can recover and control losses after failure
