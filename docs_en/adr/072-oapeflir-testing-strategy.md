# ADR-072 OAPEFLIR Testing Strategy and New Module Testing Matrix

- Status: Partially Superseded by current layered test matrix and runtime contract tests
- Decision Date: 2026-04-17
- Related: ADR-016 OAPEFLIR Eight-Phase Cognitive Loop Model

## Background

The OAPEFLIR eight-phase architecture added 7 core modules (agent-loop/planning/feedback/learning/improvement/knowledge/domain-registry), totaling approximately 130 files and 15,774 lines of code. These modules are currently marked as Unverified and require a complete testing strategy to ensure production readiness.

## Decision

### 1. Test Layering Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Golden / E2E Tests                        │
│   (tests/golden/oapeflir-happy-path.test.ts etc.)           │
├─────────────────────────────────────────────────────────────┤
│                   Integration Tests                          │
│   (tests/integration/oapeflir-loop-integration.test.ts etc) │
├─────────────────────────────────────────────────────────────┤
│                    Unit Tests                                │
│   (tests/unit/{module}/*.test.ts)                           │
├─────────────────────────────────────────────────────────────┤
│               Security / Chaos / Performance                │
│   (tests/security/, tests/chaos/, tests/performance/)       │
└─────────────────────────────────────────────────────────────┘
```

### 2. New Module Testing Matrix

| Module | Unit Tests | Integration Tests | Golden | Security | Estimated Cases |
|--------|-----------|-----------------|--------|----------|-----------------|
| `agent-loop/` | run() loop integrity, assess, handoff | 8-phase integration | O→A→P→E→F happy path | handoff info leakage | ~120 |
| `planning/` | plan-builder, DAG validator, replanning, strategy selector | plan→execute integration | linear plan happy path | — | ~80 |
| `feedback/` | signal-preprocessor (dedup/correlation/filter), collector, event-consumer | feedback→learning propagation | — | — | ~60 |
| `learning/` | 4 detectors, learning-object-validator, experience-distillation | learn→improve propagation | failure pattern golden | — | ~80 |
| `improvement/` | rollout-state-machine, rollout-scheduler, auto-rollback, guardrail | rollout complete flow | canary→stable golden | autonomy boundary | ~100 |
| `knowledge/` | knowledge-plane-service, retrieval, vector-store, ingestion-pipeline | ingestion→retrieval E2E | retrieval accuracy golden | source pollution | ~150 |
| `domain-registry/` | plugin-spi-registry, plugin-runtime-host, domain-registry-service | plugin loading→execution | — | config injection | ~100 |
| `plugins/` | github-adapter, basic-planner, coding-retriever | plugin registration→invocation | — | — | ~40 |
| **Total** | | | | | **~730** |

### 3. E2E Test Design (5 Core Tests)

#### Test 1: Happy Path
```
Input: "modify foo.ts bar function"
Verify: O→A→P→E→F→L→I(shadow) full chain
Verify: Each phase DTO passes Zod validation
Verify: `oapeflir.view.*` phase views are continuous, and do not replace runtime truth
Verify: <60s E2E latency
```

#### Test 2: Execution Failure Triggers Learn
```
Input: Invalid file path (will fail)
Verify: Execute failure → Feedback → Learn produces FailurePattern
Verify: FailurePattern has evidence links
```

#### Test 3: Replan Triggered
```
Input: tool_failure mid-execution
Verify: ReplanningService generates version N+1
Verify: New `GraphPatch` continues from failed `NodeRun`
```

#### Test 4: Canary Upgrade Flow
```
Input: Existing LearningObject → ImprovementCandidate
Verify: shadow → canary_5 → partial_25 → stable complete flow
Verify: Auto-rollback when metrics do not meet targets
```

#### Test 5: Multi-Agent Handoff
```
Input: Task requiring 2 Agent collaboration
Verify: HandoffBuilder serialization/deserialization round-trip
Verify: Token budget < 1000
Verify: FactLayer has no sensitive info leakage
```

### 4. Performance Baseline Targets

## v4.3 ADR Remediation

- A-66: This ADR originally described OAPEFLIR testing as "no phase is skipped" executable main chain, and used "continue after failed step" to describe replan. The root cause was that the testing strategy ADR mixed cognitive phase views with runtime execution graphs. Fix: The main text now limits OAPEFLIR to view continuity verification, and anchors recovery/replanning to `GraphPatch / NodeRun`.

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

| Test Type | Coverage |
|-----------|----------|
| Handoff info leakage | FactLayer does not leak sensitive data |
| Autonomy boundary | Unauthorized operations blocked by guardrail |
| Domain config injection | Malicious config rejected by PluginConfigValidator |
| Source pollution | Knowledge ingestion does not introduce pollution |
| Tool call injection | CommandExecutor prevents shell injection |

### 6. Chaos Testing (Stable Release Gate)

| Scenario | Failure Injection | Expected Recovery |
|----------|------------------|-------------------|
| Agent node crash | kill -9 simulates node failure | Lease reassigned, task migrated |
| Database connection lost | network partition | Event persisted, local buffer |
| Replanning storm | 10 consecutive tool_failures | Backoff strategy triggered, task terminated |
| Memory overflow | Allocation exceeded | OOM caught, resources released |

## Alternatives

### Option A: Unit Tests Only

Pros: Fast coverage of core logic.
Cons: No E2E verification, cannot detect inter-phase integration issues.

### Option B: Complete Testing Pyramid (Selected)

Pros: Unit/integration/golden/security/chaos layered, comprehensive coverage.
Cons: High effort (~730 test cases + performance baselines).

## Consequences

- New `tests/unit/{module}/` directory structure.
- New `tests/integration/` integration test files.
- New `tests/golden/` golden path tests.
- New `tests/performance/` performance baseline tests.
- New `tests/security/` security regression tests.
- `npm test` must pass all as production readiness gate.

## Cross References

- [ADR-016 OAPEFLIR Eight-Phase Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-075 Six-Level Controlled Release and Rollout State Machine](./075-controlled-rollout-release.md) (ADR-018 only for historical reference)
- `docs_zh/reviews/architecture-design-vs-implementation-review.md` §G1 Solution (original design_gap_analysis_v9.md archived)

## Source Sections

- `§G1` Test Coverage Solution
- `§G3` E2E Test Design
- `§G4` Performance Baseline Testing
- `§6.1` Industrial-Grade Standards