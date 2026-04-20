# Gateway Streaming Contract

## 1. Scope

This contract defines streaming output, event distribution, frame format, and progress update specifications for channels such as CLI, Web, and Telegram.

## 2. Key Objects

- `StreamChannel`
- `StreamEvent`
- `ProgressChunk`
- `FinalChunk`
- `ErrorChunk`

## 3. StreamEvent Minimum Fields

- `stream_id`
- `task_id`
- `channel`
- `event_type`
- `sequence`
- `payload`
- `created_at`

## 4. event_type Enumeration

- `status_changed`
- `progress`
- `message_delta`
- `artifact_ready`
- `approval_requested`
- `completed`
- `failed`

## 5. SSE Frame Format

Phase 1a unified use:

- `id`: `<stream_id>:<sequence>`
- `event`: `event_type`
- `data`: JSON, at minimum includes `stream_id`, `task_id`, `sequence`, `payload`

Rules:

- SSE clients support resume/reconnect or minimum recovery by `id`.
- `completed` and `failed` are terminal state frames.
- `sequence` must monotonically increase and not roll back.

Recommended operational rules:

- Reconnect should use exponential backoff to avoid amplifying traffic jitter on disconnection.
- Permanent rejections like `401 / 403 / 404` must not retry indefinitely by default.
- Should maintain liveness timeout; when long time no keepalive / frame received, should actively disconnect and enter recovery.
- For recoverable scenarios like "session temporarily not found / compaction paused streaming / generation switch," should set limited retry budget rather than infinite retry or immediately declaring dead.
- If supporting `Last-Event-ID` or equivalent stream continuation mechanism, should define replay buffer window; when client falls too far behind and required events have been evicted, server must return explicit error rather than silently dropping frames and continuing.

## 6. WebSocket Compatibility Strategy

- WebSocket payload maintains the same JSON structure as SSE `data`.
- WebSocket can multiplex multiple `stream_id`s, but each `stream_id` still increments independently.
- If client does not support incremental consumption, server aggregation and sending `progress` / `completed` frames is allowed.

## 7. Telegram and Non-Streaming Fallback Strategy

- Telegram does not by default require true token-by-token streaming output.
- Phase 1a allows using periodic `progress` messages + final result messages to replace complete streaming.
- If `approval_requested` appears, must prioritize ensuring interactivity is reachable rather than continuing to output incremental text.

## 8. Behavioral Constraints

- Within the same `stream_id`, `sequence` must monotonically increase.
- `completed` and `failed` are terminal chunks.
- Streaming output can only express display semantics and must not bypass task state source of truth.
- After channel disconnection, must be recoverable, replayable, or steppable back based on `stream_id`.
- Session / channel state can only express interaction progress and must not replace authoritative state of task, workflow, or execution.
- After transport reconstruction, should continue streaming using `last_sequence` or equivalent high-water mark rather than full replay from 0.

## 9. Supplementary Rules

- When multiple windows subscribe to the same `stream_id`, deduplicate by `stream_id + sequence`; duplicate frames are safely ignorable.
- Both CLI TTY and Web SSE backpressure should prioritize dropping reconstructible intermediate `progress` and must not drop terminal frames.
- Keepalive / comment frames can be used only for liveness and must not enter the main business event chain.
- Transport layer state at minimum distinguishes `connected / reconnecting / failed`; observer subscription and execution-holding subscription must not be confused.
- If supporting read-only observer mode, can add `viewer_only` or equivalent interaction state, but that state can only express permission-limited observation and must not be misused as business failure.
- If client has display-layer commit tick / catch-up mechanism, should only work based on queue state such as backlog depth and oldest message age, and must not reorder or change business semantics due to different upstream sources.
- When connecting replay/live dual channels, should first establish live subscription then snapshot replay buffer, and deduplicate by `replay_max_sequence` or equivalent high-water mark to avoid gaps or duplicate advancement between replay and live.
- For interactive session/channel, recommended to limit concurrent active request count for the same interactive context; if active request guard exists, its semantics can only constrain interactive submission and must not replace task/execution ownership control.
