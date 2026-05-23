# ADR-091 Harness Eight Pillar Model

---

## OAPEFLIR Association

- **Observe**: Collect constraints, context, tool capabilities, and feedback signals
- **Assess**: Evaluate risk, guardrails, HITL trigger, and recoverability
- **Plan**: Define Harness pillar boundaries and acceptance gates
- **Execute**: Assemble eight pillars with unified Runtime
- **Feedback**: Streamline failure, human feedback, evaluation conclusions
- **Learn**: Form failure-to-learning and prompt/memory improvement candidates
- **Improve**: Advance pillar-level governance and replay capability enhancement
- **Release**: Include eight pillars in Ring 2 release-readiness acceptance gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

`§45` requires Harness to no longer be just a thin loop of planner/generator/evaluator, but to become a formal runtime object bearing constraints, tools, memory, feedback, durability, evaluation, HITL, and observability.

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

- The eighth pillar's release semantics are uniformly connected to `ReleaseChannel` and `ReleaseDecisionView`, and no longer use旧 `DeploymentSlot` as harness canonical release主语.
- Improvement promotion semantics among the eight pillars all use `Release`, and no longer fall back to旧 `Rollout` as top-level phase name.

Each pillar must have independent code entry, testing, and acceptance evidence, and cannot exist only in documentation description.

## Consequences

- `src/platform/five-plane-orchestration/harness` must organize directories and export surface around eight pillars
- Ring 2 acceptance must be broken down by pillar
- Harness gaps in review use pillar as minimum remediation unit

## v4.3 ADR Remediation

- A-5: This ADR historically used the Improve/Release link's `Rollout` discourse,根因 was that harness acceptance gate and release control plane naming were not timely synchronized to主架构's `Release`口径. Fix: The text now explicitly requires that improvement promotion semantics among the eight pillars uniformly use `Release`.
- A-12: This ADR originally followed the old phase acceptance and deployment expression's历史语境,根因 was that harness eight-pillar ADR formation still mixed旧 release implementation terminology. Fix: The text now explicitly aligns the release主语 to `ReleaseChannel` / `ReleaseDecisionView`, and no longer uses `DeploymentSlot` as harness canonical release semantics.
