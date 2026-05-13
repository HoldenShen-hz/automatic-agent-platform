# ADR-001 Three-Layer Separation of Powers Architecture

- Status: Accepted
- Decision Date: 2026-04-02

## Background

In early thinking, the CEO bore almost all central responsibilities: receiving tasks, triage, routing, decomposition, orchestration, aggregation, and escalation judgment. This created a logical single point when concurrent tasks appeared, blurring responsibility boundaries, recovery boundaries, and cost boundaries.

## Decision

Adopt the five-plane architecture (v4.3 canonical, replacing old CEO/VP three-layer separation):

- **P1 Interface Plane**: User message ingress, message triage, entry normalization, NL parsing.
- **P2 Control Plane**: Policy judgment, routing decisions, risk assessment, governance constraint injection.
- **P3 Orchestration Plane**: Cross-domain decomposition, dependency graph construction, PlanGraphBundle generation, result aggregation.
- **P4 Execution Plane** (HarnessRuntime): Sole execution runtime, handling P3-to-P4 handoff.
- **P5 Evidence Plane**: State persistence, event recording, checkpoints, artifact storage.
- **X1 Expansion Plane**: Perception intelligence, HR approval escalation (triggered as needed).

Notes:
- Documents may retain old narrative names like CEO, VP Operations, or VP Orchestration only if they also provide the canonical plane ID; code, directories, events, and contract layers all use the canonical ID as the standard.
- The CEO is not a resident process but is generated on demand: triggered only in escalation events, perception intelligence, and HR approval scenarios; retains context across escalations via persistent memory; only one CEO session executes at a time, and other escalation events are queued by priority.

## Role Boundaries (v4.3 Five-Plane Mapping)

Headquarters role division (mapped to P1/P2/P3):

- P1 Interface Plane only handles entry processing, not involved in daily routing and routine orchestration.
- P2 Control Plane focuses on task triage and resource allocation, not complex cross-domain reasoning.
- P3 Orchestration Plane only handles cross-domain coordination and exception intervention, not domain internal details.
- X1 Perception module exists as a service module, not involved in Agent lifecycle, but serves as external input source for CEO.

Domain role division:

- Each domain has at least one domain agent undertaking local autonomous orchestration.
- Roles below domain agent only handle inputs and outputs within their respective contracts, not directly undertaking headquarters coordination responsibilities.

## Reasons for Selecting This Approach

- Removes CEO performance bottleneck from the main execution path.
- Completely separates judgment from execution, reducing system incidental complexity.
- Allows business units to evolve autonomously without disturbing headquarters.
- Provides clearer boundaries for recovery, audit, and cost statistics.

## Key Invariants

- CEO should not appear in normal happy path.
- VP Operations must be able to complete the vast majority of task intake without invoking CEO.
- VP Orchestration intervenes only in cross-division or exception scenarios.
- Lead Agent has autonomy over intra-division workflows but cannot override platform-level permissions and security boundaries.

## Implementation Impact

Requirements for storage and communication:

- Task kanban must be persistent.
- VP Operations and VP Orchestration must collaborate via reliable events and state tables.
- CEO queue must be recoverable to avoid losing escalation requests after crashes.

Requirements for cost and monitoring:

- Costs at headquarters layer and division layer must be tracked separately.
- Independent observability of latency and failure patterns for CEO, VP Operations, VP Orchestration, and Lead Agent is required.

## Results

Benefits:

- CEO exits the daily execution path, making system throughput more stable.
- Headquarters responsibilities are clearer, making recovery and audit easier to achieve.
- Business units can evolve independently without returning to headquarters at every step.

Costs:

- Reliable state synchronization mechanism must be established between VP Operations and VP Orchestration.
- Task kanban, message bus, and escalation queue become new critical infrastructure.

## OAPEFLIR Role Clarification (Section 13/45 reconciliation)

According to Section 13/45, the positioning of the OAPEFLIR eight-stage cognitive loop in the platform is as follows:

### Official Position

- OAPEFLIR is not an active orchestration loop (that role is undertaken by HarnessRuntime).
- OAPEFLIR's positioning is StageRationale (phase reasoning) and Audit View.
- OapeflirLoopService is used only for reasoning records and audit traceability during phase transitions, not participating in real-time execution scheduling.

### Dual-Chain Topology (Revised)

```
Main Chain (real-time execution):
  Observe -> Assess -> Plan -> Execute -> Feedback
                                      |
Side Chain (async improvement):        Feedback -> Learn -> Improve -> Rollout
```

- **Main Chain**: User request-driven real-time execution path, emphasizing low latency and determinism, driven by HarnessRuntime.
- **Side Chain**: Event-driven asynchronous improvement path, emphasizing learning and accumulation.
- The two paths couple through Feedback-Learn; the main chain does not wait for side chain completion.

### Three Cross-Cutting Concerns

| Cross-Cutting Concern | Covered Phases | Description |
|--------|---------|------|
| **Knowledge Plane** | Observe/Assess/Plan | Knowledge retrieval supports stage contexts |
| **Artifact Plane** | Plan/Execute | Execution artifacts (code/documents) storage and release |
| **Memory Layer** | All 8 stages | L1-L6 memory supports context continuity |

### Stage to Five-Plane Architecture Mapping

| Five-Plane | Corresponding OAPEFLIR Component |
|--------|-------------------|
| P1 Interface Plane | StageRationale entry, Audit View |
| P2 Control Plane | Policy judgment, risk assessment (Assess) |
| P3 Orchestration Plane | Plan DTO generation, GraphBundle |
| HarnessRuntime | Execute execution (OAPEFLIR not involved) |

### Key Architecture Constraints

- **R1-SCOPE**: Phase 1 limited to 4 new directories: agent-loop/planning/feedback/improvement (others M2 early implementation).
- **R2-WHITELIST**: Observe output limited to raw_signals/normalized_snapshot/refs/metrics.
- **R2-BLACKLIST**: Observe prohibited from outputting recommendedWorkflow/riskLevel/approvalRequired/modelClass/recommendedActions.
- **R3-SINGLE**: Execute layer can only receive Plan DTO, cannot bypass.
- **R4-TYPES**: Phase 1 limited to 3 learning types: failure_pattern/user_correction/recovery_playbook.
- **R4-EVIDENCE**: Learning objects must have FeedbackSignal evidence links.

## Cross-References

- [ADR-002 Division System](./002-division-system.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-016 OAPEFLIR Eight-Stage Cognitive Loop Model](./016-oapeflir-loop-model.md)
- [ADR-079 Feedback Hub](./079-feedback-hub-signals.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)

## Source Sections

- Section 2.1
- Section 2.2
- Section 2.2.1
- Section 4.1
- Section OAPEFLIR Eight-Stage Model (added 2026-04-17)
