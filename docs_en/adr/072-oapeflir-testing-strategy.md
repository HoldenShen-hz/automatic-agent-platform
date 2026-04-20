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
│   (tests/golden/oapeflir-happy-path.test.ts etc)           │
├─────────────────────────────────────────────────────────────┤
│                   Integration Tests                          │
│   (tests/integration/oapeflir-loop-integration.test.ts etc)  │
├─────────────────────────────────────────────────────────────┤
│                    Unit Tests                                │
│   (tests/unit/{module}/*.test.ts)                           │
├─────────────────────────────────────────────────────────────┤
│               Security / Chaos / Performance                │
│   (tests/security/, tests/chaos/, tests/performance/)       │
└─────────────────────────────────────────────────────────────┘
```

### 2. New Module Test Matrix

| Module | Unit Tests | Integration Tests | Golden | Security | Estimated Cases |
|------|---------|---------|--------|------|---------|
| `agent-loop/` | run() loop integrity, assess, handoff | 8-stage integration | O→A→P→E→F happy path | handoff info leakage | ~120 |
| `planning/` | plan-builder, DAG validator, replanning, strategy selector | plan→execute integration | linear plan happy path | — | ~80 |
| `feedback/` | signal-preprocessor (dedup/correlate/filter), collector, event-consumer | feedback→learning delivery | — | — | ~60 |
| `learning/` | 4 detectors, learning-object-validator, experience-distillation | learn→improve delivery | failure pattern golden | — | ~80 |
| `improvement/` | rollout-state-machine, rollout-scheduler, auto-rollback, guardrail | full rollout flow | canary→stable golden | autonomy boundary | ~100 |
| `knowledge/` | knowledge-plane-service, retrieval, vector-store, ingestion-pipeline | ingest→retrieve E2E | retrieval accuracy golden | source pollution | ~150 |
| `domain-registry/` | plugin-spi-registry, plugin-runtime-host, domain-registry-service | plugin load→execute | — | config injection | ~100 |
| `plugins/` | github-adapter, basic-planner, coding-retriever | plugin register→invoke | — | — | ~40 |
| **Total** | | | | | **~730** |

### 3. E2E Test Design (5 Core Tests)

#### Test 1: Happy Path
```
Input: "modify foo.ts bar function"
Verify: Full chain O→A→P→E→F→L→I(shadow)
Verify: Each stage DTO passes Zod validation
Verify: No stage skipped
Verify: <60s E2E latency
```

#### Test 2: Execution Failure Triggers Learn
```
Input: Invalid file path (guaranteed to fail)
Verify: Execute failure → Feedback → Learn produces FailurePattern
Verify: FailurePattern has evidence links
```

#### Test 3: Replan Trigger
```
Input: Tool failure mid-execution
Verify: ReplanningService generates version N+1
Verify: New Plan continues from failed step
```

#### Test 4: Canary Upgrade Flow
```
Input: Existing LearningObject → ImprovementCandidate
Verify: shadow → canary_5 → partial_25 → stable complete flow
Verify: Automatic rollback when metrics are not met
```

#### Test 5: Multi-Agent Handoff
```
Input: Task requiring 2 Agent collaboration
Verify: HandoffBuilder serialization/deserialization round-trip
Verify: Token budget < 1000
Verify: FactLayer has no sensitive info leakage
```

### 4. Performance Baseline Targets

| Module | Operation | P99 Target | Test File |
|------|------|---------|---------|
| Feedback | signal-preprocessor.preprocess() | <10ms | tests/performance/feedback-perf.test.ts |
| Knowledge | knowledge-query-service.query() (Quick) | <100ms | tests/performance/knowledge-perf.test.ts |
| Knowledge | knowledge-retrieval.retrieve() (Standard) | <500ms | tests/performance/knowledge-perf.test.ts |
| Planning | plan-builder.build() | <50ms | tests/performance/planning-perf.test.ts |
| OAPEFLIR | Full loop O→A→P→E→F | <30s | tests/performance/oapeflir-perf.test.ts |
| Handoff | handoff-serializer.serialize() | <5ms | tests/performance/handoff-perf.test.ts |
| Plugin | plugin-spi-registry.invoke() | <200ms | tests/performance/plugin-perf.test.ts |

### 5. Security Test Coverage

| Test Type | Coverage |
|---------|---------|
| Handoff info leakage | FactLayer does not leak sensitive data |
| Autonomy boundary | Unauthorized operations blocked by guardrail |
| Domain config injection | Malicious configuration rejected by PluginConfigValidator |
| Source pollution | Knowledge ingestion does not introduce pollution |
| Tool call injection | CommandExecutor prevents shell injection |

### 6. Chaos Testing (Stable Release Gate)

| Scenario | Injected Failure | Expected Recovery |
|------|---------|---------|
| Agent node down | kill -9 simulates node failure | Lease reallocated, task migrated |
| Database connection lost | network partition | Event persisted, local buffer |
| Replanning storm | 10 consecutive tool_failures | Backoff strategy triggered, task terminated |
| Memory exhaustion | Allocation exceeds limit | OOM caught, resources released |

## Alternatives

### Option A: Unit Tests Only

Pros: Quick coverage of core logic.
Cons: No E2E verification, cannot find inter-stage integration issues.

### Option B: Complete Test Pyramid (Chosen)

Pros: Unit/integration/golden/security/chaos layered, comprehensive coverage.
Cons: High workload (~730 test cases + performance baselines).

## Consequences

- New `tests/unit/{module}/` directory structure.
- New `tests/integration/` integration test files.
- New `tests/golden/` golden path tests.
- New `tests/performance/` performance baseline tests.
- New `tests/security/` security regression tests.
- `npm test` must pass all as production readiness gate.

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-018 Rollout 11 State Machine](./018-rollout-eleven-state-machine.md)
- `doc/reviews/design_gap_analysis_v9.md` §7.1 G1 Solution

## Source Sections

- `§G1` Test Coverage Solution
- `§G3` E2E Test Design
- `§G4` Performance Baseline Testing
- `§6.1` Industrial-Grade Standards
