# ADR-030 Runtime Execution Plane

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The Execution Plane (P4) is where Agents actually execute tasks. It requires unified execution strategies, a registration mechanism, recovery mechanisms, and runtime patterns.

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

- All truth state advancement must go through `RuntimeStateMachine.transition(command)`.
- Repository / recovery workers must NOT directly modify the status columns of `harness_runs / node_runs / node_attempts` to express start, blocked, success, or failure.
- Recovery actions can only decide the next step based on `NodeAttemptReceipt`, leases, checkpoints, and evidence refs, then persist the truth via `RuntimeStateMachine.transition(command)`.

### ExecutorRegistry

- register() registers an executor
- resolve() resolves an executor by type
- plugin-executor implementation

### 6 Built-in Executor Types

| Type | Description |
|------|-------------|
| ToolExecutor | Tool invocation executor |
| PluginExecutor | Plugin executor |
| BrowserExecutor | Browser automation executor |
| SubWorkflowExecutor | Sub-workflow executor |
| CodeExecutor | Code executor |
| HttpExecutor | HTTP request executor |

### 8 Runtime Modes

Correspond to the 8 PolicyMode types, managed uniformly by PolicyCenterService.

### 6 Recovery Workers

| Worker | Responsibility |
|--------|----------------|
| RuntimeRecoveryService | Generic recovery logic |
| RuntimeRepairService | Repairs corrupted state |
| RuntimeRecoveryDecisionService | Recovery decisions |
| RuntimeRecoveryReplayService | Replays execution |
| StalledExecutionEscalationService | Stalled execution escalation |
| ExecutionDbQueueDisconnectRepairService | Queue disconnection repair |

## Consequences

Benefits:

- Unified execution strategy simplifies development
- ExecutorRegistry supports extensibility
- 6 recovery workers achieve self-healing

Trade-offs:

- Execution layer adds abstraction complexity
- Recovery logic requires careful design

## Cross-references

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-025 Stability Architecture](./025-stability-architecture-seven-layers.md)

## Source Section

- `§14` Runtime Execution Plane

## v4.3 ADR Remediation

- A-3: This ADR originally only described executors, recovery workers, and execution strategies, without establishing `RuntimeStateMachine.transition(command)` as the sole state change entry point. The root cause was that implementing the ADR followed an execution-centric repository approach. Fix: The body now includes state and recovery boundaries, clarifying that all truth state advancement must go through the state machine.
- A-11: This ADR originally simplified timeout into `default_ms / per_step_ms`. The root cause was that execution strategy still used a unified step timeout model, without introducing per-node-type dynamic timeouts as `NodeRun` types differentiated. Fix: The body now changes timeout to `by_node_kind`, explicitly distinguishing LLM / tool / HITL nodes.
