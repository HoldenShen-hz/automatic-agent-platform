# ADR-092 Harness Loop Controller

---

## OAPEFLIR Association

- **Observe**: Read current run, context, budget, and stage input
- **Assess**: Determine whether to continue, retry, re-plan, or transfer to human
- **Plan**: Arrange next iteration and stage sequence
- **Execute**: Drive planner -> generator -> evaluator
- **Feedback**: Write each round decision and timeline
- **Learn**:沉淀 loop failure patterns
- **Improve**: Support loop strategy evolution
- **Release**: Include loop behavior in regression and drill

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Harness needs to upgrade from single-round `runLoop()` to an iterable, interruptible, recoverable main control loop, otherwise cannot support long-running tasks, retry, and async suspend.

## Decision

- Loop Controller serves as Harness's formal controller
- Each iteration must record `NodeRun / NodeAttempt`, decision, context snapshot, and timeline
- Loop exit only allowed triggered by six-class HarnessDecision or budget upper limit
- Loop controller must handle sleep / recover / HITL / resume

## Consequences

- Iteration control no longer scattered in single helper
- Harness behavior can be replayed, recovered, auditable

## v4.3 ADR Remediation

- A-33: This ADR originally used `step / decision` to record main timeline. Root cause: Loop controller ADR inherited step semantics narrative, did not rewrite as `NodeRun / NodeAttempt` became execution truth object. Fix: Body now converges timeline subject to `NodeRun / NodeAttempt`, step only remains as semantic projection.