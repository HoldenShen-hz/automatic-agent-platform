# ADR-001 Three-Layer Separation of Powers Architecture

- Status: Partially Superseded by v4.3 Five-Plane Baseline
- Decision Date: 2026-04-02

## Background

In the early design, the CEO bore nearly all central responsibilities: receiving tasks, classification, routing, decomposition, orchestration, aggregation, and escalation judgment. This created a logical single point when concurrent tasks appeared, blurring responsibility boundaries, recovery boundaries, and cost boundaries.

## Decision

Adopt the Five-Plane Architecture (v4.3 canonical, replacing the old CEO/VP three-layer separation):

- **P1 Interface Plane**: User message ingress, message triage, entry normalization, NL parsing.
- **P2 Control Plane**: Policy judgment, routing decisions, risk assessment, governance constraint injection.
- **P3 Orchestration Plane**: Cross-domain decomposition, dependency graph construction, PlanGraphBundle generation, result aggregation.
- **P4 Execution Plane** (HarnessRuntime): The sole execution runtime, handling P3→P4 handoff.
- **P5 Evidence Plane**: State persistence, event recording, checkpoints, artifact storage.
- **X1 Extension Plane**: Perception intelligence, HR approval escalation (on-demand trigger).

Notes:
- If legacy narrative names like CEO/VP Operations/VP Orchestration must be retained in documentation, canonical plane IDs must also be provided. Code, directories, events, and contract layers all use canonical IDs as the standard.
- CEO is not a resident process but generated on-demand: triggered only in escalation events, perception intelligence, and HR approval scenarios. Context is preserved across escalations through persistent memory, while only one CEO session executes at a time. Other escalation events queue by priority.

## Role Boundaries (v4.3 Five-Plane Mapping)

Headquarters role division (mapped to P1/P2/P3):

- P1 Interface Plane handles only entry processing, not daily routing and routine orchestration.
- P2 Control Plane focuses on task triage and resource allocation, not complex cross-domain reasoning.
- P3 Orchestration Plane handles only cross-domain coordination and exception intervention, not domain internal details.
- X1 Perception module exists as a service module, does not participate in Agent lifecycle, but serves as external input source for CEO.

Domain role division:

- Each domain has at least one domain agent that handles local autonomous orchestration.
- Roles below domain agent only responsible for inputs/outputs within their own contracts, not directly bearing headquarters coordination responsibilities.

## Reasons for This Choice

- Removes CEO performance bottleneck from the main execution path.
- Completely separates "judgment" from "execution," reducing system incidental complexity.
- Allows each domain to evolve autonomously without disturbing headquarters.
- Provides clearer boundaries for recovery, audit, and cost statistics.

## Key Invariants

- CEO should not appear in normal happy path.
- VP Operations must be able to complete the vast majority of task intake without calling CEO.
- VP Orchestration intervenes only in cross-domain or exception scenarios.
- Lead Agent has autonomy over domain internal workflows but cannot override platform-level permissions and security boundaries.

## Implementation Impact

Requirements for storage and communication:

- Task board must be persistent.
- VP Operations and VP Orchestration must collaborate through reliable events and status tables.
- CEO queue must be recoverable to avoid losing escalation requests after crashes.

Requirements for cost and monitoring:

- Costs at headquarters layer and domain layer must be tracked separately.
- Independent observability of latency and failure patterns for CEO, VP Operations, VP Orchestration, and Lead Agent is needed.

## Results

Benefits:

- CEO exits the daily execution path, system throughput is more stable.
- Headquarters responsibilities are clearer, recovery and audit are easier to implement.
- Domains can evolve independently without returning to headquarters at every step.

Costs:

- A reliable state synchronization mechanism must be established between VP Operations and VP Orchestration.
- Task board, message bus, and escalation queue become new critical infrastructure.

## OAPEFLIR Role Clarification (§13/§45 reconciliation)

According to §13/§45, the OAPEFLIR eight-stage cognitive loop positioning in the platform is as follows:

### Official Position

- OAPEFLIR **is not** the active orchestration loop (that role is borne by HarnessRuntime)
- OAPEFLIR's positioning is **StageRationale (stage reasoning)** and **Audit View**
- OapeflirLoopService is used only for reasoning records and audit tracing during stage transitions, not involved in real-time execution scheduling

### Dual Chain Topology (revised)

```
Main Chain (real-time execution):
  Observe → Assess → Plan → Execute → Feedback
                                      ↓
Secondary Chain (async improvement):  Feedback → Learn → Improve → Rollout
```

- **Main Chain**: User request-driven real-time execution path, emphasizing low latency and determinism, driven by HarnessRuntime.
- **Secondary Chain**: Event-driven async improvement path, emphasizing learning and accumulation.
- The two chains are coupled through `Feedback→Learn`; the main chain does not wait for the secondary chain to complete.

### Three Cross-Cutting Concerns

| Concern | Covered Stages | Description |
|---------|---------------|-------------|
| **Knowledge Plane** | Observe/Assess/Plan | Knowledge retrieval supports contextual context at each stage |
| **Artifact Plane** | Plan/Execute | Execution artifacts (code/documents) storage and publication |
| **Memory Layer** | All 8 stages | L1-L6 memory supports context continuity |

### Stage to Five-Plane Architecture Mapping

| Five-Plane | Corresponding OAPEFLIR Components |
|-----------|----------------------------------|
| P1 Interface Plane | StageRationale entry, Audit View |
| P2 Control Plane | Policy judgment, risk assessment (Assess) |
| P3 Orchestration Plane | Plan DTO generation, GraphBundle |
| HarnessRuntime | Execute execution (OAPEFLIR not involved) |

### Key Architecture Constraints

- **R1-SCOPE**: Phase 1 limited to 4 new directories: agent-loop/planning/feedback/improvement (others M2 early implementation)
- **R2-WHITELIST**: Observe output limited to raw_signals/normalized_snapshot/refs/metrics only
- **R2-BLACKLIST**: Observe prohibits output of recommendedWorkflow/riskLevel/approvalRequired/modelClass/recommendedActions
- **R3-SINGLE**: Execute layer can only receive Plan DTO, no bypassing allowed
- **R4-TYPES**: Phase 1 only 3 learning types: failure_pattern/user_correction/recovery_playbook
- **R4-EVIDENCE**: Learning objects must have FeedbackSignal evidence links

## Cross-References

- [ADR-002 Division System](./002-division-system.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-079 Feedback Hub](./079-feedback-hub-signals.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)

## Source Sections

- `§2.1`
- `§2.2`
- `§2.2.1`
- `§4.1`
- `§OAPEFLIR` Eight-Stage Model (added 2026-04-17)