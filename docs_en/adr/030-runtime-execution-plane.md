# ADR-030 Runtime Execution Plane

- Status：Accepted
- Decision Date：2026-04-03

## Background

The Execution Plane (P4) is where Agents actually execute tasks, requiring unified execution strategy, registration mechanism, recovery mechanism, and runtime mode.

## Decision

### ExecutionStrategy

```typescript
interface ExecutionStrategy {
  retry: {
    max_attempts: number;
    base_delay_ms: number;
    max_delay_ms: number;
  };
  timeout: {
    default_ms: number;
    by_node_kind: {
      llm_node_ms: number;
      tool_node_ms: number;
      hitl_node_ms: null;
    };
  };
  failure: {
    continue_on_failure: boolean;
    partial_success_threshold: number;
  };
  checkpoint: {
    enabled: boolean;
    interval_nodes: number;
  };
}
```

State and Recovery Boundaries:

- All truth state progression must go through `RuntimeStateMachine.transition(command)`.
- Repository / recovery workers must not directly modify the status column of `harness_runs / node_runs / node_attempts` to express start, block, success, or failure.
- Recovery actions can only decide next steps based on `NodeAttemptReceipt`, lease, checkpoint, and evidence refs, then persist truth via `RuntimeStateMachine.transition(command)`.

### ExecutorRegistry

- register() - registers executor
- resolve() - resolves executor by type
- plugin-executor implementation

### 6 Built-in Executor Types

| Type | Description |
|------|------|
| ToolExecutor | Tool call executor |
| PluginExecutor | Plugin executor |
| BrowserExecutor | Browser automation executor |
| SubWorkflowExecutor | Sub-workflow executor |
| CodeExecutor | Code executor |
| HttpExecutor | HTTP request executor |

### 8 Runtime Modes

Corresponds to PolicyMode 8 modes, managed by PolicyCenterService.

### 6 Recovery Workers

| Worker | Responsibility |
|--------|------|
| RuntimeRecoveryService | General recovery logic |
| RuntimeRepairService | Repair corrupted state |
| RuntimeRecoveryDecisionService | Recovery decision |
| RuntimeRecoveryReplayService | Replay execution |
| StalledExecutionEscalationService | Stall escalation |
| ExecutionDbQueueDisconnectRepairService | Queue disconnect repair |

## Consequences

Advantages:

- Unified execution strategy simplifies development
- ExecutorRegistry supports extension
- 6 recovery workers enable self-healing

Costs:

- Execution layer adds abstraction complexity
- Recovery logic requires careful design

## Cross-references

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-025 Stability Architecture](./025-stability-architecture-seven-layers.md)

## Source Section

- `§14` Runtime Execution Plane

## v4.3 ADR Remediation

- A-3: This ADR originally only described executors, recovery workers, and execution strategy, without writing `RuntimeStateMachine.transition(command)` as the sole state change entry point, root cause: the execution ADR followed execution-centric repository thinking. Fix: The body now includes state and recovery boundaries, clarifying that all truth state progression must go through the state machine.
- A-11: This ADR originally simplified timeout to `default_ms / per_step_ms`, root cause: execution strategy still停留在 unified step timeout model and did not introduce dynamic timeout by node type with `NodeRun` type differentiation. Fix: The body now changes timeout to `by_node_kind`, explicitly distinguishing LLM / tool / HITL nodes.