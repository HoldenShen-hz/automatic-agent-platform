# Quality Engineering And Chaos Testing Contract

## 1. Scope

This contract defines the formal test matrix, regression baseline library, and chaos engineering scope.

Related documents:

- `testing_singleton_reset_contract.md`
- `vcr_and_fixture_testing_contract.md`
- `startup_consistency_and_recovery_drill_contract.md`
- `slo_alerting_and_runbook_contract.md`

## 2. Goals

- Upgrade quality engineering from a "list of test types" to a "coverage matrix".
- Establish a regression baseline across runtime modes, storage backends, and tenants.
- Validate recovery, alerting, and damage-control logic through chaos drills.

## 3. Formal Test Matrix

Must cover at least the following dimensional cross-products:

- Single-machine / distributed
- SQLite / PostgreSQL
- supervised / auto / full-auto
- Single-tenant / multi-tenant
- Local tools / MCP tools / remote workers
- Small context / ultra-long context / malicious input
- OAPEFLIR loop stages / rollout / feedback / learning

## 4. Regression Baseline Library

The fixed task set must include at least:

- Programming
- Research
- Content
- Data
- Cross-division
- High-risk approval
- Crash recovery
- OAPEFLIR loop
- Rollout / rollback
- Observe-compatible product line

Each baseline task must at least record:

- expected class
- success criteria
- cost ceiling
- latency band
- approval expectation
- recovery expectation

## 5. Testability Design Requirements

Critical runtime chains should prioritize exposing narrow dependency injection surfaces rather than relying on global patches or module-level monkey patches.

At least applicable to:

- query / model call
- compaction
- tool executor
- event dispatcher
- recovery drill

Rules:

- The dependency injection surface should be as narrow as possible, covering only high-frequency change points.
- Production implementations and test fakes should reuse the same signatures, avoiding test-specific bypass interfaces.
- If a module can only be tested by global state replacement, it should be considered quality debt and entered into the governance ledger.

## 6. Chaos Engineering Scope

A mature industrial platform must at least drill:

- Random worker kill
- Random provider 429 / 500
- Random DB lock conflict
- Random queue delay
- Random event duplication / loss
- Random MCP timeout
- Random OAPEFLIR stage interruption
- Random rollout gate blocking

### 6.1 Chaos Scenario Catalog and Fallback Profile

- `deploy/chaos/catalog.json` is the authoritative index of chaos scenario catalogs in the repository.
- Each scenario must map to a fallback profile that the scheduler can recognize.
- The default fallback profile is maintained by `DEFAULT_CHAOS_FALLBACK_PROFILES` in `src/ops-maturity/chaos/chaos-experiment-types.ts`.

## 7. Release Gate

A release must have the following before it goes out:

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

For stable registry or ecosystem boundaries, prefer to build a shared contract suite rather than writing scattered assertions for each integration surface.

Applicable objects include:

- gateway / channel registry
- plugin / extension registry
- workflow / division registry
- session binding / policy fallback registry

Rules:

- A shared contract suite should verify "is it registered, do fields align, does the fallback match expectations, is the ordering / output stable".
- For long-term stable boundaries, an inventory baseline is allowed and differences should be explicitly reviewed on change.

## 8.2 Hook / Lifecycle Event Contract Suite

For boundaries such as hooks, lifecycle callbacks, and integration events, prefer formal event enums and contract suites over free-form strings.

Applicable objects include:

- pre/post tool use
- session / execution start
- user input submit
- graceful stop / cancellation

Rules:

- Hook event names should be centrally defined and versioned.
- Plugins and integration layers are not allowed to freely create event strings that are semantically similar but differently named.
- Related tests should verify: event names are valid, ordering is valid, and missing key events result in clear failure semantics.

## 9. Closure Conclusion

Industrial-grade quality engineering is not "write a few types of tests".

It must answer:

- Which scenarios are covered
- Which environment combinations are verified
- Which faults have been injected
- Whether the system can recover and stop the bleeding after a failure
