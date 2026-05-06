# ADR-004 Workflow and Routing

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback source types (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Release state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Background

The platform needs to simultaneously support simple single tasks, standard workflows, multi-agent collaboration, and cross-division compound tasks. If all tasks go through the same heavy process, it will significantly slow down execution and amplify costs, and simple scenarios will bear unnecessary coordination overhead.

## Decision

Adopt five-plane-driven routing with multi-path execution:

- P1 Interface Plane is responsible for receiving messages, triage, and entry normalization.
- P2 Control Plane is responsible for policy judgment, routing decisions, and governance constraint injection.
- P3 Orchestration Plane is responsible for cross-domain splitting, dependency management, and `PlanGraphBundle` generation.
- `HarnessRuntime` serves as the sole execution runtime accepting P3→P4 handoff.
- Domain agents/workers only execute local responsibilities within the `NodeRun` boundary dispatched by HarnessRuntime.

The system defines four execution paths:

- `passthrough`: Shortest chain, suitable for low-complexity tasks.
- `fast`: Emphasizes low latency and low cost.
- `standard`: Introduces testing, validation, or lightweight review.
- `full`: Full agent collaboration and stronger quality assurance.

## Task Lifecycle

Typical chain:

1. P1 receives messages and filters non-task conversations.
2. P2 completes rule matching, risk assessment, and routing decisions.
3. Single-domain tasks directly generate minimal `PlanGraphBundle`.
4. Cross-domain tasks are handed to P3 for splitting, dependency graph management, and graph patch.
5. `HarnessRuntime` executes `NodeRun / NodeAttempt` and returns `NodeAttemptReceipt`.
6. P1/P2 consume projection results and return to the original channel.

## Workflow Data Transfer

v4.3 §5.5 deprecated WorkflowState/StepOutput; data transfer now uses the NodeRun/HarnessRun model:

- `HarnessRun` is the top-level execution container, containing multiple `NodeRun`.
- Each `NodeRun` represents a node execution in the graph, producing `NodeAttemptReceipt`.
- Inter-node data transfer is through `NodeAttemptReceipt.output` and artifact store references.
- After upstream `NodeRun` completes, results are injected into downstream context through PlanGraphBundle / GraphPatch.

Key requirements:

- Output must pass schema validation before writing.
- Limited retries are allowed when critical fields are missing.
- Partial success should be explicitly recorded, with continuation decided by precondition.
- WorkflowState/StepOutput is deprecated; retained only in compatibility projection views.

## Migration Guide: WorkflowState/StepOutput → NodeRun/HarnessRun

> For detailed migration steps, see [e2e-workflow-state-migration.md](../migrations/e2e-workflow-state-migration.md)

### Field Mapping Table

| Old Field (WorkflowState/StepOutput) | New Field (NodeRun/HarnessRun) | Description |
|--------------------------------------|--------------------------------|-------------|
| `WorkflowStateRecord.taskId` | `HarnessRun.taskId` (via PlanGraphBundle) | Task reference passed via bundle |
| `WorkflowStateRecord.workflowId` | `NodeRun.nodeId` / `PlanGraphBundle.workflowId` | Workflow ID corresponds to graph node |
| `WorkflowStateRecord.currentStepIndex` | `NodeRun.status` + execution order | Step progress represented by node status |
| `WorkflowStateRecord.outputsJson` | `NodeAttemptReceipt.output` | Output passed via receipt |
| `StepOutput.stepName` | `NodeRun.nodeId` | Step name corresponds to node ID |
| `StepOutput.outputValue` | `NodeAttemptReceipt.output[key]` | Output value directly accessible in receipt |

### Code Example

**Old Pattern (Deprecated)**:
```typescript
// Direct manipulation of WorkflowStateRecord
store.insertWorkflowState({
  taskId,
  workflowId: "multi_step",
  currentStepIndex: 0,
  outputsJson: JSON.stringify({ step0_output: "result" }),
});

store.updateWorkflowState(taskId, "running", 1, JSON.stringify({ step0_output: "result" }), now, null);
```

**New Pattern (NodeRun/HarnessRun)**:
```typescript
import { runMultiStepOrchestration } from "../../src/platform/execution/execution-engine/multi-step-orchestration.js";

const result = await runMultiStepOrchestration({
  dbPath,
  title: "Multi-step workflow",
  request: "Run multi-step test with steps",
  stepOutputOverrides: {
    "step_0": { step0_output: "result_from_step_0" },
  },
});

// Access state via result.snapshot
const { task, workflow, execution } = result.snapshot;
```

### Common Patterns Comparison

| Old Pattern | New Pattern |
|------------|-------------|
| Manual insertion of `WorkflowStateRecord` | `runMultiStepOrchestration()` auto-creates |
| `store.updateWorkflowState()` | Built into orchestrator execution flow |
| `TransitionService` drives state machine | `RuntimeStateMachine.transition()` |
| Manual `StepOutput` array management | `NodeAttemptReceipt.output` single-point access |

### Migration Checklist

- [ ] Replace `store.insertWorkflowState()` with `runMultiStepOrchestration()`
- [ ] Replace `store.updateWorkflowState()` with orchestrator auto-management
- [ ] Remove `WorkflowStateRecord` type references, use `HarnessRun` / `NodeRun`
- [ ] Change `StepOutput` access to `NodeAttemptReceipt.output[key]`
- [ ] Update test cases to use corresponding patterns in Option A/B/C
- [ ] Run `npm run build && node --test dist/tests/e2e/multi-step-workflow.test.js` to verify

## Routing Principles

P2 Control Plane routing rules:

- Rules first, LLM fallback second.
- Simple tasks prioritize `passthrough` or `fast` hits.
- Only enter P3 orchestration chain when cross-domain dependencies are explicitly identified.

P3 Orchestration responsibilities:

- Split compound tasks.
- Establish dependency graph.
- Perform schema compatibility pre-check.
- After upstream node completes, inject results into downstream context through `PlanGraphBundle` / `GraphPatch`.

## Self-Healing and Escalation

After workflow failure, do not exit directly; handle in this order:

- Limited retries.
- Loop detection to avoid repeatedly executing the same failed action.
- When needed, roll back to upstream steps or mark partial success.
- After exceeding threshold, escalate to P2 Control Plane for human takeover or higher governance action.

HITL trigger scenarios include:

- Cost approaching or exceeding threshold.
- Security-sensitive operations.
- Ambiguity in the task itself.
- Self-healing exceeding maximum attempts.
- Organizational changes or high-risk workflow suggestions.

## Relationship Between Contracts and HR

Workflows should not evolve separately from the contract system:

- Each role should have clear input/output schema.
- Preconditions are parent-level Agent's pre-validation of child-level Agent.
- New roles generated by HR Agent must comply with the same contracts.
- Workflow changes from HR can only be suggestions, not auto-deployed.

## Results

Advantages:

- Simple tasks are not slowed by heavy orchestration.
- Complex tasks can gain cross-division collaboration capabilities.
- Workflow state is persistable, naturally supporting recovery and audit.

Constraints:

- Requires unified task, step, and event models.
- Workflow DSL needs strict complexity control to avoid premature support for excessive branching syntax.
- Routing, cost, and recovery logic need collaborative design, not scattered everywhere.

## Cross References

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)
- [ADR-002 Division System](./002-division-system.md)
- [ADR-008 Cost Model](./008-cost-model.md)

## Source Sections

Note: After v4.3 migration, original §4.* workflow sections have been restructured. This ADR's relevant content is now distributed across §4 (Five-Plane Architecture), §5 (Execution Canonical), §6 (API and Runtime Resources), §14 (Scheduling), §40 (Goal Decomposition).

v4.3 valid references:
- `§4` Five-plane+X1 architecture
- `§5.3` RequestEnvelope → HarnessRun → PlanGraphBundle handoff
- `§5.5` NodeRun / NodeAttempt / receipt data transfer
- `§14.9` Graph scheduling and execution ordering
- `§40.2` Goal decomposition and cross-domain dependency graph

## v4.3 ADR Remediation

- A-21: This ADR originally continued using the v3 agent hierarchy of "VP Operations / VP Orchestration / Division / Lead Agent / CEO". The root cause was that the workflow and routing ADR long served as organizational narrative and was not rewritten as the five-plane and `HarnessRuntime` became the runtime backbone in v4.3. Fix: The text now uses P1/P2/P3 and `HarnessRuntime`-driven routing and execution model.
