# Quality Engineering And Chaos Testing Contract

## 1. Scope

This contract defines the formal test matrix, regression baseline library, and chaos engineering scope.

Related documents:

- `testing_singleton_reset_contract.md`
- `vcr_and_fixture_testing_contract.md`
- `startup_consistency_and_recovery_drill_contract.md`
- `slo_alerting_and_runbook_contract.md`

## 2. Goals

- Elevate quality engineering from "test type list" to "coverage matrix."
- Establish regression baseline across execution modes, storage, and tenants.
- Verify recovery, alerting, and loss-stopping logic through chaos drills.

## 3. Formal Test Matrix

At minimum cover the following dimension crosses:

- single-machine / distributed
- SQLite / PostgreSQL
- supervised / auto / full-auto
- single-tenant / multi-tenant
- local tools / MCP tools / remote workers
- small context / ultra-long context / malicious input

## 4. Regression Baseline Library

Fixed task set at minimum contains:

- Programming type
- Research type
- Content type
- Data type
- Cross-business unit type
- High-risk approval type
- Crash recovery type

Each baseline task at minimum records:

- expected class
- success criteria
- cost ceiling
- latency band
- approval expectation
- recovery expectation

## 5. Testability Design Requirements

Key execution chains should preferentially expose narrow dependency injection surfaces rather than relying on global patches or module-level monkey patches.

At minimum applicable to:

- query / model call
- compaction
- tool executor
- event dispatcher
- recovery drill

Rules:

- Dependency injection surface should be as narrow as possible and only cover high-frequency change points.
- Production implementation and test fake implementation should reuse the same signatures and avoid test-specific bypass interfaces.
- If a module can only be tested through global state replacement, should be regarded as quality debt and enter governance ledger.

## 6. Chaos Engineering Scope

Mature industrial platform at minimum drills:

- Random kill worker
- Random provider 429 / 500
- Random DB lock conflict
- Random queue delay
- Random event duplicate / loss
- Random MCP timeout

## 7. Release Gate

Before release must have:

- regression baseline pass
- fixture / VCR pass
- recovery drill pass
- migration compatibility pass
- chaos smoke scenario pass

## 8. Test Artifacts

- `RegressionSuite`
- `ScenarioMatrix`
- `ChaosExperiment`
- `ReleaseGateReport`
- `FailureInjectionProfile`
- `ContractSuite`
- `InventoryBaseline`

## 8.1 Registry-backed Contract Suite

For stable registries or ecosystem boundaries, prioritize establishing shared contract suites rather than writing scattered assertions for each integration surface.

Applicable objects include:

- gateway / channel registry
- plugin / extension registry
- workflow / division registry
- session binding / policy fallback registry

Rules:

- Shared contract suites should verify "whether registered, whether fields aligned, whether fallback as expected, whether ordering/output stable."
- For long-term stable boundaries, allows retaining inventory baseline and explicitly reviewing differences when changes occur.

## 8.2 Hook / Lifecycle Event Contract Suite

For boundaries like hooks, lifecycle callbacks, and integration events, prioritize using formal event enumeration and contract suites rather than free strings.

Applicable objects include:

- pre/post tool use
- session / execution start
- user input submit
- graceful stop / cancellation

Rules:

- Hook event names should be centrally defined and versioned.
- Plugins and integration layers must not arbitrarily create semantically similar but differently named event strings.
- Related tests should verify: event name legal, order legal, clear failure semantics when key events are missing.

## 9. Closure Conclusion

Industrial-grade quality engineering is not "writing a few types of tests."

It must answer:

- Which scenarios are covered
- Which environment combinations are verified
- Which faults have been injected
- Whether the system can recover and stop losses after failure
