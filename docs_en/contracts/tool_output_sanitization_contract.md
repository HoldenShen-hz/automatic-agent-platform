# Tool Output Sanitization Contract

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

This contract defines the unified sanitization pipeline that all external tool outputs must pass through before entering messages, logs, events, and artifact indexes.

Related documents:

- `tool_and_provider_execution_contract.md`
- `gateway_streaming_contract.md`
- `observability_contract.md`
- `policy_engine_contract.md`

## 2. Objectives

The unified sanitization pipeline must at least address:

- ANSI / control character contamination of output
- Overlong output dragging down context windows
- Sensitive information leakage such as credentials, tokens, cookies
- Prompt injection fragments flowing unmarked into upstream summarization

## 3. `SanitizedToolOutput`

| Field | Type | Description |
| --- | --- | --- |
| `raw_ref` | `string?` | Raw output reference |
| `sanitized_text` | `string` | Sanitized text body |
| `truncated` | `boolean` | Whether truncated |
| `redaction_count` | `number` | Redaction count |
| `control_chars_removed` | `number` | Control characters removed count |
| `ansi_removed` | `boolean` | Whether ANSI removed |
| `injection_risk` | `none \| low \| medium \| high` | Injection risk rating |
| `warnings` | `string[]` | Sanitization warnings |
| `knowledge_ref` | `string?` | If output enters knowledge chain, corresponding knowledge reference |
| `memory_ref` | `string?` | If output enters memory chain, corresponding memory reference |

## 4. Pipeline Order

```mermaid
flowchart LR
    A["Raw Tool Output"] --> B["Strip ANSI"]
    B --> C["Remove Control Chars"]
    C --> D["Secret Redaction"]
    D --> E["Normalize Newlines / Tags"]
    E --> F["Length Truncation"]
    F --> G["Injection Risk Marking"]
    G --> H["Persist + Return Sanitized Output"]
```

Rules:

- Order must not be reversed; sanitization before truncation avoids sensitive information just happening to fall in the preserved window.
- Raw large output can be archived as artifact, but upper layer messages / summaries read the sanitized version by default.
- If raw output contains high-risk sensitive information, artifact preservation also requires access control and scope tagging.

## 5. Minimum Sanitization Actions

- Remove ANSI color codes
- Remove illegal control characters
- Normalize newlines and trailing whitespace
- Redact common credential patterns
- Truncate when exceeding threshold, preserving beginning and end summary
- Mark obvious prompt injection fragments

## 6. Length Strategy

Recommend maintaining two types of thresholds simultaneously:

- `stream_preview_limit_chars`
- `persisted_message_limit_chars`

Rules:

- Streaming preview can be shorter; persisted summary can be slightly longer.
- Truncated body should be accompanied by `raw_ref` or artifact reference for subsequent manual review.

## 7. Injection Risk Marking

Must recognize at least the following patterns:

- Requests to ignore system instructions
- Requests to leak credentials
- Requests to execute unauthorized actions
- Obvious attempts to disguise as system messages or tool protocols

Rules:

- Risk marking does not equal automatic rejection; it is handed to Policy Engine and upper-layer summarization logic for further processing.
- `high` risk output must not be used as the sole input fragment for subsequent LLMs.
- Output judged as `high` risk should not directly enter memory by default.

## 8. Storage and Display Boundaries

- `messages.content` stores sanitized results, not raw polluted text by default.
- If raw output needs to be preserved, it should go to artifact with access control tagging.
- Events, logs, and summaries record sanitized results or their summaries by default.
- Debug dump reads sanitized version by default; if raw output truly needs to be viewed, it should be protected by higher privileges and additional audit.
- If output subsequently enters knowledge / memory / feedback chain, must preserve provenance marking, and must not disguise sanitized text as "native internal text".

## 9. Current / Transition Boundaries

Current canonical baseline explicitly does:

- ANSI cleanup
- Control character cleanup
- Credential redaction
- Length truncation
- Injection risk classification

Transition / target-state extensions currently do not do:

- Full DLP engine
- Multi-language deep semantic sensitive information detection
- Enterprise content review workflow

## 10. Closure Conclusion

Tool output is not a "safe object that can be directly fed back to the model" upon receipt; the sanitization pipeline is the first gate that transforms external text into trusted platform internal input.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-52: This document originally continued using `Phase 1a` as current capability boundary term. Root cause: sanitization contract沿用了旧排期文案 (adopted old scheduling language), did not change to `Current / Transition / Target` expression as the main architecture dropped `Phase 1-9` to historical mapping. Fix: This version changes to `Current / Transition` boundary semantics, old phase names no longer serve as canonical capability expression.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
