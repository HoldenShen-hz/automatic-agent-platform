# ADR-001 Three-Layer Architecture

- Status: Accepted
- Decision Date: 2026-04-02

## Context

In early thinking, the CEO almost承担了所有中枢职责：接收任务、分类、路由、拆分、编排、聚合和升级判断。这会让系统在并发任务出现时形成逻辑单点，也让职责边界、恢复边界和成本边界都变得模糊。

## Decision

Adopt a three-tier distributed architecture:

- `strategic_governor` (business alias: CEO): Only responsible for strategic judgment, HITL escalation, perception intelligence analysis, organizational approval, and exception intervention.
- `operations_supervisor` (business alias: VP Operations): Responsible for user message intake, message triage, task classification, division routing, resource budget allocation, and state persistence.
- `execution_orchestrator` (business alias: VP Orchestration): Responsible for cross-division splitting, dependency graph construction, schema compatibility pre-check, result aggregation, failure escalation, cost circuit breaker response, and stuck Agent intervention.
- `division_lead` (business alias: Lead Agent): Autonomously orchestrates workflow inside the division, controlling role execution order and local self-healing.

Note:

- If the narrative names CEO / VP Operations / VP Orchestration need to be preserved in documentation, the canonical ID must also be provided; code, directories, events, and contract layers all use canonical ID as the standard.

CEO is not a resident process but is generated on-demand:

- Only triggered in escalation events, perception intelligence, and HR approval scenarios.
- Context is preserved across escalations through persistent memory.
- Only one CEO session can execute at a time; other escalation events queue by priority.

## Role Boundaries

Headquarters role division:

- CEO only makes judgments, does not participate in daily routing and routine orchestration.
- VP Operations focuses on task entry and resource allocation, does not do complex cross-division reasoning.
- VP Orchestration only handles cross-division coordination and exception intervention, does not take over internal division details.
- Perception module exists as a service module, does not participate in Agent lifecycle, but serves as an external input source for CEO.

Division role division:

- Each division has at least one Lead Agent for local autonomous orchestration.
- Roles below Lead Agent are only responsible for their respective contract inputs/outputs, do not directly bear headquarters coordination responsibilities.

## Reasons for Choosing This Approach

- Removes CEO performance bottleneck from main path.
- Completely separates "judgment" from "execution," reducing system accidental complexity.
- Allows divisions to evolve autonomously without disturbing headquarters.
- Provides clearer boundaries for recovery, audit, and cost accounting.

## Key Invariants

- CEO should not appear in normal happy path.
- VP Operations must be able to complete the vast majority of task intake without calling CEO.
- VP Orchestration only intervenes in cross-division or exception scenarios.
- Lead Agent has autonomy over internal division workflows but cannot bypass platform-level permissions and security boundaries.

## Implementation Impact

Storage and communication requirements:

- Task board must be persistent.
- VP Operations and VP Orchestration must collaborate through reliable events and state tables.
- CEO queue must be recoverable to avoid losing escalation requests after crashes.

Cost and monitoring requirements:

- Costs at headquarters and division levels need to be tracked separately.
- Independent observation of latency and failure patterns for CEO, VP Operations, VP Orchestration, and Lead Agent needed.

## Results

Benefits:

- CEO exits from daily path, system throughput is more stable.
- Headquarters responsibilities are clearer, recovery and audit are easier to implement.
- Divisions can evolve independently without going back to headquarters at every step.

Costs:

- Reliable state synchronization mechanism must be established between VP Operations and VP Orchestration.
- Task board, message bus, and escalation queue become new critical infrastructure.

## Cross-References

- [ADR-002 Division System](./002-division-system.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)

## Source Sections

- `§2.1`
- `§2.2`
- `§2.2.1`
- `§4.1`
