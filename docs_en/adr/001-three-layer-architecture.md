# ADR-001 Three-Layer Separation of Authority Architecture

- Status: Accepted
- Decision Date: 2026-04-02

## Context

In early design thinking, the CEO bore almost all central responsibilities: receiving tasks, triage, routing, decomposition, orchestration, aggregation, and escalation judgment. This created a logical single point in concurrent task scenarios, blurring responsibility boundaries, recovery boundaries, and cost boundaries.

## Decision

Adopt the Five-Plane Architecture (v4.3 canonical, replacing the old CEO/VP three-layer separation):

- **P1 Interface Plane**: User message ingress, message triage, entry normalization, NL parsing.
- **P2 Control Plane**: Policy judgment, routing decisions, risk assessment, governance constraint injection.
- **P3 Orchestration Plane**: Cross-domain decomposition, dependency graph construction, PlanGraphBundle generation, result aggregation.
- **P4 Execution Plane** (HarnessRuntime): Sole execution runtime, handling P3→P4 handoff.
- **P5 Evidence Plane**: State persistence, event recording, checkpoints, artifact storage.
- **X1 Extension Plane**: Perception intelligence, HR approval escalation (triggered on demand).

Note:
- If legacy narrative names such as CEO / VP Operations / VP Orchestration must be retained in documentation, the canonical plane ID must be provided simultaneously; code, directories, events, and contract layers all use the canonical ID as the standard.
- The CEO is not a standing process but is generated on demand: triggered only in escalation events, perception intelligence, and HR approval scenarios; retains context across escalations via persistent memory; only one CEO session executes at a time, and other escalation events are queued by priority.

Note:

- If legacy narrative names such as CEO / VP Operations / VP Orchestration must be retained, the canonical ID must be provided simultaneously; code, directories, events, and contract layers all use the canonical ID as the standard.

The CEO is not a standing process but is generated on demand:

- Triggered only in escalation events, perception intelligence, and HR approval scenarios.
- Retains context across escalations via persistent memory.
- Only one CEO session executes at a time, and other escalation events are queued by priority.

## Role Boundaries (v4.3 Five-Plane Mapping)

Headquarters role division (mapped to P1/P2/P3):

- P1 Interface Plane handles entry processing only, and does not participate in routine routing or regular orchestration.
- P2 Control Plane focuses on task triage and resource allocation, and does not perform complex cross-domain reasoning.
- P3 Orchestration Plane handles cross-domain coordination and exception intervention only, and does not take over intra-domain details.
- X1 Perception module exists as a service module and does not participate in the Agent lifecycle, but serves as an external input source for the CEO.

Domain role division:

- Each domain has at least one domain agent undertaking local autonomous orchestration.
- Roles below the domain agent are only responsible for inputs/outputs within their respective contracts, and do not directly undertake headquarters coordination responsibilities.

## Reasons for Selecting This Approach

- Removes the CEO performance bottleneck from the main execution path.
- Completely separates "judgment" from "execution," reducing system incidental complexity.
- Allows business divisions to evolve autonomously without disturbing headquarters.
- Provides clearer boundaries for recovery, audit, and cost statistics.

## Key Invariants

- The CEO should not appear in the normal happy path.
- VP Operations must be able to complete the vast majority of task intake without invoking the CEO.
- VP Orchestration intervenes only in cross-division or exception scenarios.
- Lead Agent has autonomy over intra-division workflows but cannot override platform-level permissions and security boundaries.

## Implementation Impact

Storage and communication requirements:

- Task kanban must be persistent.
- VP Operations and VP Orchestration must collaborate via reliable events and state tables.
- CEO queue must be recoverable to avoid losing escalation requests after crashes.

Cost and monitoring requirements:

- Costs at the headquarters layer and business division layer must be tracked separately.
- Independent observability of latency and failure patterns for CEO, VP Operations, VP Orchestration, and Lead Agent is required.

## Consequences

Benefits:

- CEO exits the daily execution path, making system throughput more stable.
- Headquarters responsibilities are clearer, making recovery and audit easier to achieve.
- Business divisions can evolve independently without returning to headquarters at every step.

Costs:

- A reliable state synchronization mechanism must be established between VP Operations and VP Orchestration.
- Task kanban, message bus, and escalation queue become new critical infrastructure.

## OAPEFLIR Role Clarification (§13/§45 reconciliation)

According to §13/§45, the OAPEFLIR eight-stage cognitive loop's positioning in the platform is as follows:

### Official Position

- OAPEFLIR **is not** an active orchestration loop (that role is undertaken by HarnessRuntime)
- OAPEFLIR's positioning is **StageRationale (phase reasoning)** and **Audit View**
- OapeflirLoopService is used only for reasoning records and audit traceability during phase transitions, and does not participate in real-time execution scheduling

### Dual-Chain Topology (revised)

```
Main Chain (real-time execution):
  Observe → Assess → Plan → Execute → Feedback
                                      ↓
Secondary Chain (async improvement):  Feedback → Learn → Improve → Rollout
```

- **Main Chain**: User request-driven real-time execution path, emphasizing low latency and determinism, driven by HarnessRuntime.
- **Secondary Chain**: Event-driven async improvement path, emphasizing learning and accumulation.
- The two chains are coupled via `Feedback→Learn`; the main chain does not wait for the secondary chain to complete.

### Three Horizontal Cross-Cutting Concerns

| Cross-Cutting Concern | Covered Phases | Description |
|--------|---------|------|
| **Knowledge Plane** | Observe/Assess/Plan | Knowledge retrieval supports phase context |
| **Artifact Plane** | Plan/Execute | Execution artifacts (code/documents) storage and publishing |
| **Memory Layer** | All 8 phases | L1-L6 memory supports context continuity |

### Phase-to-Five-Plane Architecture Mapping

| Five Planes | Corresponding OAPEFLIR Components |
|--------|-------------------|
| P1 Interface Plane | StageRationale entry, Audit View |
| P2 Control Plane | Policy judgment, risk assessment (Assess) |
| P3 Orchestration Plane | Plan DTO generation, GraphBundle |
| HarnessRuntime | Execute execution (OAPEFLIR does not participate) |

### Key Architecture Constraints

- **R1-SCOPE**: Phase 1 limited to 4 new directories: agent-loop/planning/feedback/improvement (other M2 implemented early)
- **R2-WHITELIST**: Observe output limited to raw_signals/normalized_snapshot/refs/metrics
- **R2-BLACKLIST**: Observe prohibited from outputting recommendedWorkflow/riskLevel/approvalRequired/modelClass/recommendedActions
- **R3-SINGLE**: Execute layer can only receive Plan DTO and must not bypass it
- **R4-TYPES**: Phase 1 only 3 types of learning: failure_pattern/user_correction/recovery_playbook
- **R4-EVIDENCE**: Learning targets must have FeedbackSignal evidence links

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
- `§OAPEFLIR` eight-stage model (added 2026-04-17)

## v4.3 ADR Remediation

- R5-63: This ADR originally referenced old section numbers (such as `§2.3`/`§4.5`/`§10.1` etc.), which have now been updated to the correct section mappings in the architecture document.
