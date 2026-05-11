# Harness Run Lifecycle Contract

## 1. Scope

Defines the lifecycle and recovery semantics of `HarnessRun` from admission to terminal state.

## 2. Lifecycle

`created -> admitted -> planning -> ready -> running -> {pausing|paused|replanning|compensating|completed|failed|cancelled|aborted}`

## 3. Constraints

- All state transitions must go through `RuntimeStateMachine`.
- `HarnessRun` is the sole authoritative run truth; any workflow/session is merely a projection.
- Replanning must preserve historical `PlanGraphBundle`, expressed via patch/new version.