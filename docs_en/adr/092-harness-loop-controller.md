# ADR-092 Harness Loop Controller

---

## OAPEFLIR Association

- **Observe**: Read current run, context, budget, and phase input
- **Assess**: Determine whether to continue, retry, re-plan, or transfer to human
- **Plan**: Arrange next iteration and phase order
- **Execute**: Drive planner -> generator -> evaluator
- **Feedback**: Write each round's decision and timeline
- **Learn**: Accumulate loop failure patterns
- **Improve**: Support loop strategy evolution
- **Release**: Incorporate loop behavior into regression and drills

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Harness needs to upgrade from single-round `runLoop()` to an iterative, interruptible, recoverable main control loop; otherwise, it cannot support long-running tasks, retries, and async suspension.

## Decision

- Loop Controller serves as the formal controller of Harness
- Each iteration must record `NodeRun / NodeAttempt`, decision, context snapshot, and timeline
- Loop exit is only allowed through six types of HarnessDecision or budget cap triggers
- Loop controller must be able to handle sleep / recover / HITL / resume

## Consequences

- Iterative control is no longer scattered in individual helpers
- Harness behavior is replayable, recoverable, and auditable

## v4.3 ADR Remediation

- A-33: This ADR originally used `step / decision` to record the main timeline, because the loop controller ADR inherited the semantic step narrative and did not rewrite when `NodeRun / NodeAttempt` became the execution truth object. Fix: The main text now converges the timeline subject to `NodeRun / NodeAttempt`, with step retained only as a semantic projection.
