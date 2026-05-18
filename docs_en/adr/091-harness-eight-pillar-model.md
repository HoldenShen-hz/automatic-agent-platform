# ADR-091 Harness Eight Pillar Model

---

## OAPEFLIR Relationship

- **Observe**: Gather constraints, context, tool capabilities, and feedback signals
- **Assess**: Evaluate risk, guardrails, HITL triggers, and recoverability
- **Plan**: Define Harness pillar boundaries and acceptance gates
- **Execute**: Assemble eight pillars with unified Runtime
- **Feedback**: Flow back failure, human feedback, evaluation conclusions
- **Learn**: Form failure-to-learning and prompt/memory improvement candidates
- **Improve**: Advance pillar-level governance and replay capability enhancement
- **Release**: Put eight pillars into Ring 2 release-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

`§45` requires Harness to no longer be just a thin loop of planner/generator/evaluator, but to become a formal runtime object carrying constraints, tools, memory, feedback, persistence, evaluation, HITL, and observability.

## Decision

Harness adopts a fixed eight-pillar model:

1. Constraints
2. Tools
3. State / Memory
4. Feedback
5. Durability
6. Evaluation Harness
7. HITL Runtime
8. Observability / Replay

Supplementary constraints:

- The eighth pillar's release semantics are uniformly connected to `ReleaseChannel` and `ReleaseDecisionView`, no longer using old `DeploymentSlot` as the harness canonical release subject.
- Improvement promotion semantics in all eight pillars uniformly use `Release`, no longer reverting to old `Rollout` as the top-level stage name.

Each pillar must have an independent code entry, tests, and acceptance evidence; document description alone is not acceptable.

## Consequences

- `src/platform/five-plane-orchestration/harness` must organize directories and export surfaces around the eight pillars
- Ring 2 acceptance must be broken down by pillar
- Gaps in Harness during review use pillar as the minimum remediation unit

## v4.3 ADR Remediation

- A-5: This ADR historically followed the Improve/Release chain's `Rollout` terminology. The root cause was that the harness acceptance gate and release control surface naming were not timely synchronized to the main architecture's `Release` terminology. Fix: The main text now explicitly requires that improvement promotion semantics in all eight pillars uniformly use `Release`.
- A-12: This ADR originally followed old phase acceptance and deployment expression historical context. The root cause was that when the harness eight-pillar ADR formed, it still carried old release implementation terminology. Fix: The main text now explicitly aligns the release subject to `ReleaseChannel` / `ReleaseDecisionView`, no longer using `DeploymentSlot` as the harness canonical release semantics.
