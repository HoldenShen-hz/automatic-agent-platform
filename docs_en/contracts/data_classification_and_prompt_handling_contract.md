# Data Classification And Prompt Handling Contract

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

Each classification level must constrain at minimum:

- Whether it is allowed to enter prompts
- Whether it is allowed to be written to logs
- Whether it is allowed to be transmitted cross-worker
- Whether it is allowed to enter memory
- Whether it is allowed to enter the Knowledge Plane
- Whether it is allowed to enter high-level memory (L5/L6)
- Whether it is allowed to enter feedback / learning objects
- Whether it is allowed to enter artifacts
- Whether it is allowed to enter debug / inspect

## 4. Minimum Mapping Rules

| Classification | Prompt | Logs | Memory | Artifact | Cross-Worker |
| --- | --- | --- | --- | --- | --- |
| `public` | Allowed | Allowed | Allowed | Allowed | Allowed |
| `internal` | Allowed | Allowed after sanitization | Allowed | Allowed | Controlled allow |
| `confidential` | Controlled allow | Sanitized by default | Controlled allow | Controlled allow | Denied by default or minimized |
| `restricted` | Denied by default | Denied by default | Denied by default | Controlled retention only | Denied by default |

## 5. Rules

- `restricted` must not directly enter prompts by default.
- High-risk tool outputs should first undergo structured extraction or summarization before deciding whether to input to the model.
- Data classification changes must be auditable.
- `restricted` must not enter memory, debug dumps, or cross-worker transmission by default.
- If exceptions are needed, the Policy Engine must provide an auditable decision.
- `restricted` must not enter the Knowledge Plane or L5/L6 memory promotion by default.
- If `confidential` / `restricted` data enters `LearningObject` or `FeedbackSignal`, it must first be sanitized and retain classification provenance.

## 6. Conclusion

Not all text should be given directly to the model; data classification and model-input strategy control are key pre-boundaries for long-term security and enterprise readiness.