# ADR-092 Harness Loop Controller

---

## OAPEFLIR Association

- **Observe**: Read current run, context, budget, and phase input
- **Assess**: Determine whether to continue, retry, re-plan, or escalate to human
- **Plan**: Arrange next iteration and phase sequence
- **Execute**: Drive planner -> generator -> evaluator
- **Feedback**: Write each round decision and timeline
- **Learn**: Precipitate loop failure patterns
- **Improve**: Support loop strategy evolution
- **Release**: Incorporate loop behavior into regression and drills

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Harness needs to upgrade from single-round `runLoop()` to iterative, interruptible, recoverable main control loop, otherwise cannot support long-running tasks, retry, and async suspension.

## Decision

- Loop Controller serves as Harness's formal controller
- Each iteration must record `NodeRun / NodeAttempt`, decision, context snapshot, and timeline
- Loop exit is only allowed through six types of HarnessDecision or budget upper limit trigger
- Loop controller must be able to handle sleep / recover / HITL / resume

## Consequences

- Iterative control no longer scattered in individual helpers
- Harness behavior is replayable, recoverable, auditable

## v4.3 ADR Remediation

- A-33: This ADR originally used `step / decision` to record main timeline, root cause being loop controller ADR inherited semantic step narrative, did not rewrite as `NodeRun / NodeAttempt` became execution truth object. Fix: Main text now converges timeline subject to `NodeRun / NodeAttempt`, step only retained as semantic projection.
