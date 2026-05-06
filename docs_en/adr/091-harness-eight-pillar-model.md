# ADR-091 Harness Eight Pillar Model

---

## OAPEFLIR Association

- **Observe**: Collect constraints, context, tool capabilities, and feedback signals
- **Assess**: Evaluate risk, guardrails, HITL triggers, and recoverability
- **Plan**: Define Harness pillar boundaries and acceptance gates
- **Execute**: Assemble eight pillars with unified Runtime
- **Feedback**: Flow back failures, human feedback, and evaluation conclusions
- **Learn**: Form failure-to-learning and prompt/memory improvement candidates
- **Improve**: Advance pillar-level governance and replay capability enhancement
- **Release**: Incorporate eight pillars into Ring 2 release-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

`§45` requires that Harness is no longer just a thin loop of planner/generator/evaluator, but must become a formal runtime object carrying constraints, tools, memory, feedback, persistence, evaluation, HITL, and observability.

## Decision

Harness adopts a fixed eight pillar model:

1. Constraints
2. Tools
3. State / Memory
4. Feedback
5. Durability
6. Evaluation Harness
7. HITL Runtime
8. Observability / Replay

Supplementary constraints:

- The release semantics of the eighth pillar uniformly connect to `ReleaseChannel` and `ReleaseDecisionView`, and the old `DeploymentSlot` is no longer used as the harness canonical release subject.
- Improvement promotion semantics in all eight pillars uniformly use `Release`, and will not fall back to the old `Rollout` as the top-level stage name.

Each pillar must have independent code entry points, tests, and acceptance evidence; documentation descriptions alone are not sufficient.

## Consequences

- `src/platform/orchestration/harness` must organize directories and export surfaces around the eight pillars
- Ring 2 acceptance must be broken down by pillar
- Gaps in Harness during review use pillar as the minimum remediation unit

## v4.3 ADR Remediation

- A-5: This ADR historically used the `Rollout` terminology in the Improve/Release pipeline, because the harness acceptance gate and release control surface naming were not timely synchronized to the main architecture's `Release` terminology. Fix: The main text now explicitly requires unified use of `Release` for improvement promotion semantics across all eight pillars.
- A-12: This ADR originally followed historical context of stage acceptance and deployment expressions, because when the harness eight pillar ADR was formed, it still carried old release implementation terminology. Fix: The main text now explicitly aligns the release subject to `ReleaseChannel` / `ReleaseDecisionView`, and no longer uses `DeploymentSlot` as harness canonical release semantics.
