# ADR-091 Harness Eight Pillar Model

---

## OAPEFLIR Association

- **Observe**: Collect constraints, context, tool capabilities, and feedback signals
- **Assess**: Evaluate risk, guardrails, HITL triggers, and recoverability
- **Plan**: Define pillar boundaries and acceptance gates for Harness
- **Execute**: Assemble the eight pillars via a unified Runtime
- **Feedback**: Loop back failures, human feedback, and evaluation conclusions
- **Learn**: Generate failure-to-learning and prompt/memory improvement candidates
- **Improve**: Advance pillar-level governance and replay capability enhancements
- **Release**: Integrate the eight pillars into Ring 2 release-readiness acceptance gates

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

`§45` requires that Harness is no longer just a thin loop of planner/generator/evaluator, but must become a formal runtime object carrying constraints, tools, memory, feedback, persistence, evaluation, HITL, and observability.

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

- The release semantics of the eighth pillar are uniformly aligned with `ReleaseChannel` and `ReleaseDecisionView`, and the old `DeploymentSlot` is no longer used as the canonical release subject for harness.
- Improvement promotion semantics within the eight pillars uniformly use `Release`, and will no longer fall back to the old `Rollout` as the top-level phase name.

Each pillar must have independent code entry points, tests, and acceptance evidence; documentation-only descriptions are not permitted.

## Consequences

- `src/platform/orchestration/harness` must organize directories and export surfaces around the eight pillars
- `Ring 2` acceptance must be broken down by pillar
- Gaps in Harness during review use pillar as the minimum remediation unit

## v4.3 ADR Remediation

- A-5: This ADR historically followed the `Rollout` terminology in the Improve/Release chain. The root cause was that the harness acceptance gate and release control plane naming were not synchronized with the main architecture's `Release` terminology in time. Fix: The body now explicitly requires that improvement promotion semantics within the eight pillars uniformly use `Release`.
- A-12: This ADR originally followed historical terminology for stage acceptance and deployment expressions. The root cause was that when the harness eight-pillar ADR was formed, old release implementation terminology was still mixed in. Fix: The body now explicitly aligns the release subject with `ReleaseChannel` / `ReleaseDecisionView`, and no longer uses `DeploymentSlot` as the harness canonical release semantics.
