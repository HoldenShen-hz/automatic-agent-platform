# HITL Experience And Explainability Contract

## 1. Scope

This contract defines approval experience, human takeover experience, and key decision explainability boundaries.

Related documents:

- `approval_and_hitl_contract.md`
- `admin_console_and_human_takeover_contract.md`
- `policy_engine_contract.md`
- `control_vs_intelligence_boundary_contract.md`

## 2. Goals

- Reduce approval noise and improve human collaboration efficiency.
- Make human takeover not just "pause and wait for response" but a formal operation surface.
- Enable enterprise users to understand key routing, risk, and degradation decisions.

## 3. Approval Experience

Approval system at minimum supports:

- Same-type approval merging
- Batch approval
- Risk tiered display
- Default recommendation explanation
- Approval policy caching

Decision presentation minimum structure:

- What happened
- Why it needs your decision
- What options are available
- Which is recommended
- What happens if no response

Input collection suggestions:

- Option questions should support single-choice structure rather than degrading all interactions to free text.
- Notes should be supplementary fields rather than overwriting the options themselves.
- If user does not provide an answer, should explicitly record as `skipped` or equivalent semantics rather than silently missing.
- In interactive UI, option selection, note input, and submit/cancel focus states should be governed separately to reduce accidental triggers.

## 4. Human Takeover Actions

- Manually change context
- Manually replace step output
- Manually retry specified step
- Manually specify worker
- Manually degrade execution mode
- End task and archive reason
- Mark task unrecoverable

## 5. Explainability Objects

- `DecisionExplanation`
- `RoutingExplanation`
- `RiskExplanation`
- `FallbackExplanation`
- `TakeoverJustification`

## 6. Explainability Requirements

System at minimum can explain:

- Why this division was chosen
- Why HITL was escalated
- Why a certain command was rejected
- Why retry was determined
- Why model / worker / provider was switched
- Why approval, rejection, or double approval was required
- Why a certain feedback signal was adopted or ignored
- Why a certain improvement candidate was accepted or rejected
- Why rollout was advanced, paused, or rolled back

Permission / policy explanation at minimum should include:

- `reason_summary`
- `matched_rule_or_policy`
- `reason_source`
- `remediation_hint?`

Note:

- `reason_source` at minimum distinguishes `policy bundle / project settings / local settings / runtime guard / manual override`.
- When explanation comes from rule shadowing, unknown command conservative rejection, or hook forced escalation, should clearly tell user "what rule led to the current result" and "where to go to correct it."

## 7. Approval and Takeover Boundary

- Explainability must not change authoritative policy results; it only explains results.
- Human takeover actions must write audit and must not become "backdoors to bypass policies."
- High-risk takeover actions should again go through Policy Engine or break-glass process.
- Read-only observation or viewer mode can display explanations but must not obtain takeover, approval, or forced execution rights.

## 8. Closure Conclusion

Industrial-grade human-machine collaboration cannot just provide an approval button.

It must simultaneously provide:

- Noise-reduced approval experience
- Formal human takeover entry
- Auditable and understandable key decision explanations
