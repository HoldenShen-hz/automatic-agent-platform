# ADR-091 Harness Eight Pillar Model

---

## OAPEFLIR Association

- **Observe**: Collect constraint, context, tool capability, and feedback signals
- **Assess**: Evaluate risk, guardrails, HITL trigger, and recoverability
- **Plan**: Define Harness pillar boundaries and acceptance gates
- **Execute**: Assemble eight pillars with unified Runtime
- **Feedback**: Feed back failure, human feedback, and evaluation conclusions
- **Learn**: Form failure-to-learning and prompt/memory improvement candidates
- **Improve**: Advance pillar-level governance and replay capability enhancement
- **Release**: Incorporate eight pillars into Ring 2 release-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

`§45` requires that Harness no longer be just a thin loop of planner/generator/evaluator, but must become a formal runtime object carrying constraints, tools, memory, feedback, durability, evaluation, HITL, and observability.

## Decisions

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

- The release semantics of pillar eight are uniformly connected to `ReleaseChannel` and `ReleaseDecisionView`; the old `DeploymentSlot` is no longer used as the harness canonical release subject.
- Improvement promotion semantics among the eight pillars uniformly use `Release`, and will not regress to the old `Rollout` as the top-level stage name.

Each pillar must have an independent code entry, tests, and acceptance evidence; documentation-only descriptions are not allowed.

## Consequences

- `src/platform/orchestration/harness` must organize directories and export surface around the eight pillars
- `Ring 2` acceptance must be broken down by pillar
- Gaps in Harness identified during review use pillar as the minimum remediation unit

## v4.3 ADR Remediation

- A-5: This ADR historically followed the `Rollout` terminology in the Improve/Release chain, because the harness acceptance gate and release control plane naming were not synchronized to the main architecture's `Release` terminology in time. Fix: The main text now explicitly requires unified use of `Release` for improvement promotion semantics among the eight pillars.
- A-12: This ADR originally followed the historical context of old stage acceptance and deployment expressions, because when the harness eight-pillar ADR was formed, it still carried old release implementation terminology. Fix: The main text now explicitly aligns the release subject to `ReleaseChannel` / `ReleaseDecisionView`, and no longer uses `DeploymentSlot` as harness canonical release semantics.
