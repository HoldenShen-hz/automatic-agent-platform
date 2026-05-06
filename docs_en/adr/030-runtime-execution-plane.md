# ADR-030 Runtime Execution Plane

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The execution plane (P4) is where agents actually execute tasks. It requires unified execution strategies, a registry mechanism, recovery mechanisms, and runtime patterns.

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
- Repository / recovery workers must NOT directly modify status columns of `harness_runs / node_runs / node_attempts` to express start, blocking, success, or failure.
- Recovery actions must be determined based on `NodeAttemptReceipt`, lease, checkpoint, and evidence refs, then persisted via `RuntimeStateMachine.transition(command)`.

### ExecutorRegistry

- register() - registers an executor
- resolve() - resolves an executor by type
- plugin-executor implementation

### 6 Built-in Executor Types

| Type | Description |
|------|-------------|
| ToolExecutor | Tool call executor |
| PluginExecutor | Plugin executor |
| BrowserExecutor | Browser automation executor |
| SubWorkflowExecutor | Sub-workflow executor |
| CodeExecutor | Code executor |
| HttpExecutor | HTTP request executor |

### 8 Runtime Modes

Corresponds to the 8 PolicyMode modes, managed by PolicyCenterService.

### 6 Recovery Workers

| Worker | Responsibility |
|--------|----------------|
| RuntimeRecoveryService | General recovery logic |
| RuntimeRepairService | Repairs corrupted state |
| RuntimeRecoveryDecisionService | Recovery decisions |
| RuntimeRecoveryReplayService | Replays execution |
| StalledExecutionEscalationService | Stalled execution escalation |
| ExecutionDbQueueDisconnectRepairService | Queue disconnect repair |

## Consequences

Pros:

- Unified execution strategy simplifies development
- ExecutorRegistry supports extensibility
- 6 recovery workers implement self-healing

Cons:

- Execution layer adds abstraction complexity
- Recovery logic requires careful design

## Cross-references

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-025 Stability Architecture - Seven Layers](./025-stability-architecture-seven-layers.md)

## Source Section

- `§14` Runtime Execution Plane

## v4.3 ADR Remediation

- A-3: This ADR originally only described executors, recovery workers, and execution strategy, without stating that `RuntimeStateMachine.transition(command)` is the only state change entry point. Root cause: the execution ADR followed the execution-centric repository approach. Fix: The text now includes state and recovery boundaries, clarifying that all truth state progression must go through the state machine.
- A-11: This ADR originally simplified timeout to `default_ms / per_step_ms`. Root cause: execution strategy still used a unified step timeout model, without differentiating by node type as `NodeRun` types evolved. Fix: The text now changes timeout to `by_node_kind`, explicitly distinguishing LLM / tool / HITL nodes.
