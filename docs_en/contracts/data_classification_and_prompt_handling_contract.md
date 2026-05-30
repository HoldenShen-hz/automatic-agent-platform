# Data Classification And Prompt Handling Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage loop:

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

This contract defines data classification and whether different classification levels are allowed to enter prompts, logs, memory, or cross-worker transmission.

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

Each classification level must約束 (constrain) at minimum:

- Whether it is allowed to enter prompts
- Whether it is allowed to write logs
- Whether it is allowed to cross-worker transmission
- Whether it is allowed to enter memory
- Whether it is allowed to enter Knowledge Plane
- Whether it is allowed to enter high-level memory (L5/L6)
- Whether it is allowed to enter feedback / learning objects
- Whether it is allowed to enter artifacts
- Whether it is allowed to enter debug / inspect
- How `taint_labels` propagate
- Whether field-level redaction report is required

## 4. Minimum Mapping Rules

| Level | Prompt | Logs | Memory | Artifact | Cross-Worker |
| --- | --- | --- | --- | --- | --- |
| `public` | Allowed | Allowed | Allowed | Allowed | Allowed |
| `internal` | Allowed | Allowed after desensitization | Allowed | Allowed | Controlled allowed |
| `confidential` | Controlled allowed | Default to desensitized | Controlled allowed | Controlled allowed | Default to denied or minimized |
| `restricted` | Default to denied | Default to denied | Default to denied | Controlled retention only | Default to denied |

## 5. Rules

- `restricted` data must not directly enter prompts by default.
- High-risk tool outputs should undergo structured extraction or summarization before deciding whether to enter the model.
- Data classification changes must be auditable.
- `restricted` data must not enter memory, debug dumps, or cross-worker transmission by default.
- Exceptions require a auditable decision from the Policy Engine.
- `restricted` data must not enter Knowledge Plane or L5/L6 memory promotion by default.
- `confidential` / `restricted` data entering `LearningObject` or `FeedbackSignal` must first be desensitized with classification provenance retained.

### 5.1 DataTaintPropagation Hard Rules

`DataTaintPropagationRecord` minimum fields:

- `input_data_classes`
- `max_input_data_class`
- `output_data_class`
- `taint_labels`
- `redaction_report_ref?`
- `desensitization_evidence_ref?`
- `reviewer_decision_ref?`

Hard rules:

- The `output_data_class` of any output, artifact, memory candidate, tool result, summary, prompt execution record, delegation result, or explanation artifact must not be lower than the highest `data_class` in its input set.
- The only exception is when explicit desensitization proof, field-level `redaction_report`, and reviewer / policy evidence are all present.
- `taint_labels` must propagate alongside `ToolOutput`, `PromptExecutionRecord`, `MemoryWriteRequest`, `FeedbackSignal`, `LearningObject`, and explanation artifacts, and must not be lost at intermediate summarization layers.
- If downstream objects lack taint propagation metadata, the system must fail-closed or conservatively elevate `output_data_class`, and must not default to downgrading to `internal` or `public`.

### 5.2 Downgrade Proof Requirements

When data classification is allowed to decrease, the following must be retained:

- Which fields were deleted, masked, or generalized
- Which desensitization strategy was used
- Who approved the downgrade
- Corresponding policy / reviewer evidence references

Rules:

- Any classification downgrade without `redaction_report_ref` is a contract violation.
- `public` / `internal` summaries derived from `confidential` / `restricted` inputs must also retain auditable downgrade proof, not just check if the final text "looks safe".

## 6. Closure Conclusion

Not all text should be given directly to the model; data classification and model-entry policy control are key pre-boundaries for long-term security and enterprise readiness.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If earlier sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-29: This document originally only defined a static table of "whether a certain level can enter prompt/log/memory", without defining taint propagation hard rules between input and output. Root cause: Early data classification documents focused on access matrices, omitting downgrade proof chains for derived objects such as summaries, tool results, and memory candidates. Fix: The main text now includes `DataTaintPropagationRecord` and clarifies "output `data_class` must not be lower than the highest input level unless desensitization proof + redaction report + reviewer/policy evidence are all present".

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only appear as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.