# ADR-040 Goal Decomposition Engine Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Complex business goals need to be decomposed into executable task sequences, and the platform needs automated goal decomposition capability.

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
  dependencies: string[];  // Dependent task IDs
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
3. Construct DAG (Directed Acyclic Graph)
4. Validate no circular dependencies
5. Calculate decomposition confidence

### Confidence Thresholds

```typescript
const CLARIFICATION_THRESHOLD = 0.7;  // Confidence < 0.7 → human assistance
```

- `confidence < 0.7` triggers clarification
- `decompositionConfidence < 0.7` marks `requiresHumanReview: true`

### Depth Limit

```typescript
const DEFAULT_MAX_DEPTH = 5;  // Maximum decomposition depth 5 layers
```

### GoalProjection and HarnessRun Lifecycle Relationship

`Goal` itself only describes the decomposition input; upon entering execution, the truth state must converge to `HarnessRun.status`.

| GoalProjection State | Corresponding HarnessRun truth |
|---------------------|-------------------------------|
| draft | HarnessRun not yet created |
| decomposing | `created / admitted / planning` |
| planned | `ready` |
| executing | `running / replanning / compensating` |
| paused | `pausing / paused / resuming` |
| completed | `completed` |
| failed | `failed` |
| cancelled | `aborted` |

Rules:
- `GoalProjection` is only allowed as an upper-level projection or product display, and must not replace `HarnessRun.status`.
- The 9-state goal lifecycle parallel to `HarnessRun` is no longer defined separately.

### Circular Dependency Detection

- DependencyGraph + Validator
- Rejects decomposition when circular dependency detected

## Consequences

Positive:
- Automated decomposition improves efficiency
- Confidence mechanism balances automation and human intervention
- DAG validation ensures executability

Negative:
- Complex goal decomposition may be inaccurate
- Dependency analysis requires comprehensive context

## v4.3 ADR Remediation

- A-28: This ADR originally defined a separate 9-state goal lifecycle. The root cause was that the goal decomposition ADR mixed "decomposition product state" and "runtime truth state" into one lifecycle, and did not converge when `HarnessRun` became the sole execution state machine. Fix: The main text now demotes goal state to `GoalProjection`, and the execution phase uniformly maps to `HarnessRun.status`.

## Cross-References

- [ADR-039 Natural Language Task Entry Architecture](./039-natural-language-task-entry.md)
- [ADR-082 Natural Language Entry and Goal Decomposition](./082-natural-language-entry-and-goal-decomposition.md)

## Source Sections

- `§40` Goal Decomposition Engine
