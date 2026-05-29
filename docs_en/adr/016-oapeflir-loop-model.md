# ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model

- Status: Accepted
- Decision Date: 2026-04-17

## Background

Early system architecture was organized based on "three-layer separation architecture" (control/runtime/learning/data). As HarnessRuntime became the sole execution entry, the platform needed a controlled cognitive framework to explain and constrain the cognitive loop, rather than introducing a second execution runtime. OAPEFLIR (Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release) was therefore retained as the cognitive/governance semantic framework.

Associated contract: `docs_zh/contracts/oapeflir_loop_contract.md`

## Decision

### OAPEFLIR Eight-Stage Model

The system adopts an eight-stage cognitive loop. It is the active orchestration/governance control loop in the platform, but not a second independent execution engine:

```
Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release
   ↓                    ↓           ↓           ↓            ↓
   └────────────────────┴───────────┴───────────┴────────────┘
                    (Dual-chain topology: Main chain O→A→P→E→F, Secondary chain F→L→I→R)
```

Constraints:

- `HarnessRuntime` is the sole execution entry.
- `OapeflirLoopService` can actively drive stage progression of Observe/Assess/Plan/Feedback/Learn/Improve/Release, and write results back to execution constraints, planning graphs, and improvement candidates.
- OAPEFLIR only produces `oapeflir.view.*` and `oapeflir.rationale.*` projections, does not own run status, budget, lease, side effect commit, or error code namespaces.

### Stage Responsibilities

| Stage | Core Responsibility | Key Output |
|-------|---------------------|------------|
| **O**bserve | Collect task/context/system state | UnifiedObservation (TaskSituation + SystemSituation) |
| **A**ssess | Pre-execution risk/complexity/resource evaluation | UnifiedAssessment (six-dimensional scoring) |
| **P**lan | Form reasoning and constrain execution handoff | PlanRationale + `PlanGraphBundle` reference |
| **E**xecute | Read Harness execution results and generate cognitive view | `NodeAttemptReceipt` reference + ExecutionSummaryView |
| **F**eedback | Collect execution result feedback signals | LearningSignal[] |
| **L**earn | Extract patterns/knowledge from signals | LearningObject[] |
| **I**mprove | Evaluate improvement candidates + guardrail | ImprovementCandidate |
| **R**elease | Controlled release of improvements to production | ReleaseDecisionView / RolloutRecord |

### Mapping with Phase 1A/1B Execution Model

- `HarnessRuntime` undertakes the real `PlanGraphBundle -> NodeRun -> NodeAttemptReceipt` execution main chain.
- OAPEFLIR generates stage views/rationale above the Harness main chain, while actively deciding when to enter Assess/Plan, whether orchestration is required, and how to write release/guardrail conclusions back to the Control Plane.
- Therefore OAPEFLIR is the active orchestration loop, but delegates real command execution to HarnessRuntime, not bringing its own second executor.
- The canonical narrative of `OapeflirLoopService` as an independent runtime entry no longer exists.

### Execute Layer Integration Requirements

Execute stage can only consume real runtime-produced `NodeAttemptReceipt`/evidence refs, must not drive a second execution engine on its own. Any real state changes remain the responsibility of `RuntimeStateMachine.transition(command)` and the Harness main chain.

## Alternative Options

### Option A: Maintain Three-Layer Separation Architecture, Don't Introduce OAPEFLIR

Benefits: Simple architecture, no need to refactor existing modules.
Costs: Cannot clearly express cognitive closed loop and progressive improvement path.

### Option B: OAPEFLIR Coexists with Three-Layer Architecture

Benefits: Compatible with existing modules.
Costs: Two mental models cause confusion.

## Consequences

- OAPEFLIR is the system's cognitive and governance orchestration loop; `HarnessRuntime` remains the sole execution runtime.
- All new modules (Observe builders, Assess evaluators, Plan strategies, etc.) must be able to find their place in the eight-stage cognitive framework, but must not bypass the Harness main chain.
- This ADR is the architectural foundation for all subsequent OAPEFLIR-related GAPs (V2-01 ~ V2-12).

## v4.3 ADR Remediation

- A-1: This ADR originally wrote OAPEFLIR as an independent execution orchestrator. Root cause was that the cognitive loop model in early drafts simultaneously assumed runtime and interpretation layer responsibilities. Fix: Body now clarifies `HarnessRuntime` is the sole execution entry, OAPEFLIR retained only as cognitive/governance semantic framework.
- A-10: This ADR originally continued `Oapeflir*` style DTO naming context. Root cause was early documents directly named input/output objects by framework name. Fix: Body now converges stage objects to `PlanRationale`, `ExecutionSummaryView` and other cognitive view objects, aligned with `CognitiveFrameInput/CognitiveFrameOutput` system.