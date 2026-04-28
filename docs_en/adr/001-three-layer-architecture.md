# ADR-001 Three-Layer Decentralized Architecture

- Status: Accepted
- Decision Date: 2026-04-02

## Context

In the early design, the CEO bore nearly all central responsibilities: receiving tasks, classifying them, routing, splitting, orchestrating, aggregating, and judging escalations. This created a logical single point when concurrent tasks appeared, blurring responsibility boundaries, recovery boundaries, and cost boundaries.

## Decision

Adopt a three-level separation of authority:

- `strategic_governor` (business alias: CEO): only responsible for strategic judgment, HITL escalation, perceptual intelligence assessment, organizational approval, and anomaly intervention.
- `operations_supervisor` (business alias: VP Operations): responsible for user message intake, message triage, task classification, division routing, resource budget allocation, and state persistence.
- `execution_orchestrator` (business alias: VP Orchestration): responsible for cross-division splitting, dependency graph construction, schema compatibility pre-check, result aggregation, failure escalation, cost circuit-breaking response, and stuck Agent intervention.
- `division_lead` (business alias: Lead Agent): autonomously orchestrates workflow within a division, controlling role execution order and local self-healing.

Note:

- Where CEO / VP Operations / VP Orchestration narrative names must be preserved in documentation, the canonical ID must also be provided; code, directories, events, and contract layers must all use the canonical ID.

The CEO is not a resident process but is generated on demand:

- Triggered only in escalation events, perceptual intelligence, and HR approval scenarios.
- Context is preserved across escalations via persistent memory.
- Only one CEO session may execute at a time; other escalation events queue by priority.

## Role Boundaries

Headquarters role division:

- CEO only judges; does not participate in daily routing or routine orchestration.
- VP Operations focuses on task intake and resource allocation; does not do complex cross-division reasoning.
- VP Orchestration only handles cross-division coordination and anomaly intervention; does not manage division-internal details.
- The perception module exists as a service module, not participating in Agent lifecycle, but serves as an external input source to the CEO.

Division role division:

- Each division has at least one Lead Agent handling local autonomous orchestration.
- Roles below Lead Agent only handle input/output within their own contracts, not directly bearing headquarters coordination responsibilities.

## Reasons for This Approach

- Removes the CEO's performance bottleneck from the main execution path.
- Completely separates "judgment" from "execution," reducing system occasional complexity.
- Allows divisions to evolve autonomously without disturbing headquarters.
- Provides clearer boundaries for recovery, auditing, and cost accounting.

## Key Invariants

- CEO should not appear in normal happy path.
- VP Operations must be able to complete the vast majority of task intake without calling the CEO.
- VP Orchestration only intervenes in cross-division or anomaly scenarios.
- Lead Agent has autonomous authority over division-internal workflows but cannot override platform-level permissions and security boundaries.

## Implementation Impact

Storage and communication requirements:

- Task board must be persistent.
- VP Operations and VP Orchestration must collaborate via reliable events and state tables.
- CEO queue must be recoverable to avoid losing escalation requests after crashes.

Cost and monitoring requirements:

- Headquarters and division layer costs must be tracked separately.
- Independent observability of CEO, VP Operations, VP Orchestration, and Lead Agent latency and failure modes is required.

## Consequences

Benefits:

- CEO exits the daily execution path; system throughput is more stable.
- Headquarters responsibilities are clearer; recovery and auditing are easier.
- Divisions can evolve independently without reverting to headquarters for every step.

Costs:

- A reliable state synchronization mechanism must be established between VP Operations and VP Orchestration.
- Task board, message bus, and escalation queue become new critical infrastructure.

## OAPEFLIR Eight-Phase Cognitive Loop (Updated 2026-04-17)

Relationship between three-layer separation and OAPEFLIR eight-phase model:

### Dual-Chain Topology

```
Main Chain (real-time execution):
  Observe → Assess → Plan → Execute → Feedback
                                      ↓
Secondary Chain (async improvement): Feedback → Learn → Improve → Rollout
```

- **Main Chain**: User-request-driven real-time execution path, emphasizing low latency and determinism.
- **Secondary Chain**: Event-driven async improvement path, emphasizing learning and accumulation.
- The two chains couple via `Feedback→Learn`; the main chain does not wait for the secondary chain to complete.

### Three Cross-Cutting Concerns

| Concern | Covered Phases | Description |
|---------|----------------|-------------|
| **Knowledge Plane** | Observe/Assess/Plan | Knowledge retrieval supports contextual phases |
| **Artifact Plane** | Plan/Execute | Execution artifacts (code/docs) storage and publishing |
| **Memory Layer** | All 8 phases | L1-L6 memory supports context continuity |

### Phase to Three-Layer Architecture Mapping

| Three-Layer Architecture | Corresponding OAPEFLIR Component |
|---------------------------|----------------------------------|
| strategic_governor (CEO) | Participates in L0-L1 rollout approval, anomaly escalation |
| operations_supervisor (VP Operations) | OapeflirLoopService orchestrates 8 phases |
| execution_orchestrator (VP Orchestration) | RuntimeExecuteBridge executes Plan DTO |
| division_lead (Lead Agent) | Domain Plugin supports domain-specific retrieval/validation/planning |

### Key Architecture Constraints

- **R1-SCOPE**: Phase 1 limited to 4 new directories: agent-loop/planning/feedback/improvement (other M2 implemented early)
- **R2-WHITELIST**: Observe output limited to raw_signals/normalized_snapshot/refs/metrics
- **R2-BLACKLIST**: Observe prohibited from outputting recommendedWorkflow/riskLevel/approvalRequired/modelClass/recommendedActions
- **R3-SINGLE**: Execute layer can only receive Plan DTO; no bypassing
- **R4-TYPES**: Phase 1 limited to 3 learning types: failure_pattern/user_correction/recovery_playbook
- **R4-EVIDENCE**: Learning targets must have FeedbackSignal evidence links

## Cross-References

- [ADR-002 Division System](./002-division-system.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-016 OAPEFLIR Eight-Phase Cognitive Loop](./016-oapeflir-loop-model.md)
- [ADR-079 Feedback Hub](./079-feedback-hub-signals.md)
- [ADR-080 Learn Hub](./080-learn-hub-pattern-detection.md)

## Source Sections

- `§2.1`
- `§2.2`
- `§2.2.1`
- `§4.1`
- `§OAPEFLIR` Eight-Phase Model (added 2026-04-17)
