# ADR-091 Harness Eight Pillar Model

---

## OAPEFLIR Association

- **Observe**: Collect constraints, context, tool capability, and feedback signals
- **Assess**: Evaluate risk, guardrails, HITL triggers, and recoverability
- **Plan**: Define the Harness pillar boundary and acceptance gates
- **Execute**: Assemble the eight pillars through one runtime
- **Feedback**: Feed failures, human feedback, and evaluation results back
- **Learn**: Build failure-to-learning and prompt/memory improvement candidates
- **Improve**: Evolve pillar-level governance and replay support
- **Release**: Make the eight pillars part of phase 8 acceptance

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

`§45` requires Harness to become a first-class runtime object rather than a thin planner/generator/evaluator loop.

## Decision

Harness adopts eight fixed pillars:

1. Constraints
2. Tools
3. State / Memory
4. Feedback
5. Durability
6. Evaluation Harness
7. HITL Runtime
8. Observability / Replay

Each pillar must have code entrypoints, tests, and acceptance evidence.

## Consequences

- `src/platform/orchestration/harness` must converge around the eight-pillar structure
- phase 8 acceptance is evaluated per pillar
