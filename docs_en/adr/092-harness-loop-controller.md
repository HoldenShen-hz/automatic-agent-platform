# ADR-092 Harness Loop Controller

---

## OAPEFLIR Association

- **Observe**: Read current run, context, budgets, and stage inputs
- **Assess**: Decide continue, retry, replan, or human escalation
- **Plan**: Schedule the next iteration and stage order
- **Execute**: Drive planner -> generator -> evaluator
- **Feedback**: Record per-iteration decisions and timeline
- **Learn**: Capture loop failure patterns
- **Improve**: Evolve the loop policy
- **Release**: Include loop behavior in regression and rehearsal gates

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Harness must evolve from a single `runLoop()` call to an iterative, interruptible, recoverable controller.

## Decision

- Loop Controller is the formal Harness control component
- Every iteration records steps, decisions, context snapshots, and timeline events
- Exit is allowed only through Harness decisions or explicit budget limits

## Consequences

- Iteration control is no longer scattered
- Harness becomes replayable, recoverable, and auditable
