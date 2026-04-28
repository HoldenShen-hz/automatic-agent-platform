# ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

- Status: Accepted
- Decision Date: 2026-04-17

## Context

The system's early architecture was organized based on "three-layer separation of powers" (control / runtime / learning / data). As `HarnessRuntime` became the sole execution entry point, the platform needed a controlled cognitive framework to explain and constrain the cognitive loop, rather than introducing a second execution runtime. OAPEFLIR (Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release) was therefore retained as the cognitive/governance semantic framework.

## Decision

### OAPEFLIR Eight-Stage Model

The system adopts an eight-stage cognitive loop, but it is not an independent execution engine:

```
Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release
   ↓                    ↓           ↓           ↓            ↓
   └────────────────────┴───────────┴───────────┴────────────┘
                    (Dual-chain topology: main chain O→A→P→E→F, side chain F→L→I→R)
```

Constraints:

- `HarnessRuntime` is the sole execution entry point.
- OAPEFLIR only produces `oapeflir.view.*` and `oapeflir.rationale.*` projections and does not own run status, budget, lease, side effect commit, or error code namespaces.

### Stage Responsibilities

| Stage | Core Responsibility | Key Output |
|-------|---------------------|------------|
| **O**bserve | Collect task/context/system state | UnifiedObservation (TaskSituation + SystemSituation) |
| **A**ssess | Pre-execution risk/complexity/resource assessment | UnifiedAssessment (six-dimensional scoring) |
| **P**lan | Form plan rationale and constrain execution handoff | PlanRationale + `PlanGraphBundle` reference |
| **E**xecute | Read Harness execution results and generate cognitive view | `NodeAttemptReceipt` reference + ExecutionSummaryView |
| **F**eedback | Collect execution result feedback signals | LearningSignal[] |
| **L**earn | Extract patterns/knowledge from signals | LearningObject[] |
| **I**mprove | Evaluate improvement candidates + guardrail | ImprovementCandidate |
| **R**elease | Controlled release of improvements to production | ReleaseDecisionView / RolloutRecord |

### Mapping to Phase 1A/1B Execution Model

- `HarnessRuntime` undertakes the real `PlanGraphBundle -> NodeRun -> NodeAttemptReceipt` execution main chain.
- OAPEFLIR generates stage views/rationale above the Harness main chain and drives the Feedback→Learn→Improve→Release side chain.
- The canonical narrative of `OapeflirLoopService` as an independent runtime entry point no longer exists.

### Execute Layer Integration Requirements

The Execute stage can only consume `NodeAttemptReceipt` / evidence refs produced by the real runtime and must not drive a second execution engine on its own. Any real state changes remain the responsibility of `RuntimeStateMachine.transition(command)` and the Harness main chain.

## Alternatives

### Option A: Maintain Three-Layer Separation of Powers Without Introducing OAPEFLIR

Pros: Simple architecture, no need to refactor existing modules.
Costs: Cannot clearly express cognitive closure and progressive improvement paths.

### Option B: OAPEFLIR and Three-Layer Architecture Coexist

Pros: Compatible with existing modules.
Costs: Two mental models cause confusion.

## Consequences

- OAPEFLIR is no longer the system's core orchestrator; `HarnessRuntime` remains the sole execution runtime.
- All new modules (Observe builders, Assess evaluators, Plan strategies, etc.) must be able to find their position within the eight-stage cognitive framework but must not bypass the Harness main chain.
- This ADR is the architectural foundation for all subsequent OAPEFLIR-related GAPs (V2-01 ~ V2-12).

## v4.3 ADR Remediation

- A-1: This ADR originally described OAPEFLIR as an independent execution orchestrator; root cause was that the cognitive loop model simultaneously bore runtime and interpretation layer responsibilities in early drafts. Fix: The body now explicitly states that `HarnessRuntime` is the sole execution entry point and OAPEFLIR is retained only as a cognitive/governance semantic framework.
- A-10: This ADR originally continued the `Oapeflir*` style DTO naming context; root cause was early documents directly naming input/output objects after the framework. Fix: The body now converges stage objects to cognitive view objects like `PlanRationale`, `ExecutionSummaryView` and aligns with the `CognitiveFrameInput/CognitiveFrameOutput` system.
