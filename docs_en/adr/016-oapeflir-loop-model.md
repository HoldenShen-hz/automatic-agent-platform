# ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

- Status: Accepted
- Decision Date: 2026-04-17

## Background

The system's early architecture was organized based on "Three-Layer Separation Architecture" (control / runtime / learning / data). As HarnessRuntime became the sole execution entry, the platform needed a controlled cognitive framework to explain and constrain the cognitive loop, rather than introducing a second execution runtime. OAPEFLIR (Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release) was therefore retained as the cognitive/governance semantic framework.

## Decision

### OAPEFLIR Eight-Stage Model

The system adopts an eight-stage cognitive loop, but it is not an independent execution engine:

```
Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release
   ↓                    ↓           ↓           ↓            ↓
   └────────────────────┴───────────┴───────────┴────────────┘
                    (Dual-chain topology: main chain O→A→P→E→F, secondary chain F→L→I→R)
```

Constraints:

- `HarnessRuntime` is the sole execution entry.
- OAPEFLIR only produces `oapeflir.view.*` and `oapeflir.rationale.*` projections, does not own run status, budget, lease, side effect commit, or error code namespaces.

### Each Stage Responsibilities

| Stage | Core Responsibility | Key Output |
|-------|---------------------|------------|
| **O**bserve | Collect task/context/system state | UnifiedObservation (TaskSituation + SystemSituation) |
| **A**ssess | Pre-execution risk/complexity/resource assessment | UnifiedAssessment (6-dimensional scoring) |
| **P**lan | Form plan rationale and constrain execution handoff | PlanRationale + `PlanGraphBundle` reference |
| **E**xecute | Read Harness execution results and generate cognitive view | `NodeAttemptReceipt` reference + ExecutionSummaryView |
| **F**eedback | Collect execution result feedback signals | LearningSignal[] |
| **L**earn | Extract patterns/knowledge from signals | LearningObject[] |
| **I**mprove | Evaluate improvement candidates + guardrail | ImprovementCandidate |
| **R**elease | Controlled release of improvements to production | ReleaseDecisionView / RolloutRecord |

### Mapping to Phase 1A/1B Execution Model

- `HarnessRuntime` undertakes the real `PlanGraphBundle -> NodeRun -> NodeAttemptReceipt` execution main chain.
- OAPEFLIR generates stage-wise view / rationale above the Harness main chain, and drives the Feedback→Learn→Improve→Release secondary chain.
- There is no longer a canonical narrative of `OapeflirLoopService` as an independent runtime entry.

### Execute Layer Integration Requirements

Execute stage can only consume `NodeAttemptReceipt` / evidence refs already produced by real runtime, must not self-drive a second execution engine. Any real state change is still handled by `RuntimeStateMachine.transition(command)` and Harness main chain.

## Alternative Solutions

### Solution A: Maintain Three-Layer Separation Architecture, Do Not Introduce OAPEFLIR

Advantages: Architecture simple, no need to refactor existing modules.
Costs: Cannot clearly express cognitive closed loop and progressive improvement path.

### Solution B: OAPEFLIR and Three-Layer Architecture Coexist

Advantages: Compatible with existing modules.
Costs: Two mental models cause confusion.

## Consequences

- OAPEFLIR is no longer the system's core orchestrator; `HarnessRuntime` remains the sole execution runtime.
- All new modules (Observe builders, Assess evaluators, Plan strategies, etc.) must be able to find their place within the eight-stage cognitive framework, but must not bypass Harness main chain.
- This ADR is the architectural foundation for all subsequent OAPEFLIR-related GAPs (V2-01 ~ V2-12).

## v4.3 ADR Remediation

- A-1: This ADR originally wrote OAPEFLIR as an independent execution orchestrator. The root cause was that the cognitive loop model simultaneously undertook runtime and interpretation layer responsibilities in early drafts. Fix: The text now explicitly states that `HarnessRuntime` is the sole execution entry, and OAPEFLIR is retained only as cognitive/governance semantic framework.
- A-10: This ADR originally continued `Oapeflir*` style DTO naming context. The root cause was that early documents directly named input/output objects by framework name. Fix: The text now converges stage objects to cognitive view objects like `PlanRationale`, `ExecutionSummaryView`, and aligns with `CognitiveFrameInput/CognitiveFrameOutput` system.
