# Edit Replacement Chain Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage loop:

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

This contract defines the multi-level matching chain when edit / patch / replace tools locate old content and apply replacements.

Related documents:

- `tool_and_provider_execution_contract.md`
- `file_lock_contract.md`
- `tool_output_sanitization_contract.md`
- `idempotency_and_recovery_matrix_contract.md`

## 2. Objectives

Multi-level matching chain must simultaneously solve two types of problems:

- LLM-generated `old_string` has slight whitespace, indentation, newline deviations from real file.
- To improve success rate, cannot directly magnify fuzzy replacement into silent mischange risk.

## 3. Core Principles

- Matching chain must try in fixed order, stopping at first success.
- The more fuzzy the match level, the stricter the security constraints must be.
- Any non-exact replacement must leave warning and audit record.
- When cannot uniquely locate, must fail, not "guess a similar place."

## 4. EditReplacementAttempt

| Field | Type | Description |
| --- | --- | --- |
| `attempt_level` | `exact \| whitespace_normalized \| indentation_normalized \| fuzzy \| context_anchored` | Match level |
| `matched` | `boolean` | Whether successfully located |
| `candidate_count` | `number` | Candidate count |
| `similarity_score` | `number?` | Fuzzy match score |
| `warning_codes` | `string[]` | Risk hints |
| `applied_range` | `string?` | Change location |

## 5. Multi-Level Matching Chain

```mermaid
flowchart TD
    A["Input: file + old_string + new_string"] --> B["L1 Exact Match"]
    B -->|fail| C["L2 Whitespace Normalized"]
    C -->|fail| D["L3 Indentation Normalized"]
    D -->|fail| E["L4 Fuzzy Match"]
    E -->|fail| F["L5 Context Anchored Fuzzy"]
    F -->|fail| G["Return EditMismatch Error"]
    B -->|success| H["Apply Replacement"]
    C -->|success| H
    D -->|success| H
    E -->|success| H
    F -->|success| H
```

### 5.1 Level 1 `exact`

- Exact string matching
- No normalization
- If uniquely matched, apply directly

### 5.2 Level 2 `whitespace_normalized`

- Normalize consecutive whitespace
- Remove trailing whitespace differences
- Do not change semantic character order

### 5.3 Level 3 `indentation_normalized`

- Strip common indentation before matching
- Applicable to code block overall indentation changes
- Should preserve current indentation style of target file after replacement

### 5.4 Level 4 `fuzzy`

- Only attempted after levels 1-3 all fail
- Requires `similarity_score >= 0.85`
- Must have only one unique candidate
- Must record warning on success: `fuzzy_edit_applied`

### 5.5 Level 5 `context_anchored`

- First narrow candidate area using before/after anchors, then do fuzzy matching
- Only effective in unique anchor window
- Must record stronger warning on success: `anchored_fuzzy_edit_applied`

## 6. Currently Explicitly Not Doing

Phase 1a / 1b does not do:

- AST-aware replacement
- Tree-sitter level structured node locating
- Cross-file semantic rewriting

If these capabilities are to be introduced, should enter Phase 2 and separately add ADR or contract.

## 7. Security Constraints

- If multiple candidates appear for the same request, must fail and return conflict information.
- Any fuzzy success result should return warning for upper layer message or log to prompt human review.
- Multi-level matching chain is not allowed on binary / non-text files.
- Must hold `write` lock before applying replacement.

## 8. Error Semantics

Suggested stable error codes:

- `tool.edit_target_not_found`
- `tool.edit_multiple_candidates`
- `tool.edit_similarity_too_low`
- `tool.execution_failed`

Rules:

- Target not found and "found multiple targets" must report errors separately.
- Similarity below threshold should explicitly fail, not silently downgrade and apply.

## 9. Idempotency and Recovery

- If file content after replacement already equals expected result, can be treated as idempotent success.
- Before recovery retry, should re-read target file first, not directly reuse old candidate range.
- Retry at fuzzy / anchored level must not continue using old scores after file has changed.

## 10. Phase Boundary

Phase 1a does:

- `exact`
- `whitespace_normalized`
- `indentation_normalized`

Phase 1b does:

- `fuzzy`
- `context_anchored`

## 11. Closure Conclusion

Improving edit success rate cannot rely on "being bolder," but on a matching chain that tightens order, shows risks explicitly, and fails explainably.
