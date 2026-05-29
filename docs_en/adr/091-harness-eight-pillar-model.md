# ADR-091 Harness Eight Pillar Model

---

## OAPEFLIR Association

- **Observe**: Collect constraints, context, tool capabilities, and feedback signals
- **Assess**: Assess risk, guardrails, HITL trigger, and recoverability
- **Plan**: Define Harness pillar boundaries and acceptance gate
- **Execute**: Assemble eight pillars with unified Runtime
- **Feedback**: Return failure, human feedback, evaluation conclusions
- **Learn**: Form failure-to-learning and prompt/memory improvement candidates
- **Improve**: Advance pillar-level governance and replay capability enhancement
- **Release**: Include eight pillars in Ring 2 release-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

`§45` requires Harness to no longer be just a thin loop of planner/generator/evaluator, but to become a formal runtime object carrying constraints, tools, memory, feedback, durability, evaluation, HITL, and observability.

## Decision

Harness adopts fixed eight-pillar model:

1. Constraints
2. Tools
3. State / Memory
4. Feedback
5. Durability
6. Evaluation Harness
7. HITL Runtime
8. Observability / Replay

Supplementary constraints:

- The eighth pillar's release semantics are unified to对接 `ReleaseChannel` and `ReleaseDecisionView`, no longer using old `DeploymentSlot` as harness canonical release subject.
- In eight pillars, improvement promotion semantics all use `Release`, no longer falling back to old `Rollout` as top-level stage name.

Each pillar must have independent code entry, testing, and acceptance evidence; document description alone is not allowed.

## Consequences

- `src/platform/five-plane-orchestration/harness` must organize directories and export surface around eight pillars
- `Ring 2` acceptance must be拆解 by pillar
- Gaps in Harness during review use pillar as minimum remediation unit

## v4.3 ADR Remediation

- A-5: This ADR historically沿用 Improve/Release chain's `Rollout` terminology. Root cause: Harness acceptance gate and release control plane naming not timely synchronized到主architecture's `Release`口径. Fix: Body now explicitly requires eight pillars' improvement promotion semantics to uniformly use `Release`.
- A-12: This ADR originally沿用旧stage acceptance and deployment表达的历史语境. Root cause: Harness eight pillar ADR formed still夹带旧release implementation terminology. Fix: Body now explicitly aligns release subject to `ReleaseChannel` / `ReleaseDecisionView`, no longer treating `DeploymentSlot` as harness canonical release semantics.