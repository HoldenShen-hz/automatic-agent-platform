# HITL Experience And Explainability Contract

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-stage cycle:

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

This contract defines approval experience, human takeover experience, and critical decision explainability boundaries.

Related Documents:

- `approval_and_hitl_contract.md`
- `admin_console_and_human_takeover_contract.md`
- `policy_engine_contract.md`
- `control_vs_intelligence_boundary_contract.md`

## 2. Goals

- Reduce approval noise and improve human collaboration efficiency.
- Make human takeover not just "pause and wait for reply", but a formal operation surface.
- Enable enterprise users to understand critical routing, risk, and degradation decisions.

## 3. Approval Experience

The approval system supports at minimum:

- Same-type approval consolidation
- Batch approval
- Risk stratification display
- Default recommended explanations
- Approval policy caching

Decision presentation minimum structure:

- What happened
- Why it needs your decision
- What options are available
- Which one is recommended
- What happens if no response

Input collection suggestions:

- Option questions should support single-choice structure, rather than degrading all interactions to free text.
- Notes should be supplementary fields and must not cover the options themselves.
- If the user does not provide an answer, it should be explicitly recorded as `skipped` or equivalent semantics, rather than silently missing.
- In interactive UIs, option selection, note input, and submit/cancel focus state should be governed separately to reduce accidental touches.

## 4. Human Takeover Actions

- Manual context modification
- Manual replacement of `NodeAttempt` output
- Manual retry of specified `NodeRun` / `NodeAttempt`
- Manual worker specification
- Manual run mode degradation
- End task and archive reason
- Mark task as unrecoverable

## 5. Explainability Objects

- `DecisionExplanation`
- `RoutingExplanation`
- `RiskExplanation`
- `FallbackExplanation`
- `TakeoverJustification`

## 6. Explainability Requirements

The system can explain at minimum:

- Why this division was chosen
- Why HITL was escalated
- Why a certain command was rejected
- Why retry was judged necessary
- Why model / worker / provider was switched
- Why approval, rejection, or dual approval was given
- Why a certain feedback signal was adopted or ignored
- Why a certain improvement candidate was accepted or rejected
- Why rollout was advanced, paused, or rolled back

Permission / Policy explanation must contain at minimum:

- `reason_summary`
- `matched_rule_or_policy`
- `reason_source`
- `remediation_hint?`

Notes:

- `reason_source` must at least distinguish `policy bundle / project settings / local settings / runtime guard / manual override`.
- When explanation comes from rule masking, conservative rejection of unknown commands, or hook-forced escalation, should clearly tell the user "what rule caused the current result" and "where to go to correct it".

## 7. Approval and Takeover Boundaries

- Explainability must not change authoritative policy results; it only explains results.
- Human takeover actions must write audit and must not become "invisible backdoors" for bypassing policy.
- High-risk takeover actions should go through Policy Engine or break-glass process again.
- Read-only observation or viewer mode can display explanations but must not gain takeover, approval, or forced execution rights.

## 8. Closure Conclusion

Industrial-grade human-machine collaboration cannot just provide an approval button.

It must simultaneously provide:

- Noise-reduced approval experience
- Formal human takeover entry point
- Auditable, understandable critical decision explanations

Canonical runtime reference: HITL operations must bind to `NodeRun` and `NodeAttempt` and must not use old step-level identifiers as authoritative execution references.
