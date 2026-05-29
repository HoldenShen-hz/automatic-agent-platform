# ADR-001 Three-Layer Separation Architecture

- Status: Partially Superseded by v4.3 Five-Plane Baseline
- Decision Date: 2026-04-02

## Background

In the early design, the CEO nearly承担了所有中枢职责：接收任务、分类、路由、拆分、编排、聚合和升级判断。This would create a logical single point when concurrent tasks appear, blurring responsibility boundaries, recovery boundaries, and cost boundaries.

## Decision

Adopt the Five-Plane Architecture (v4.3 canonical, replacing old CEO/VP three-layer separation):

- **P1 Interface Plane**: User message ingress, message triage, entry normalization, NL parsing.
- **P2 Control Plane**: Policy judgment, routing decisions, risk assessment, governance constraint injection.
- **P3 Orchestration Plane**: Cross-domain decomposition, dependency graph construction, PlanGraphBundle generation, result aggregation.
- **P4 Execution Plane** (HarnessRuntime): Unique execution runtime,承接 P3→P4 handoff.
- **P5 Evidence Plane**: State persistence, event recording, checkpoints, artifact storage.
- **X1 Extension Plane**: Perception intelligence, HR approval escalation (triggered on demand).

Notes:
- If legacy narrative names like CEO/VP Operations/VP Orchestration must be retained in documentation, canonical plane IDs must also be provided. Code, directories, events, and contract layers all use canonical IDs as the standard.
- CEO is not a常驻进程, but generated on demand: only triggered in escalation events, perception intelligence, and HR approval scenarios, retains context across escalations via persistent memory, while only one CEO session executes at a time, other escalation events queue by priority.

Notes:

- If legacy narrative names like CEO/VP Operations/VP Orchestration must be retained, canonical IDs must also be provided. Code, directories, events, and contract layers all use canonical IDs as the standard.

CEO is not a常驻进程, but generated on demand:

- Only triggered in escalation events, perception intelligence, and HR approval scenarios.
- Retains context across escalations via persistent memory.
- Only one CEO session executes at a time, other escalation events queue by priority.

## Role Boundaries (v4.3 Five-Plane Mapping)

Headquarters role division (mapped to P1/P2/P3):

- P1 Interface Plane only handles entry processing, does not participate in日常路由和常规编排.
- P2 Control Plane focuses on task triage and resource allocation, does not do complex cross-domain reasoning.
- P3 Orchestration Plane only handles cross-domain coordination and exception intervention, does not接管 domain 内部细节.
- X1 Perception Module exists as a service module, does not participate in Agent lifecycle, but serves as external input source for CEO.

Domain role division:

- Each domain has at least one domain agent承担本地自治编排.
- Roles below domain agent only responsible for各自的契约内输入输出, do not directly承担总部协调职责.

## Reasons for This Choice

- Removes CEO performance bottleneck from main path.
- Completely separates "judgment" from "execution", reducing system occasional complexity.
- Allows each domain to evolve autonomously without打扰总部.
- Provides clearer boundaries for recovery, audit, and cost accounting.

## Key Invariants

- CEO should not appear in normal happy path.
- VP Operations must be able to complete绝大多数任务接入 without calling CEO.
- VP Orchestration only介入 in cross-domain or exception scenarios.
- Lead Agent has autonomy over domain internal workflows, but cannot越平台级权限和安全边界.

## Implementation Impact

Storage and communication requirements:

- Task board must be persisted.
- VP Operations and VP Orchestration must collaborate via reliable events and状态表.
- CEO queue must be recoverable, avoid losing escalation requests after crash.

Cost and monitoring requirements:

- Headquarters layer and domain layer costs must be separately tracked.
- Independent observability needed for CEO, VP Operations, VP Orchestration, and Lead Agent latency and failure patterns.

## Results

Benefits:

- CEO exits daily path, system throughput more stable.
- Headquarters responsibilities clearer, recovery and audit easier to achieve.
- Domains can evolve independently,不需要每一步都回到总部.

Costs:

- Must establish reliable state synchronization mechanism between VP Operations and VP Orchestration.
- Task board, message bus, and escalation queue become new critical infrastructure.

## OAPEFLIR Role Clarification (§13/§45 reconciliation)

According to §13/§45, OAPEFLIR eight-stage cognitive loop positioning in the platform is as follows:

### Official Position

- OAPEFLIR **is not** active orchestration loop (that role is undertaken by HarnessRuntime)
- OAPEFLIR positioning is **StageRationale** and **Audit View**
- OapeflirLoopService is only used for phase transition reasoning records and audit traceability, does not participate in real-time execution scheduling

### Dual-Chain Topology (Revised)

```
Main Chain (Real-time Execution):
  Observe → Assess → Plan → Execute → Feedback
                                      ↓
Secondary Chain (Async Improvement):  Feedback → Learn → Improve → Rollout
```

- **Main Chain**: User request-driven real-time execution path, emphasizes low latency and determinism, driven by HarnessRuntime.
- **Secondary Chain**: Event-driven async improvement path, emphasizes learning and accumulation.
- Two chains couple via `Feedback→Learn`, main chain does not wait for secondary chain completion.

### Three Cross-Cutting Planes

| Plane | Covered Stages | Description |
|-------|---------------|-------------|
| **Knowledge Plane** | Observe/Assess/Plan | Knowledge retrieval supports each stage context |
| **Artifact Plane** | Plan/Execute | Execution artifacts (code/documents) storage and publishing |
| **Memory Layer** | All 8 stages | L1-L6 memory supports context continuity |

### Stage to Five-Plane Architecture Mapping

| Five-Plane | Corresponding OAPEFLIR Components |
|------------|----------------------------------|
| P1 Interface Plane | StageRationale entry, Audit View |
| P2 Control Plane | Policy judgment, risk assessment (Assess) |
| P3 Orchestration Plane | Plan DTO generation, GraphBundle |
| HarnessRuntime | Execute execution (OAPEFLIR does not participate) |

### Key Architecture Constraints

- **R1-SCOPE**: Phase 1 limited to 4 new directories: agent-loop/planning/feedback/improvement (other M2 early implementation)
- **R2-WHITELIST**: Observe output limited to raw_signals/normalized_snapshot/refs/metrics
- **R2-BLACKLIST**: Observe prohibited from outputting recommendedWorkflow/riskLevel/approvalRequired/modelClass/recommendedActions
- **R3-SINGLE**: Execute layer can only receive Plan DTO, cannot bypass
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