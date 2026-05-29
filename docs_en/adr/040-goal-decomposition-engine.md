# ADR-040 Goal Decomposition Engine Architecture

- Status：Accepted
- Decision Date：2026-04-20

## Background

Complex business goals need to be decomposed into executable task sequences, and the platform needs automated goal decomposition capabilities.

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
  dependencies: string[];  // IDs of tasks this depends on
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

1. Parse Goal's success_criteria
2. Identify task dependencies
3. Build DAG (Directed Acyclic Graph)
4. Verify no circular dependencies
5. Calculate decomposition confidence

### Confidence Threshold

```typescript
const CLARIFICATION_THRESHOLD = 0.7;  // confidence < 0.7 → human assistance
```

- `confidence < 0.7` triggers clarification
- `decompositionConfidence < 0.7` marks `requiresHumanReview: true`

### Depth Limits

```typescript
const DEFAULT_MAX_DEPTH = 5;  // Max decomposition depth 5 layers
const GLOBAL_CALL_DEPTH_CAP = 8;  // Global call depth hard cap, goal decomposition recursion must not exceed this limit
```

Constraints:
- `DEFAULT_MAX_DEPTH` defines the upper limit for single goal decomposition recursion depth.
- `GLOBAL_CALL_DEPTH_CAP` is a system-level hard cap to prevent deep recursion causing stack overflow.
- Actual decomposition depth is constrained by both, taking the smaller value.
- When exceeding `GLOBAL_CALL_DEPTH_CAP`, decomposition must terminate and report `call_depth_exceeded` error.

### GoalProjection and HarnessRun Lifecycle Relationship

`Goal` itself only describes decomposition input; after entering execution, state truth must converge to `HarnessRun.status`.

| GoalProjection State | Corresponding HarnessRun truth |
|------|------|
| draft | HarnessRun not yet created |
| decomposing | `created / admitted / planning` |
| planned | `ready` |
| executing | `running / replanning / compensating` |
| paused | `pausing / paused / resuming` |
| completed | `completed` |
| failed | `failed` |
| cancelled | `aborted` |

Rules:

- `GoalProjection` is only allowed as an upper-level projection or product state display, and cannot replace `HarnessRun.status`.
- No longer separately defines a 9-state goal truth lifecycle parallel to `HarnessRun`.

### Circular Dependency Detection

- DependencyGraph + Validator
- Refuses decomposition when circular dependency is detected

## Consequences

Advantages:

- Automated decomposition improves efficiency
- Confidence mechanism balances automation and human involvement
- DAG validation ensures executability

Costs:

- Complex goal decomposition may be inaccurate
- Dependency analysis

## v4.3 ADR Remediation

- A-28: This ADR originally defined a separate 9-state goal lifecycle, root cause: goal decomposition ADR mixed "decomposition product state" and "runtime truth state" into one lifecycle and did not converge as `HarnessRun` became the sole execution main state machine. Fix: The body now demotes goal state to `GoalProjection`, with execution stage unified to `HarnessRun.status`.

## Cross-references

- [ADR-039 Natural Language Task Entry Architecture](./039-natural-language-task-entry.md)
- [ADR-060 Explicit Planning Hub](./060-explicit-planning-hub.md)

## Source Section

- Section 40