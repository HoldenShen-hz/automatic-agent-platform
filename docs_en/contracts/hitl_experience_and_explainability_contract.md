# HITL Experience And Explainability Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines approval experience, human takeover experience, and key decision explainability boundaries.

Related documents:

- `approval_and_hitl_contract.md`
- `admin_console_and_human_takeover_contract.md`
- `policy_engine_contract.md`
- `control_vs_intelligence_boundary_contract.md`

## 2. Objectives

- Reduce approval noise and improve human collaboration efficiency.
- Make human takeover not just "pause and wait for reply", but a formal operation surface.
- Enable enterprise users to understand key routing, risk, and degradation decisions.

## 3. Approval Experience

Approval system must support at minimum:

- Same-type approval merging
- Batch approval
- Risk-layered display
- Default recommendation explanation
- Approval policy caching

Decision presentation minimum structure:

- What happened
- Why you need to decide
- What options are available
- Which is recommended
- What happens if no response

Input collection suggestions:

- Option questions should support single-select structure, rather than degrading all interactions to free text.
- Notes should be auxiliary fields, not overriding the options themselves.
- If user does not provide an answer, should explicitly record as `skipped` or equivalent semantics, rather than silent absence.
- In interactive UI, option selection, notes input, submit/cancel focus states should be governed separately to reduce accidental triggers.

## 4. Human Takeover Actions

- Manually modify context
- Manually replace step output
- Manually retry specified step
- Manually specify worker
- Manually degrade running mode
- End task and archive reason
- Mark task as unrecoverable

## 5. Explainability Objects

- `DecisionExplanation`
- `RoutingExplanation`
- `RiskExplanation`
- `FallbackExplanation`
- `TakeoverJustification`

## 6. Explainability Requirements

System must at minimum explain:

- Why this division was chosen
- Why HITL was escalated
- Why a certain command was rejected
- Why retry was determined
- Why model / worker / provider was switched
- Why approved, rejected, or requiring dual approval
- Why a certain feedback signal was adopted or ignored
- Why a certain improvement candidate was accepted or rejected
- Why rollout was advanced, paused, or rolled back

Permission / policy explanation minimum must include:

- `reason_summary`
- `matched_rule_or_policy`
- `reason_source`
- `remediation_hint?`

Notes:

- `reason_source` must at minimum distinguish `policy bundle / project settings / local settings / runtime guard / manual override`.
- When explanation comes from rule masking, conservative rejection of unknown commands, or hook-forced escalation, should explicitly tell user "what rule caused the current result" and "where to go to fix it".

## 7. Approval and Takeover Boundaries

- Explainability must not change authoritative policy results; it only explains results.
- Human takeover actions must write audit, must not become "bypass policy" invisible backdoor.
- High-risk takeover actions should again go through Policy Engine or break-glass process.
- Read-only observation or viewer mode can display explanations, but must not obtain takeover, approval, or enforcement rights.

## 8. Conclusion

Industrial-grade human-machine collaboration cannot only provide an approval button.

It must simultaneously provide:

- Noise-reduced approval experience
- Formal human takeover entry
- Auditable, understandable key decision explanations
