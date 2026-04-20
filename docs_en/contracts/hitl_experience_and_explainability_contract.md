# HITL Experience And Explainability Contract

---

## OAPEFLIR Related

This contract participates in the following stages of the OAPEFLIR 8-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution evaluation and risk assessment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines approval experience, human takeover experience, and key decision explainability boundaries.

Related Documents:

- `approval_and_hitl_contract.md`
- `admin_console_and_human_takeover_contract.md`
- `policy_engine_contract.md`
- `control_vs_intelligence_boundary_contract.md`

## 2. Goals

- Reduce approval noise and improve human collaboration efficiency.
- Make human takeover not just "pause and wait for reply", but a formal operation surface.
- Enable enterprise users to understand key routing, risk, and degradation decisions.

## 3. Approval Experience

Approval system supports at minimum:

- Same-type approval consolidation
- Batch approval
- Risk tiered display
- Default recommendation explanation
- Approval strategy caching

Decision presentation minimum structure:

- What happened
- Why it needs your decision
- What options exist
- Which is recommended
- What happens if no response

Input collection recommendations:

- Option questions should support single-choice structure, rather than degrading all interactions to free text.
- Notes should be supplementary fields, not override the options themselves.
- If user does not provide answer, should explicitly record as `skipped` or equivalent semantics, not silently missing.
- In interactive UI, should separately govern option selection, notes input, submit/cancel focus state to reduce accidental triggers.

## 4. Human Takeover Actions

- Manually modify context
- Manually replace step output
- Manually retry specified step
- Manually specify worker
- Manually degrade running mode
- End task and archive reason
- Mark task unrecoverable

## 5. Explainability Objects

- `DecisionExplanation`
- `RoutingExplanation`
- `RiskExplanation`
- `FallbackExplanation`
- `TakeoverJustification`

## 6. Explainability Requirements

System can explain at minimum:

- Why this division was chosen
- Why HITL escalation occurred
- Why a certain command was rejected
- Why retry was determined
- Why model / worker / provider was switched
- Why approval, rejection, or dual approval was determined
- Why a certain feedback signal was adopted or ignored
- Why a certain improvement candidate was accepted or rejected
- Why rollout was advanced, paused, or rolled back

Permission / policy explanation minimum must include:

- `reason_summary`
- `matched_rule_or_policy`
- `reason_source`
- `remediation_hint?`

Notes:

- `reason_source` at minimum distinguishes `policy bundle / project settings / local settings / runtime guard / manual override`.
- When explanation comes from rule shadowing, unknown command conservative rejection, or hook forced upgrade, should explicitly tell user "what rule caused current result" and "where to go to correct".

## 7. Approval And Takeover Boundary

- Explainability should not change authoritative policy result; it only explains result.
- Human takeover actions must write audit; must not become "bypass policy" without trace.
- High-risk takeover actions should again go through Policy Engine or break-glass process.
- Read-only observation or viewer mode can display explanations, but must not obtain takeover, approval, or force execution rights.

## 8. Closure Conclusion

Industrial-grade human-machine collaboration cannot only provide an approval button.

It must simultaneously provide:

- Noise-reduced approval experience
- Formal human takeover entry
- Auditable, understandable key decision explanations