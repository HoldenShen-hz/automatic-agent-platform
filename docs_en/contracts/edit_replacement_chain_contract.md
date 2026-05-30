# Edit Replacement Chain Contract

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

This contract defines the multi-level matching chain for `edit / patch / replace` tools when locating old content and applying replacements.

Related documents:

- `tool_and_provider_execution_contract.md`
- `file_lock_contract.md`
- `tool_output_sanitization_contract.md`
- `idempotency_and_recovery_matrix_contract.md`

## 2. Goals

Multi-level matching chain must simultaneously solve two types of problems:

- LLM-generated `old_string` has slight whitespace, indentation, or newline deviations from the actual file.
- To improve success rate, fuzzy replacement cannot be amplified into silent mis modification risk.

## 3. Core Principles

- Matching chain must try in fixed order, stopping at first success.
- The more fuzzy the matching level, the stricter the security constraints must be.
- Any non-exact replacement must leave a warning and audit record.
- When unable to locate uniquely, must fail rather than "guess a similar location".

## 4. `EditReplacementAttempt`

| Field | Type | Description |
| --- | --- | --- |
| `attempt_level` | `exact \| whitespace_normalized \| indentation_normalized \| fuzzy \| context_anchored` | Matching level |
| `matched` | `boolean` | Whether successfully located |
| `candidate_count` | `number` | Candidate count |
| `similarity_score` | `number?` | Fuzzy match score |
| `warning_codes` | `string[]` | Risk warnings |
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

- Exact string match
- No normalization performed
- If uniquely matched, apply directly

### 5.2 Level 2 `whitespace_normalized`

- Normalize consecutive whitespace
- Remove trailing whitespace differences
- Do not change semantic character order

### 5.3 Level 3 `indentation_normalized`

- Match after stripping common indentation
- Applicable for entire code block indentation changes
- Should preserve current indentation style of target file after replacement

### 5.4 Level 4 `fuzzy`

- Only attempted after levels 1-3 all fail
- Requires `similarity_score >= 0.85`
- Must have only one unique candidate
- On success, must record warning: `fuzzy_edit_applied`

### 5.5 Level 5 `context_anchored`

- Use before/after anchors to narrow candidate region first, then do fuzzy match
- Only effective within unique anchor window
- On success, must record stronger warning: `anchored_fuzzy_edit_applied`

## 6. Currently Explicitly Not Done

Phase 1a / 1b does not do:

- AST-aware replacement
- Tree-sitter-level structured node location
- Cross-file semantic rewriting

If these capabilities need to be introduced, they should go into Phase 2 with separate ADR or contract.

## 7. Security Constraints

- If multiple candidates appear for the same request, must fail and return conflict information.
- Any fuzzy success result should return warning for upper layer message or log to prompt human review.
- Multi-level matching chain not allowed on binary / non-text files.
- Must hold `write` lock before applying replacement.

## 8. Error Semantics

Recommended stable error codes:

- `tool.edit_target_not_found`
- `tool.edit_multiple_candidates`
- `tool.edit_similarity_too_low`
- `tool.execution_failed`

Rules:

- Target not found and "multiple targets found" must be reported as separate errors.
- Similarity below threshold should explicitly fail, must not silently downgrade and apply.

## 9. Idempotency and Recovery

- If file content after replacement already equals expected result, can be considered idempotent success.
- Before recovery retry, should re-read target file rather than directly reuse old candidate range.
- Fuzzy / anchored level retry must not continue using old scores after file has changed.

## 10. Phase Boundaries

Phase 1a does:

- `exact`
- `whitespace_normalized`
- `indentation_normalized`

Phase 1b does:

- `fuzzy`
- `context_anchored`

## 11. Conclusion

Improvement in Edit success rate cannot rely on "being bolder", but on a matching chain that tightens order, shows risk explicitly, and fails explainably.