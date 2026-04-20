# Message Parts Contract

## 1. Scope

This contract defines the segmented model of message content, used for unifying user messages, assistant output, tool use, tool result, and summary fragments.

Related documents:

- `gateway_message_contract.md`
- `gateway_streaming_contract.md`
- `context_compaction_and_overflow_contract.md`

## 2. Goals

- Upgrade message from "big text blob" to structured parts.
- Provide unified foundation for incremental persistence, fine-grained trimming, and replay.
- Avoid mixing `text / tool_result / summary / artifact refs` in one field.

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
| `part_type` | `string` | Part type above |
| `sequence` | `integer` | Order within same message |
| `content_json` | `json` | Part payload |
| `lineage_json?` | `json` | Source, compression, retry, or recovery chain information |
| `created_at` | `timestamp` | Creation time |

## 5. Behavioral Constraints

- `sequence` must be monotonically increasing within the same message.
- `tool_result` must not impersonate plain text.
- Large-volume output should preferentially precipitate as `artifact_ref` or `summary`.
- After compaction, original details of old `tool_result` should preferentially precipitate as `artifact_ref` and supplement a `summary` part for model to continue consuming.
- Context compaction should preferentially trim `tool_result` parts, not user input or final conclusion.
- `reasoning` part and `text` part must be explicitly distinguished to avoid mixing internal reasoning and user-facing text into one display layer field.
- `retry_record`, `step_boundary`, `compaction_marker` and other run evidence parts must be safely replayable and must not be sent to model again as ordinary conversation text.
- `agent_ref` / `subtask_ref` should express dispatch fact, source, and target and must not rely solely on free text recording.
- `hook_event`, `command_execution`, `mcp_call` and other run items if entering history plane should be independent structured parts rather than mixed into assistant ordinary text.

## 6. Recommended Payload Constraints

- `reasoning`: Only save externally retainable reasoning summary, do not save ungoverned privacy or sensitive internal chain.
- `tool_result`: Large content externally stored to artifact, only retain summary, reference, and necessary metadata.
- `retry_record`: At minimum includes `attempt`, `error_code`, `retry_delay_ms`, `source`.
- `step_boundary`: At minimum includes `step_id`, `boundary_kind` (`started | completed | failed | skipped`).
- `compaction_marker`: At minimum includes `compaction_id`, `covered_message_ids`, `auto`, `overflow_triggered`.
- `hook_event`: At minimum includes `hook_name`, `phase`, `result_kind`.
- `command_execution`: At minimum includes `command_ref`, `status`, `cwd`, `duration_ms?`.
- `mcp_call`: At minimum includes `server_name`, `tool_name`, `status`, `duration_ms?`.
- `question_prompt`: At minimum includes `question_id`, `mode` (`single | multi | text`), `options?`, `recommended_option_id?`, `timeout_policy?`.
- `todo_update`: At minimum includes `todo_id`, `status` (`pending | in_progress | completed | cancelled`) and `source`.

## 7. Closure Conclusion

Message parts are the foundational abstraction of the message layer; subsequent stream replay, partial persistence, and context compaction should all be built on this model.
