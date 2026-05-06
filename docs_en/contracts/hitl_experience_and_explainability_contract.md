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
- **Improve**: Improvement candidate evaluation and release
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines approval experience, human takeover experience, and key decision explainability boundaries.

Related documents:

- `approval_and_hitl_contract.md`
- `admin_console_and_human_takeover_contract.md`
- `policy_engine_contract.md`
- `control_vs_intelligence_boundary_contract.md`

## 2. Goals

- Reduce approval noise and improve human collaboration efficiency.
- Make human takeover not just "pause and wait for response", but a formal operation surface.
- Enable enterprise users to understand key routing, risk, and degradation decisions.

## 3. Approval Experience

Approval system supports at minimum:

- Same-type approval consolidation
- Batch approval
- Risk-layered display
- Default recommended explanations
- Approval strategy caching

Decision presentation minimum structure:

- What happened
- Why it needs your decision
- What options are available
- Which is recommended
- What happens if no response

Input collection suggestions:

- Option questions should support single-choice structure rather than degrading all interactions to free text.
- Notes should be supplementary fields rather than overriding the options themselves.
- If user does not provide an answer, should explicitly record as `skipped` or equivalent semantics rather than silent missing.
- In interactive UI, option selection, notes input, and submit/cancel focus states should be governed separately to reduce accidental touches.

## 4. Human Takeover Actions

- Manually modify context
- Manually replace step output
- Manually retry specified step
- Manually specify worker
- Manually degrade run mode
- End task and archive reason
- Mark task as unrecoverable

## 5. Explainability Objects

- `DecisionExplanation`
- `RoutingExplanation`
- `RiskExplanation`
- `FallbackExplanation`
- `TakeoverJustification`

## 6. Explainability Requirements

System can explain at minimum:

- Why this division was chosen
- Why HITL was escalated
- Why a certain command was denied
- Why retry was judged
- Why model / worker / provider was switched
- Why approved, denied, or requiring dual approval
- Why a certain feedback signal was adopted or ignored
- Why a certain improvement candidate was accepted or denied
- Why release was promoted, paused, or rolled back

Permission / policy explanation minimum should include:

- `reason_summary`
- `matched_rule_or_policy`
- `reason_source`
- `remediation_hint?`

Notes:

- `reason_source` at minimum distinguishes `policy bundle / project settings / local settings / runtime guard / manual override`.
- When explanation comes from rule masking, unknown command conservative denial, or hook forced escalation, should explicitly tell user "what rule caused the current result" and "where to go to correct it".

## 7. Approval and Takeover Boundaries

- Explainability must not change authoritative policy results; it only explains results.
- Human takeover actions must write audit and must not become "bypass policy" without trace.
- High-risk takeover actions should again go through Policy Engine or break-glass process.
- Read-only observation or viewer mode can display explanations but must not obtain takeover, approval, or forced execution rights.

## 8. Conclusion

Industrial-grade human-machine collaboration cannot only provide an approval button.

It must simultaneously provide:

- Noise-reduced approval experience
- Formal human takeover entry
- Audit-able and understandable key decision explanations

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- R16-86: This contract defines HITL approval and human takeover but does not explicitly require takeover actions to anchor on v4.3 canonical entity. Fix: The text now explicitly requires human takeover actions to act on `HarnessRun` / `NodeRun` / `NodeAttempt`, must not use old `execution_id` / `step_id` as authoritative scope; approval display `task_id` must be mappable to corresponding `harness_run_id`.

Mandatory rules: All takeover actions that change run state must go through `RuntimeStateMachine.transition(command)` with `harness_run_id` / `node_run_id` scope; `DecisionExplanation` / `TakeoverJustification` must reference v4.3 canonical entity and must not reference old `TaskRecord` / `ExecutionReceipt` as truth source.
