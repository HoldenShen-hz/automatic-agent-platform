# Message Parts Contract

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

This contract defines the segmentation model for message content, used to unify user messages, assistant output, tool use, tool result, and summary segments.

Related documents:

- `gateway_message_contract.md`
- `gateway_streaming_contract.md`
- `context_compaction_and_overflow_contract.md`

## 2. Objectives

- Upgrade messages from "large text blobs" to structured parts.
- Provide a unified foundation for incremental persistence, fine-grained pruning, and replay.
- Prevent `text / tool_result / summary / artifact refs` from being mixed in a single field.

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
| `sequence` | `integer` | Sequence within the message |
| `content_json` | `json` | Part payload |
| `lineage_json?` | `json` | Source, compaction, retry, or recovery chain information |
| `created_at` | `timestamp` | Creation timestamp |

## 5. Behavioral Constraints

- `sequence` must monotonically increase within the same message.
- `tool_result` must not masquerade as plain text.
- Large outputs should preferentially be沉淀为 `artifact_ref` or `summary`.
- After compaction of old `tool_result`, original details should preferentially be deposited as `artifact_ref` and supplemented with a `summary` part for the model to continue consuming.
- Context compaction should preferentially prune `tool_result` parts, not user input or final conclusions.
- `reasoning` parts and `text` parts must be explicitly distinguished to prevent internal reasoning and user-facing text from being mixed into a single display layer field.
- Runtime evidence parts like `retry_record`, `step_boundary`, and `compaction_marker` must be safely replayable and must not be re-sent to the model as ordinary conversation text.
- `agent_ref` / `subtask_ref` should express dispatch facts, source, and target, and must not rely solely on freeform text for recording.
- Runtime items like `hook_event`, `command_execution`, and `mcp_call` should, if they enter the history surface, be independent structured parts rather than being mixed into assistant ordinary text.

## 6. Recommended Payload Constraints

- `reasoning`: Only preserve publicly releasable reasoning summaries; do not store ungoverned private or sensitive internal chains.
- `tool_result`: Large content is externalized to artifact by default; only preserve summary, references, and necessary metadata.
- `retry_record`: Contains at minimum `attempt`, `error_code`, `retry_delay_ms`, `source`.
- `step_boundary`: Contains at minimum `step_id`, `boundary_kind` (`started | completed | failed | skipped`).
- `compaction_marker`: Contains at minimum `compaction_id`, `covered_message_ids`, `auto`, `overflow_triggered`.
- `hook_event`: Contains at minimum `hook_name`, `phase`, `result_kind`.
- `command_execution`: Contains at minimum `command_ref`, `status`, `cwd`, `duration_ms?`.
- `mcp_call`: Contains at minimum `server_name`, `tool_name`, `status`, `duration_ms?`.
- `question_prompt`: Contains at minimum `question_id`, `mode` (`single | multi | text`), `options?`, `recommended_option_id?`, `timeout_policy?`.
- `todo_update`: Contains at minimum `todo_id`, `status` (`pending | in_progress | completed | cancelled`), and `source`.

## 7. Conclusion

Message parts are the foundational abstraction for the message layer. Subsequent stream replay, partial persistence, and context compaction should all be built on this model.