# ADR-072 OAPEFLIR Testing Strategy and New Module Test Matrix

- Status: Accepted
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

## Context

The OAPEFLIR eight-stage architecture introduces 7 core modules (agent-loop/planning/feedback/learning/improvement/knowledge/domain-registry), totaling approximately 130 files and 15,774 lines of code. These modules are currently marked as Unverified and require a complete testing strategy to ensure production readiness.

## Decision

### 1. Test Layering Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Golden / E2E Tests                        │
│   (tests/golden/harness-run-*.test.ts etc)                   │
├─────────────────────────────────────────────────────────────┤
│                   Integration Tests                          │
│   (tests/integration/platform/orchestration/*.test.ts etc)   │
├─────────────────────────────────────────────────────────────┤
│                    Unit Tests                                │
│   (tests/unit/{module}/*.test.ts)                           │
├─────────────────────────────────────────────────────────────┤
│          Invariants / Docs / Targeted Risk Checks           │
│   (tests/invariants/*.test.ts, tests/unit/docs/*.test.ts)   │
└─────────────────────────────────────────────────────────────┘
```

### 2. New Module Test Matrix (v4.3 runtime module structure)

| Module | Unit Tests | Integration Tests | Golden | Security | Estimated Cases |
|--------|------------|-------------------|--------|----------|-----------------|
| `platform/interface/` | API gateway, ingress, scheduler | intake→admission→projection integration | harness-run happy path | handoff info leakage | ~120 |
| `platform/control-plane/` | IAM, config-center, approval-center | control-plane→orchestration | linear plan happy path | — | ~80 |
| `platform/orchestration/` | OAPEFLIR, routing, planner, HITL | plan→execute integration | — | autonomy boundary | ~60 |
| `platform/execution/` | dispatcher, execution-engine, recovery, worker-pool | execution→state-evidence | failure pattern golden | — | ~80 |
| `platform/state-evidence/` | truth, events, checkpoints, artifacts | truth→events delivery | canary→stable golden | source pollution | ~100 |
| `domains/` | domain-registry, plugin-spi | plugin loading→execution | retrieval accuracy golden | config injection | ~150 |
| `interaction/` | NL entry, goal decomposition | ingestion→retrieval E2E | — | — | ~40 |
| **Total** | | | | | **~730** |

### 3. E2E Test Design (5 Core Tests)

#### Test 1: Runtime Happy Path
```
Input: "modify foo.ts bar function"
Verify: intake → admission → `HarnessRun` / `NodeRun` / `NodeAttemptReceipt` full chain
Verify: canonical contract passes schema validation
Verify: `oapeflir.view.*` stage views are continuous, and do not replace runtime truth
Verify: <60s E2E latency
```

#### Test 2: Runtime Failure Drives Learn
```
Input: Invalid file path (will definitely fail)
Verify: After `NodeRun` fails, feedback / learn views can link back to same `harnessRunId`
Verify: FailurePattern has evidence links
```

#### Test 3: Replan Trigger
```
Input: tool_failure mid-execution
Verify: ReplanningService generates version N+1
Verify: New `GraphPatch` continues after failed `NodeRun`
```

#### Test 4: Release Gate Progression
```
Input: Existing LearningObject → ImprovementCandidate
Verify: shadow → canary_5 → partial_25 → stable complete flow
Verify: Automatic rollback when metrics do not meet threshold
```

#### Test 5: Multi-Agent Handoff
```
Input: Task requiring 2 Agents to collaborate
Verify: HandoffBuilder serialization/deserialization round-trip
Verify: Token budget < 1000
Verify: FactLayer has no sensitive data leakage
```

### 4. Performance Goals and Dedicated Benchmark Landing Points

## v4.3 ADR Remediation

- A-66: This ADR originally described OAPEFLIR testing as "no stage skipped" executable main chain and used "continue after failed step" to describe replan. Root cause: testing strategy ADR mixed cognitive stage views with runtime execution graphs. Fix: The body now limits OAPEFLIR to view continuity verification, and switches recovery/replan anchor to `GraphPatch / NodeRun`.
- R8-74: Test goals rewritten to `HarnessRun / NodeRun / NodeAttemptReceipt` truth + `oapeflir.view.*` projection continuity, OAPEFLIR itself no longer described as an independent execution pipeline.
- R16-94: This ADR previously wrote `tests/security/`, `tests/chaos/`, `tests/performance/` as existing directories. Root cause: planning-specific test assets were mistaken for delivered facts. Fix: The body now only lists `tests/unit/`, `tests/integration/`, `tests/golden/`, `tests/e2e/`, `tests/invariants/` as existing authoritative test roots; specialized performance/security/chaos suites can only claim existence after directories and CI are truly in place.

| Module | Operation | P99 Goal | Current Verification Entry |
|--------|-----------|----------|---------------------------|
| Feedback | signal-preprocessor.preprocess() | <10ms | Carried by corresponding module unit tests or subsequent dedicated benchmarks |
| Knowledge | knowledge-query-service.query() (Quick) | <100ms | Carried by corresponding module unit tests or subsequent dedicated benchmarks |
| Knowledge | knowledge-retrieval.retrieve() (Standard) | <500ms | Carried by corresponding module unit tests or subsequent dedicated benchmarks |
| Planning | plan-builder.build() | <50ms | Carried by corresponding module unit tests or subsequent dedicated benchmarks |
| Runtime + OAPEFLIR View | `HarnessRun` truth and `oapeflir.view.*` projection continuity | <30s | Currently primarily integration tests and `tests/invariants/` invariant guards |
| Handoff | handoff-serializer.serialize() | <5ms | Carried by handoff-related unit tests and invariant tests |
| Plugin | plugin-spi-registry.invoke() | <200ms | Carried by plugin SPI related unit tests and invariant tests |

Note:

- Currently existing authoritative test roots in the repo are only `tests/unit/`, `tests/integration/`, `tests/golden/`, `tests/e2e/`, `tests/invariants/`.
- If dedicated `performance` / `security` / `chaos` suites are added later, directories, test files, and CI wiring must all be in place before claiming existence in ADR.

### 5. Security Test Coverage

| Test Type | Coverage Content |
|-----------|-----------------|
| Handoff info leakage | FactLayer does not leak sensitive data |
| Autonomy boundary | Unauthorized operations intercepted by guardrail |
| Domain config injection | Malicious configuration rejected by PluginConfigValidator |
| Source pollution | Knowledge ingestion does not introduce pollution |
| Tool call injection | CommandExecutor prevents shell injection |

### 6. Chaos Testing (Stable Release Gate)

| Scenario | Injected Fault | Expected Recovery |
|----------|---------------|-------------------|
| Agent node down | kill -9 simulating node failure | Lease reassignment, task migration |
| Database connection broken | network partition | Events persisted, local buffering |
| Replan storm | 10 consecutive tool_failures | Backoff strategy triggered, task termination |
| Memory overflow | Allocation exceeded limit | OOM caught, resources released |

## Alternatives

### Option A: Unit tests only

Pros: Quick coverage of core logic.
Cons: No E2E verification, cannot discover inter-stage integration issues.

### Option B: Complete test pyramid (selected)

Pros: Unit/integration/golden/security/chaos layered, comprehensive coverage.
Cons: High workload (~730 test cases + performance benchmarks).

## Consequences

- New `tests/unit/{module}/` directory structure.
- New `tests/integration/` integration test files.
- New `tests/golden/` Golden path tests.
- Dedicated performance/security/chaos suites can be landed separately later, but must create real directories, test files, and CI wiring before updating ADR.
- `npm test` must pass in full as production readiness gate.

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 State Machine](./018-rollout-eleven-state-machine.md)
- `docs_zh/reviews/architecture-design-vs-implementation-review.md` §G1 Solution (original design_gap_analysis_v9.md archived)

## Source Section

- `§G1` Test Coverage Solution
- `§G3` E2E Test Design
- `§G4` Performance Benchmark Testing
- `§6.1` Industrial-Grade Standards

## v4.3 ADR Remediation

- R6-55: Fixed test matrix aligned with v4.3 canonical runtime modules. ADR-072 originally organized test matrix by OAPEFLIR module directories, inconsistent with v4.3 canonical runtime module structure (platform/interface/, platform/control-plane/, platform/orchestration/, platform/execution/, platform/state-evidence/, domains/, interaction/). Fix: Test matrix in body now uses v4.3 runtime module structure.
