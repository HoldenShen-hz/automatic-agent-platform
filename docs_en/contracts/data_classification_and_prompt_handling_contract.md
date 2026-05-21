# Data Classification And Prompt Handling Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR 8-stage loop:

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

This contract defines data classification and whether data of different levels is permitted to enter prompts, logs, memory, and cross-worker transmission.

Related documents:

- `sandbox_and_auth_contract.md`
- `tool_output_sanitization_contract.md`
- `tenant_and_organization_contract.md`

## 2. Data Classification Levels

- `public`
- `internal`
- `confidential`
- `restricted`

## 3. Control Dimensions

Each level must constrain at minimum:

- Whether allowed to enter prompts
- Whether allowed to write logs
- Whether allowed cross-worker transmission
- Whether allowed to enter memory
- Whether allowed to enter Knowledge Plane
- Whether allowed to enter high-level memory (L5/L6)
- Whether allowed to enter feedback / learning objects
- Whether allowed to enter artifacts
- Whether allowed to enter debug / inspect
- How `taint_labels` propagate
- Whether field-level redaction report is required

## 4. Minimum Mapping Rules

| Level | prompt | logs | memory | artifact | cross-worker |
| --- | --- | --- | --- | --- | --- |
| `public` | allowed | allowed | allowed | allowed | allowed |
| `internal` | allowed | allowed after sanitization | allowed | allowed | controlled allowed |
| `confidential` | controlled allowed | default sanitization | controlled allowed | controlled allowed | default deny or minimize |
| `restricted` | default deny | default deny | default deny | controlled retention only | default deny |

## 5. Rules

- `restricted` must not directly enter prompts by default.
- High-risk tool outputs should first undergo structured extraction or summarization before deciding whether to enter the model.
- Data level changes must be auditable.
- `restricted` must not enter memory, debug dumps, or cross-worker transmission by default.
- If exception passage is required, the Policy Engine must provide an auditable decision.
- `restricted` must not enter Knowledge Plane or L5/L6 memory promotion by default.
- If `confidential` / `restricted` data enters `LearningObject` or `FeedbackSignal`, it must first be sanitized and retain classification provenance.

### 5.1 DataTaintPropagation Hard Rules

`DataTaintPropagationRecord` minimum fields:

- `input_data_classes`
- `max_input_data_class`
- `output_data_class`
- `taint_labels`
- `redaction_report_ref?`
- `desensitization_evidence_ref?`
- `reviewer_decision_ref?`

Hard Rules:

- The `output_data_class` of any output, artifact, memory candidate, tool result, summary, prompt execution record, delegation result, or explanation artifact must not be lower than the highest `data_class` in its input set.
- The only exception is when explicit sanitization proof, field-level `redaction_report`, and reviewer / policy evidence are all simultaneously available.
- `taint_labels` must propagate together with `ToolOutput`, `PromptExecutionRecord`, `MemoryWriteRequest`, `FeedbackSignal`, `LearningObject`, and explanation artifacts, and must not be lost at intermediate summary layers.
- If downstream objects lack taint propagation metadata, the system must fail-closed or conservatively elevate `output_data_class`, and must not default to degrading to `internal` or `public`.

### 5.2 Downgrade Proof Requirements

When allowing data level descent, at minimum retain:

- Which fields were deleted, masked, or generalized
- Which sanitization strategy was used
- Who approved the downgrade
- Corresponding policy / reviewer evidence reference

Rules:

- Any level descent without `redaction_report_ref` is considered a contract violation.
- `public` / `internal` summaries derived from `confidential` / `restricted` inputs must also retain auditable downgrade proof, not just check if the final text "looks safe".

## 6. Closure Conclusion

Not all text should be given directly to the model; data classification and prompt admission policy control are key pre-boundaries for long-term security and enterprise readiness.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-29: This document previously only defined "can a certain level enter prompt/log/memory" static tables, without defining taint propagation hard rules between input and output. Root cause: early data classification documentation focused on access matrices and omitted downgrade proof chains for derived objects such as summaries, tool results, and memory candidates. Fix: The main text now adds `DataTaintPropagationRecord` and explicitly states "output `data_class` must not be lower than the highest input level unless sanitization proof + redaction report + reviewer/policy evidence are all available".

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.