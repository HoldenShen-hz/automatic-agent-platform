# ADR-092 Harness Loop Controller

---

## OAPEFLIR Association

- **Observe**: Read current run, context, budget, and stage input
- **Assess**: Determine whether to continue, retry, re-plan, or transfer to human
- **Plan**: Arrange next iteration and stage sequence
- **Execute**: Drive planner -> generator -> evaluator
- **Feedback**: Write each round decision and timeline
- **Learn**: Accumulate loop failure patterns
- **Improve**: Support loop strategy evolution
- **Release**: Include loop behavior in regression and drill

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Harness needs to upgrade from single-round `runLoop()` to an iterable, interruptible, recoverable main control loop, otherwise it cannot support long-running tasks, retry, and async suspend.

## Decision

- Loop Controller serves as Harness's formal controller
- Each iteration must record `NodeRun / NodeAttempt`, decision, context snapshot, and timeline
- Loop exit is only allowed through six types of HarnessDecision or budget cap trigger
- Loop controller must be able to handle sleep / recover / HITL / resume

## Consequences

- Iterative control no longer scattered in单个 helper
- Harness behavior can be replayed, recovered, and audited

## v4.3 ADR Remediation

- A-33: This ADR originally used `step / decision` to record main timeline,根因 was that loop controller ADR inherited semantics step narration, and did not rewrite as `NodeRun / NodeAttempt` became the truth object of execution. Fix: The text now converges the timeline subject to `NodeRun / NodeAttempt`, and step only retains as semantic projection.
