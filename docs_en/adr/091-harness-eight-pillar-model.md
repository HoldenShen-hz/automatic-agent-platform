# ADR-091: Harness Eight Pillar Model

---

## OAPEFLIR Association

- **Observe**: Collect constraint, context, tool capability, and feedback signals
- **Assess**: Evaluate risk, guardrails, HITL trigger, and recoverability
- **Plan**: Define Harness pillar boundaries and acceptance gates
- **Execute**: Assemble eight pillars with unified Runtime
- **Feedback**: Loop back failure, human feedback, and evaluation conclusions
- **Learn**: Form failure-to-learning and prompt/memory improvement candidates
- **Improve**: Advance pillar-level governance and replay capability enhancement
- **Release**: Include eight pillars in Ring 2 release-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

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

- The eighth pillar's release semantics are uniformly connected to `ReleaseChannel` and `ReleaseDecisionView`, no longer using the old `DeploymentSlot` as the harness canonical release subject.
- The improvement promotion semantics across all eight pillars uniformly use `Release`, no longer reverting to the old `Rollout` as the top-level stage name.

Each pillar must have independent code entry, testing, and acceptance evidence; document description alone is not allowed.

## Consequences

- `src/platform/five-plane-orchestration/harness` must organize directories and export surfaces around the eight pillars
- Ring 2 acceptance must be broken down by pillar
- Gaps in Harness during review use pillar as the minimum remediation unit

## v4.3 ADR Remediation

- A-5: This ADR historically followed the `Rollout` terminology in the Improve/Release chain. Root cause: Harness acceptance gate and release control surface naming were not timely synchronized to the main architecture's `Release` caliber. Fix: The text now explicitly requires unified use of `Release` for improvement promotion semantics across all eight pillars.
- A-12: This ADR originally followed historical context of old stage acceptance and deployment expressions. Root cause: Harness eight-pillar ADR still carried old release implementation terminology. Fix: The text now explicitly aligns the release subject to `ReleaseChannel` / `ReleaseDecisionView`, no longer using `DeploymentSlot` as harness canonical release semantics.