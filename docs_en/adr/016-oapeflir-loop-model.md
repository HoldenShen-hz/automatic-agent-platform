# ADR-016 OAPEFLIR Eight-Phase Cognitive Loop Model

- Status: Accepted
- Decision Date: 2026-04-17

## Context

Early system architecture was organized based on "three-layer distributed architecture" (control/runtime/learning/data). During Phase 1 evolution, a clearer eight-phase cognitive loop model OAPEFLIR (Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Rollout) gradually formed. This ADR formally records this architectural decision.

## Decision

### OAPEFLIR Eight-Phase Model

System adopts eight-phase serial cognitive loop:

```
Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Rollout
   ↓                    ↓           ↓           ↓            ↓
   └────────────────────┴───────────┴───────────┴────────────┘
                    （Dual-chain topology: main chain O→A→P→E, secondary chain F→L→I→R）
```

### Each Phase Responsibilities

| Phase | Core Responsibility | Key Output |
|-------|---------------------|-------------|
| **O**bserve | Collect task/context/system state | UnifiedObservation (TaskSituation + SystemSituation) |
| **A**ssess | Pre-execution risk/complexity/resource assessment | UnifiedAssessment (six-dimensional scoring) |
| **P**lan | Generate execution plan based on assessment | Plan (steps + DAG + retryPolicy) |
| **E**xecute | Call runtime execution engine | DualChannelStepOutput + ExecutionOutcome |
| **F**eedback | Collect execution result feedback signals | LearningSignal[] |
| **L**earn | Extract patterns/knowledge from signals | LearningObject[] |
| **I**mprove | Evaluate improvement candidates + guardrail | ImprovementCandidate |
| **R**ollout | Controlled release of improvements to production | RolloutRecord |

### Mapping to Phase 1A/1B Execution Model

- **Phase 1A** (`phase1a-happy-path.ts`): Covers O→A→P→E single-step execution.
- **Phase 1B** (`phase1b-orchestration.ts`): Covers P→E multi-step DAG + context compaction + streaming.
- **OAPEFLIR Loop** (`OapeflirLoopService`): Complete eight-phase closed loop, including F→L→I→R secondary chain.

### Execute Layer Integration Requirements

Execute phase must call real runtime execution engine (AgentExecutor/CommandExecutor), must not use mock data. Specific integration implemented through `RuntimeExecuteBridge` interface.

## Alternatives

### Option A: Maintain Three-Layer Distributed Architecture, Don't Introduce OAPEFLIR

Benefits: Simple architecture, no need to refactor existing modules.
Costs: Cannot clearly express cognitive closed loop and progressive improvement path.

### Option B: OAPEFLIR and Three-Layer Architecture Coexist

Benefits: Compatible with existing modules.
Costs: Two mental models cause confusion.

## Consequences

- `OapeflirLoopService` is the system's core orchestrator.
- All new modules (Observe builders, Assess evaluators, Plan strategies, etc.) must be able to find their position in the eight phases.
- This ADR is the architectural foundation for all subsequent OAPEFLIR-related GAPs (V2-01 ~ V2-12).
