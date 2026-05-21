# ADR-092: Harness Loop Controller

---

## OAPEFLIR Relationship

- **Observe**: Read current run, context, budget, and stage input
- **Assess**: Decide whether to continue, retry, replan, or escalate to human
- **Plan**: Arrange next iteration and stage sequence
- **Execute**: Drive planner -> generator -> evaluator
- **Feedback**: Write each round decision and timeline
- **Learn**: Accumulate loop failure patterns
- **Improve**: Support loop strategy evolution
- **Release**: Put loop behavior into regression and drilling

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Harness needs to upgrade from single-round `runLoop()` to an iterable, interruptible, recoverable main control loop, otherwise it cannot support long-running tasks, retry, and async suspend.

## Decision

- Loop Controller serves as the formal controller of Harness
- Each iteration must record `NodeRun / NodeAttempt`, decision, context snapshot, and timeline
- Loop exit is only allowed through six types of HarnessDecision or budget limit trigger
- Loop controller must be able to handle sleep / recover / HITL / resume

## Consequences

- Iterative control no longer scattered in a single helper
- Harness behavior is replayable, recoverable, auditable

## v4.3 ADR Remediation

- A-33: This ADR originally used `step / decision` to record the main timeline. Root cause was that the loop controller ADR inherited semantic step narration and did not rewrite as `NodeRun / NodeAttempt` became the execution truth object. Fix: The text now converges the timeline subject to `NodeRun / NodeAttempt`, with step retained only as a semantic projection.