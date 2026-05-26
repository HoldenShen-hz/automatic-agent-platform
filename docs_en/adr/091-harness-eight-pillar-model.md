# ADR-091 Harness Eight Pillar Model

---

## OAPEFLIR Association

- **Observe**: Collect constraints, context, tool capabilities, and feedback signals
- **Assess**: Evaluate risk, guardrails, HITL triggers, and recoverability
- **Plan**: Define Harness pillar boundaries and acceptance gates
- **Execute**: Assemble eight pillars with unified Runtime
- **Feedback**: Feed back failure, human feedback, evaluation conclusions
- **Learn**: Form failure-to-learning and prompt/memory improvement candidates
- **Improve**: Advance pillar-level governance and replay capability enhancement
- **Release**: Include eight pillars in Ring 2 release-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

`§45` requires Harness to no longer be just a thin loop of planner/generator/evaluator, but to become a formal runtime object carrying constraints, tools, memory, feedback, persistence, evaluation, HITL, and observability.

## Decision

Harness adopts fixed eight pillar model:

1. Constraints
2. Tools
3. State / Memory
4. Feedback
5. Durability
6. Evaluation Harness
7. HITL Runtime
8. Observability / Replay

Supplementary constraints:

- The eighth pillar's release semantics are uniformly connected to `ReleaseChannel` and `ReleaseDecisionView`, no longer using old `DeploymentSlot` as harness canonical release subject.
- Improvement promotion semantics across the eight pillars uniformly use `Release`, no longer retreating to old `Rollout` as top-level stage name.

Each pillar must have independent code entry, tests, and acceptance evidence, cannot exist with just documentation description.

## Consequences

- `src/platform/five-plane-orchestration/harness` must organize directories and export surface around eight pillars
- Ring 2 acceptance must be broken down by pillar
- Gaps in Harness during review use pillar as minimum remediation unit

## v4.3 ADR Remediation

- A-5: This ADR historically used `Rollout` terminology in Improve/Release chain, root cause being harness acceptance gate and release control plane naming not timely synchronized to main architecture's `Release`口径. Fix: Main text now explicitly requires improvement promotion semantics across eight pillars to uniformly use `Release`.
- A-12: This ADR originally followed old stage acceptance and deployment expression historical context, root cause being harness eight pillar ADR formed still mixed old release implementation terminology. Fix: Main text now explicitly aligns release subject to `ReleaseChannel` / `ReleaseDecisionView`, no longer treating `DeploymentSlot` as harness canonical release semantics.
