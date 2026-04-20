# Message Parts Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cognitive loop:

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

This contract defines the segmented model for message content, used to unify user messages, assistant output, tool use, tool result, and summary segments.

Related documents:

- `gateway_message_contract.md`
- `gateway_streaming_contract.md`
- `context_compaction_and_overflow_contract.md`

## 2. Goals

- Upgrade messages from "large text blob" to structured parts.
- Provide a unified foundation for incremental persistence, fine-grained pruning, and replay.
- Avoid mixing `text / tool_result / summary / artifact refs` in a single field.

## 3. Part Types

- `text`
- `reasoning`
- `tool_use`
- `tool_result`
- `summary`
- `artifact_ref`
- `question_prompt`
- `todo_update`
- `decision_prompt`
- `agent_ref`
- `subtask_ref`
- `retry_record`
- `step_boundary`
- `compaction_marker`
- `hook_event`
- `command_execution`
- `mcp_call`

## 4. `MessagePart` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `part_id` | `string` | Part ID |
| `message_id` | `string` | Parent message |
| `part_type` | `string` | Part type from above |
| `sequence` | `integer` | Order within message |
| `content_json` | `json` | Part payload |
| `lineage_json?` | `json` | Source, compression, retry, or recovery chain information |
| `created_at` | `timestamp` | Creation time |

## 5. Behavioral Constraints

- `sequence` must be monotonically increasing within the same message.
- `tool_result` must not be disguised as plain text.
- Large output should preferentially be stored as `artifact_ref` or `summary`.
- After compaction of old `tool_result`, original details should preferentially be stored as `artifact_ref`, with a `summary` part added for the model to continue consuming.
- Context compaction should preferentially prune `tool_result` parts, not user input or final conclusions.
- `reasoning` part and `text` part must be explicitly distinguished to avoid mixing internal reasoning and user-facing text into one display layer field.
- Runtime evidence parts like `retry_record`, `step_boundary`, `compaction_marker` must be safely replayable and must not be sent to the model as ordinary conversation text again.
- `agent_ref` / `subtask_ref` should express dispatch facts, source, and target; they must not rely solely on free text.
- Runtime items like `hook_event`, `command_execution`, `mcp_call` should be independent structured parts if they enter the history plane, not mixed into assistant ordinary text.

## 6. Recommended Payload Constraints

- `reasoning`: Only save externally preservable reasoning summaries; do not save ungoverned private or sensitive internal chains.
- `tool_result`: Large content is externally stored to artifact by default; only summary, reference, and necessary metadata are retained.
- `retry_record`: Must contain at least `attempt`, `error_code`, `retry_delay_ms`, `source`.
- `step_boundary`: Must contain at least `step_id`, `boundary_kind` (`started | completed | failed | skipped`).
- `compaction_marker`: Must contain at least `compaction_id`, `covered_message_ids`, `auto`, `overflow_triggered`.
- `hook_event`: Must contain at least `hook_name`, `phase`, `result_kind`.
- `command_execution`: Must contain at least `command_ref`, `status`, `cwd`, `duration_ms?`.
- `mcp_call`: Must contain at least `server_name`, `tool_name`, `status`, `duration_ms?`.
- `question_prompt`: Must contain at least `question_id`, `mode` (`single | multi | text`), `options?`, `recommended_option_id?`, `timeout_policy?`.
- `todo_update`: Must contain at least `todo_id`, `status` (`pending | in_progress | completed | cancelled`), and `source`.

## 7. Closure Conclusion

Message parts are the foundational abstraction for the message layer. Subsequent stream replay, partial persistence, and context compaction should all be built on this model.
