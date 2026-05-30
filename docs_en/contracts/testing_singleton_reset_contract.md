# Testing Singleton Reset Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines reset rules for global singletons, caches, registries, and long-lifecycle runtime objects in test environments.

Related documents:

- `project_structure_contract.md`
- `context_propagation_contract.md`
- `runtime_repository_and_migration_contract.md`

## 2. Objectives

The test reset system must at minimum guarantee:

- Unit tests and integration tests do not pollute each other's global state.
- Each test run starts from a predictable minimal clean environment.
- Reset capability is a formal API, not scattered private hacks.

## 3. Objects That Must Support Reset

Phase 1a minimum includes:

- runtime registry / active execution map
- SQLite connections and in-memory cache
- provider client cache / health cache
- tool registry / plugin registry
- event bus listeners / in-memory queues
- config cache / feature flags
- cost tracker / quota counters
- AsyncLocalStorage test harness

## 4. Naming and Exposure Rules

Recommended naming:

- `_resetRuntimeForTesting()`
- `_resetStorageForTesting()`
- `_resetProviderForTesting()`
- `_resetEventBusForTesting()`
- `_resetToolRegistryForTesting()`
- `_resetConfigForTesting()`

Rules:

- Reset APIs must explicitly carry the `ForTesting` suffix.
- By default, only allowed to be called under `NODE_ENV=test`.
- Reset behavior must be idempotent; multiple calls produce consistent results.

## 5. `TestResetReport`

| Field | Type | Description |
| --- | --- | --- |
| `component` | `string` | Component being reset |
| `reset_applied` | `boolean` | Whether reset succeeded |
| `cleared_items` | `number?` | Number of items cleared |
| `warnings` | `string[]` | Anomaly warnings |

## 6. Global Test Entry

```mermaid
flowchart TD
    A["beforeEach / setupFiles"] --> B["reset Config"]
    B --> C["reset Runtime / EventBus"]
    C --> D["reset Provider / Cost Tracker"]
    D --> E["reset Tool Registry / Plugins"]
    E --> F["recreate Temp Storage"]
    F --> G["run test"]
```

Rules:

- Test setup should uniformly call the main entry point, not each test file assembling reset order independently.
- Reset failures should directly fail the test, not silently ignore them.

## 7. Temporary Resource Rules

- Temporary SQLite databases should be isolatable per test file or test case.
- Temporary artifact directories should be cleaned up in teardown.
- Temporary network mocks / fake gateway states should also be included in the reset flow.

## 8. Boundary with Production Code

- Reset serves testing only, and must not become a replacement for production recovery mechanisms.
- Shutdown/cleanup in production code and test reset may share underlying logic, but external entry points should be separate.

## 9. Phase Boundaries

Phase 1a does:

- Key singleton reset APIs
- Uniform test setup calls
- `NODE_ENV=test` guard

Phase 1b does:

- More integration/e2e shared harnesses
- Additional reset entry points for gateway/orchestration testing

## 10. Conclusion

Tests without a unified reset system will quickly degrade from "regression protection" to "random scripts that occasionally pass"; this contract formally freezes the test isolation boundary.