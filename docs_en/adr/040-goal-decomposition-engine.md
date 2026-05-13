# ADR-040 Goal Decomposition Engine Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Complex business goals need to be decomposed into executable task sequences, and the platform requires automated goal decomposition capabilities.

## Decision

### Core Interfaces

```typescript
interface Goal {
  goal_id: string;
  description: string;
  success_criteria: SuccessCriterion[];
  constraints: Constraint[];
  deadline?: string;
}

interface SuccessCriterion {
  criterion_id: string;
  description: string;
  metric: string;
  target_value: number;
}

interface GoalDecomposition {
  decomposition_id: string;
  goal_id: string;
  planned_tasks: PlannedTask[];
  confidence: number;
  requires_human_review: boolean;
}

interface PlannedTask {
  task_id: string;
  description: string;
  dependencies: string[];  // IDs of dependent tasks
  estimated_duration_minutes: number;
  domain_id?: string;
}

interface TaskDependency {
  from: string;
  to: string;
  type: 'sequential' | 'parallel' | 'conditional';
}
```

### Decomposition Flow

1. Parse success_criteria of Goal
2. Identify task dependencies
3. Build DAG (Directed Acyclic Graph)
4. Verify no cyclic dependencies
5. Calculate decomposition confidence

### Confidence Thresholds

```typescript
const CLARIFICATION_THRESHOLD = 0.7;  // confidence < 0.7 → human assistance
```

- `confidence < 0.7` triggers clarification
- `decompositionConfidence < 0.7` marks `requiresHumanReview: true`

### Depth Limits

```typescript
const DEFAULT_MAX_DEPTH = 5;  // maximum decomposition depth of 5 levels
const GLOBAL_CALL_DEPTH_CAP = 8;  // system-level hard cap, goal decomposition recursion must not exceed this limit
```

Constraints:
- `DEFAULT_MAX_DEPTH` defines the recursion depth upper limit for a single goal decomposition.
- `GLOBAL_CALL_DEPTH_CAP` is a system-level hard cap to prevent stack overflow from excessive recursion nesting.
- Actual decomposition levels are constrained by both, taking the smaller value.
- When `GLOBAL_CALL_DEPTH_CAP` is exceeded, decomposition must terminate and report a `call_depth_exceeded` error.

### GoalProjection and HarnessRun Lifecycle Relationship

`Goal` itself only describes decomposition input; after entering execution, the status truth must converge to `HarnessRun.status`.

| GoalProjection Status | Corresponding HarnessRun Truth |
|-----------------------|--------------------------------|
| draft | `HarnessRun` not yet created |
| decomposing | `created / admitted / planning` |
| planned | `ready` |
| executing | `running / replanning / compensating` |
| paused | `pausing / paused / resuming` |
| completed | `completed` |
| failed | `failed` |
| cancelled | `aborted` |

Rules:

- `GoalProjection` is only allowed as an upper-layer projection or product-state display, and must not replace `HarnessRun.status`.
- A separate 9-state goal truth lifecycle parallel to `HarnessRun` is no longer defined.

### Cyclic Dependency Detection

- DependencyGraph + Validator
- Reject decomposition when cyclic dependency is detected

## Consequences

Benefits:

- Automated decomposition improves efficiency
- Confidence mechanism balances automation and human intervention
- DAG validation ensures executability

Trade-offs:

- Complex goal decomposition may be inaccurate
- Dependency relationship analysis is complex

## v4.3 ADR Remediation

- A-28: This ADR originally defined a separate 9-state goal lifecycle. The root cause was that the goal decomposition ADR mixed "decomposition product status" and "runtime truth status" into one lifecycle, and did not converge when `HarnessRun` became the sole execution state machine. Fix: The main text now downgrades goal status to `GoalProjection`, and the execution phase is uniformly mapped to `HarnessRun.status`.

## Cross-references

- [ADR-039 Natural Language Task Entry Architecture](./039-natural-language-task-entry.md)
- [ADR-060 Explicit Planning Hub](./060-explicit-planning-hub.md)

## Source Section

- `§40` Goal Decomposition Engine Architecture