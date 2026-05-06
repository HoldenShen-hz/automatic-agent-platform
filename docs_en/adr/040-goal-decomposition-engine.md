# ADR-040 Goal Decomposition Engine Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Complex business goals need to be decomposed into executable task sequences. The platform requires automated goal decomposition capabilities.

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
  dependencies: string[];  // Task IDs this task depends on
  estimated_duration_minutes: number;
  domain_id?: string;
}

interface TaskDependency {
  from: string;
  to: string;
  type: 'sequential' | 'parallel' | 'conditional';
}
```

### Decomposition Process

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

### Depth Limit

```typescript
const DEFAULT_MAX_DEPTH = 5;  // Maximum decomposition depth of 5 levels
```

**Global Call Depth Constraint**: Goal decomposition depth limits must work in conjunction with the global `call_depth` hard upper limit (default 8) as defined in §19.2. Decomposition depth must not exceed global call depth, and must not be multiplied with delegation local limits to circumvent restrictions (see §19.2 call depth conflict analysis).

### GoalProjection and HarnessRun Lifecycle Relationship

`Goal` only describes decomposition input; upon execution, the state truth must converge to `HarnessRun.status`.

| GoalProjection State | Corresponding HarnessRun Truth |
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

- `GoalProjection` is only allowed as an upper-level projection or product state display, and must not replace `HarnessRun.status`.
- The 9-state goal truth lifecycle parallel to `HarnessRun` is no longer defined separately.

### Circular Dependency Detection

- DependencyGraph + Validator
- Rejects decomposition when circular dependency is found

## Consequences

Pros:

- Automated decomposition improves efficiency
- Confidence mechanism balances automation and human involvement
- DAG verification ensures executability

Cons:

- Complex goal decomposition may be inaccurate
- Dependency analysis overhead

## v4.3 ADR Remediation

- A-28: This ADR originally defined a separate 9-state goal lifecycle. Root cause: the goal decomposition ADR mixed "decomposition product state" and "runtime truth state" into one lifecycle, and did not converge as `HarnessRun` became the sole execution state machine. Fix: The text now demotes goal state to `GoalProjection`, and maps execution phase uniformly to `HarnessRun.status`.

## Source Section

- `§40` Goal Decomposition Engine Architecture
