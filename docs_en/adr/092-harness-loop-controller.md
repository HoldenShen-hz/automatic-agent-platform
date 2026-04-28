# ADR-092 Harness Loop Controller

---

## OAPEFLIR Association

- **Observe**: Read current run, context, budget, and stage input
- **Assess**: Determine whether to continue, retry, re-plan, or escalate to human
- **Plan**: Arrange next round of iteration and stage sequence
- **Execute**: Drive planner -> generator -> evaluator
- **Feedback**: Write each round of decision and timeline
- **Learn**: Accumulate loop failure patterns
- **Improve**: Support loop strategy evolution
- **Release**: Incorporate loop behavior into regression and drills

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Harness needs to upgrade from a single-round `runLoop()` to an iterative, interruptible, resumable main control loop; otherwise, it cannot support long-running tasks, retries, and async suspend.

## Decisions

- Loop Controller serves as Harness's formal controller
- Each iteration must record `NodeRun / NodeAttempt`, decision, context snapshot, and timeline
- Loop exit is only allowed via six types of HarnessDecision or budget limit trigger
- Loop controller must be able to handle sleep / recover / HITL / resume

## Consequences

- Iteration control is no longer scattered in individual helpers
- Harness behavior is replayable, resumable, and auditable

## v4.3 ADR Remediation

- A-33: This ADR originally used `step / decision` to record the main timeline; the root cause is that the loop controller ADR inherited the semantic step narrative and was not rewritten as `NodeRun / NodeAttempt` became the execution ground truth object. Fix: The main text now converges the timeline subject to `NodeRun / NodeAttempt`, with step retained only as a semantic projection.
