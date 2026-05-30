# Events And Checkpoints Contract

## 1. Scope

This contract defines the checkpoint mechanism, event sourcing boundaries, and truth mutation rules for execution plane recovery.

## 2. Goals

- Ensure execution state can be recovered from any failure point.
- Define clear boundaries between event truth and checkpoint projection.
- Provide deterministic recovery semantics for multi-step workflows.

## 3. Key Objects

- `CheckpointRecord`
- `CheckpointMetadata`
- `RecoveryPoint`

## 4. Checkpoint Rules

- Checkpoints must be created at consistent cut points in execution.
- A checkpoint must capture all necessary state to resume execution.
- Checkpoints must be idempotent - applying the same checkpoint twice produces the same result.
- Recovery from checkpoint must preserve all auditability guarantees.

## 5. Event Sourcing Boundary

- Truth mutations are expressed as events.
- Checkpoints are projections derived from events for performance.
- The event log is the authoritative source of truth.
- Checkpoints can be rebuilt by replaying events.

## 6. Recovery Semantics

- Recovery must be deterministic given the same checkpoint and events.
- Partial recovery must maintain consistency guarantees.
- Recovery must preserve execution ordering guarantees.

## 7. Testing Requirements

- Checkpoint creation and restoration must be tested.
- Event replay must produce identical state to original execution.
- Recovery failure modes must be explicitly tested.