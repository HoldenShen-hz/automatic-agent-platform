# Data Classification And Prompt Handling Contract

## 1. Scope

This contract defines data classification and whether different levels of data are allowed to enter prompts, logs, memory, or cross-worker transmission.

Related documents:

- `sandbox_and_auth_contract.md`
- `tool_output_sanitization_contract.md`
- `tenant_and_organization_contract.md`

## 2. Data Classification

- `public`
- `internal`
- `confidential`
- `restricted`

## 3. Control Dimensions

Each level must at minimum constrain:

- Whether allowed to enter prompt
- Whether allowed to write logs
- Whether allowed for cross-worker transmission
- Whether allowed to enter memory
- Whether allowed to enter Knowledge Plane
- Whether allowed to enter high-layer memory (L5/L6)
- Whether allowed to enter feedback / learning objects
- Whether allowed to enter artifacts
- Whether allowed to enter debug / inspect

## 4. Minimum Mapping Rules

| Level | Prompt | Logs | Memory | Artifact | Cross-Worker |
| --- | --- | --- | --- | --- | --- |
| `public` | Allowed | Allowed | Allowed | Allowed | Allowed |
| `internal` | Allowed | Allowed after sanitization | Allowed | Allowed | Controlled allowed |
| `confidential` | Controlled allowed | Sanitized by default | Controlled allowed | Controlled allowed | Denied by default or minimized |
| `restricted` | Denied by default | Denied by default | Denied by default | Retained only with control | Denied by default |

## 5. Rules

- `restricted` must not directly enter prompt by default.
- High-risk tool outputs should first do structured extraction or summarization, then decide whether to enter the model.
- Data level changes must be auditable.
- `restricted` must not enter memory, debug dump, or cross-worker transmission by default.
- If exceptions need to be released, Policy Engine must provide auditable decisions.
- `restricted` must not enter Knowledge Plane or L5/L6 memory promotion by default.
- If `confidential` / `restricted` data enters `LearningObject` or `FeedbackSignal`, it must first be sanitized and classification provenance preserved.

## 6. Closure Conclusion

Not all text should be directly given to the model; data classification and model-entry strategy control are key pre-boundaries for long-term security and enterprise readiness.
