# Harness Run Lifecycle Contract

## 1. Scope

Defines `HarnessRun` lifecycle from admission to terminal state and recovery semantics.

## 2. Lifecycle

`created -> admitted -> planning -> ready -> running -> {pausing|paused|replanning|compensating|completed|failed|cancelled|aborted}`

## 3. Constraints

- All status advancement must go through `RuntimeStateMachine`.
- `HarnessRun` is the sole authoritative run truth; any workflow/session is only projection.
- Replanning must preserve historical `PlanGraphBundle`, expressed via patch/new version.