# ADR-072 OAPEFLIR Testing Strategy and New Module Test Matrix

- Status: Partially Superseded by current layered test matrix and runtime contract tests
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

## Background

The OAPEFLIR eight-stage architecture adds 7 core modules (agent-loop/planning/feedback/learning/improvement/knowledge/domain-registry), totaling about 130 files 15,774 lines of code. These modules are currently marked as Unverified, needing to establish a complete testing strategy to ensure production readiness.

## Decision

### 1. Test Layering Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Golden / E2E Tests                        │
│   (tests/golden/oapeflir-happy-path.test.ts etc)            │
├─────────────────────────────────────────────────────────────┤
│                   Integration Tests                          │
│   (tests/integration/oapeflir-loop-integration.test.ts etc)│
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
|--------|-----------|------------------|--------|----------|-----------------|
| `agent-loop/` | run() loop integrity, assess, handoff | 8-stage integration | O→A→P→E→F happy path | handoff info leakage | ~120 |
| `planning/` | plan-builder, DAG validator, replanning, strategy selector | plan→execute integration | linear plan happy path | — | ~80 |
| `feedback/` | signal-preprocessor (dedup/correlation/filter), collector, event-consumer | feedback→learning delivery | — | — | ~60 |
| `learning/` | 4 detectors, learning-object-validator, experience-distillation | learn→improve delivery | failure pattern golden | — | ~80 |
| `improvement/` | rollout-state-machine, rollout-scheduler, auto-rollback, guardrail | rollout complete flow | canary→stable golden | autonomy boundary | ~100 |
| `knowledge/` | knowledge-plane-service, retrieval, vector-store, ingestion-pipeline | Ingestion→retrieval E2E | retrieval accuracy golden | source pollution | ~150 |
| `domain-registry/` | plugin-spi-registry, plugin-runtime-host, domain-registry-service | plugin load→execute | — | config injection | ~100 |
| `plugins/` | github-adapter, basic-planner, coding-retriever | plugin register→call | — | — | ~40 |
| **Total** | | | | | **~730** |

### 3. E2E Test Design (5 Core Tests)

#### Test 1: Happy Path
```
Input: "modify foo.ts bar function"
Verify: O→A→P→E→F→L→I(shadow) full链路
Verify: Each stage DTO passes Zod validation
Verify: `oapeflir.view.*` stage views are continuous, do not replace runtime truth
Verify: <60s E2E latency
```

#### Test 2: Execution Failure Triggers Learn
```
Input: Invalid file path (will definitely fail)
Verify: Execute failure → Feedback → Learn produces FailurePattern
Verify: FailurePattern has evidence links
```

#### Test 3: Replan Trigger
```
Input: Tool_failure mid-execution
Verify: ReplanningService generates version N+1
Verify: New `GraphPatch` continues after failed `NodeRun`
```

#### Test 4: Canary Upgrade Flow
```
Input: Existing LearningObject → ImprovementCandidate
Verify: shadow → canary_5 → partial_25 → stable complete flow
Verify: Auto-rollback when metrics not met
```

#### Test 5: Multi-Agent Handoff
```
Input: Task requiring 2 Agents collaboration
Verify: HandoffBuilder serialization/deserialization roundtrip
Verify: Token budget < 1000
Verify: FactLayer no sensitive info leakage
```

### 4. Performance Benchmark Targets

## v4.3 ADR Remediation

- A-66: This ADR originally described OAPEFLIR testing as "no stage is skipped" executable main chain, and used "continue after failed step" to express replan, root cause being test strategy ADR mixed cognitive stage views with runtime execution graph. Fix: Body now limits OAPEFLIR to view continuity verification, cuts recovery/replan anchor to `GraphPatch / NodeRun`.

| Module | Operation | P99 Target | Test File |
|--------|-----------|------------|-----------|
| Feedback | signal-preprocessor.preprocess() | <10ms | tests/performance/feedback-perf.test.ts |
| Knowledge | knowledge-query-service.query() (Quick) | <100ms | tests/performance/knowledge-perf.test.ts |
| Knowledge | knowledge-retrieval.retrieve() (Standard) | <500ms | tests/performance/knowledge-perf.test.ts |
| Planning | plan-builder.build() | <50ms | tests/performance/planning-perf.test.ts |
| OAPEFLIR | Complete loop O→A→P→E→F | <30s | tests/performance/oapeflir-perf.test.ts |
| Handoff | handoff-serializer.serialize() | <5ms | tests/performance/handoff-perf.test.ts |
| Plugin | plugin-spi-registry.invoke() | <200ms | tests/performance/plugin-perf.test.ts |

### 5. Security Test Coverage

| Test Type | Coverage Content |
|-----------|-----------------|
| Handoff info leakage | FactLayer does not leak sensitive data |
| Autonomy boundary | Unauthorized operations intercepted by guardrail |
| Domain config injection | Malicious config rejected by PluginConfigValidator |
| Source pollution | Knowledge ingestion does not introduce pollution |
| Tool call injection | CommandExecutor blocks shell injection |

### 6. Chaos Testing (Stable Release Gate)

| Scenario | Inject Fault | Expected Recovery |
|----------|-------------|------------------|
| Agent node down | kill -9 simulate node failure | Lease reassignment, task migration |
| Database connection down | network partition | Event persistence, local buffer |
| Replan storm | 10 consecutive tool_failures | Backoff strategy triggered, task termination |
| OOM | Allocation exceeded limit | OOM captured, resources released |

## Alternative Solutions

### Option A: Unit Tests Only

Advantages: Quick coverage of core logic.
Trade-offs: No E2E verification, cannot discover inter-stage integration issues.

### Option B: Complete Test Pyramid (selected)

Advantages: Unit/integration/golden/security/chaos layered, comprehensive coverage.
Trade-offs: High workload (~730 test cases + performance benchmarks).

## Consequences

- New `tests/unit/{module}/` directory structure.
- New `tests/integration/` integration test files.
- New `tests/golden/` Golden path tests.
- New `tests/performance/` performance benchmark tests.
- New `tests/security/` security regression tests.
- `npm test` must fully pass as production readiness gate.

## Cross References

- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-075 Six-level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md) (ADR-018 only for historical reference)
- `docs_zh/reviews/architecture-design-vs-implementation-review.md` §G1 Solution (original design_gap_analysis_v9.md archived)

## Source Section

- `§G1` Test Coverage Solution
- `§G3` E2E Test Design
- `§G4` Performance Benchmark Tests
- `§6.1` Industrial-grade Standards