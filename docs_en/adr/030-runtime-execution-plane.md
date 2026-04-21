# ADR-030 Runtime Execution Plane

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The Execution Plane (P4) is where Agents actually execute tasks, requiring unified execution strategies, registration mechanisms, recovery mechanisms, and runtime modes.

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
    per_step_ms: number;
  };
  failure: {
    continue_on_failure: boolean;
    partial_success_threshold: number;
  };
  checkpoint: {
    enabled: boolean;
    interval_steps: number;
  };
}
```

### ExecutorRegistry

- register() registers executors
- resolve() resolves executors by type
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

Correspond to PolicyMode 8 modes, managed by PolicyCenterService.

### 6 Recovery Workers

| Worker | Responsibility |
|--------|----------------|
| RuntimeRecoveryService | General recovery logic |
| RuntimeRepairService | Repairs corrupted state |
| RuntimeRecoveryDecisionService | Recovery decisions |
| RuntimeRecoveryReplayService | Replays execution |
| StalledExecutionEscalationService | Escalates stalled executions |
| ExecutionDbQueueDisconnectRepairService | Repairs queue disconnections |

## Consequences

Positive:
- Unified execution strategy simplifies development
- ExecutorRegistry supports extensions
- 6 recovery workers implement self-healing

Negative:
- Execution layer adds abstraction complexity
- Recovery logic requires careful design

Trade-offs:
- Extensibility vs. complexity
- Resilience vs. overhead

## Cross-References

- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-025 Stability Architecture Seven Layers](./025-stability-architecture-seven-layers.md)

## Source Sections

- `§14` Runtime Execution Plane