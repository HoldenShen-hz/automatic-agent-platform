# Gateway Streaming Contract

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-phase loop:

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

This contract defines streaming output, event dispatch, frame format, and progress update specifications for channels such as CLI, Web, Telegram.

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
- `data`: JSON, at least contains `stream_id`, `task_id`, `sequence`, `payload`

Rules:

- SSE clients support断点续传 or minimal recovery by `id`.
- `completed` and `failed` are terminal frames.
- `sequence` must be monotonically increasing and not regress.

Recommended operational rules:

- Reconnect should use exponential backoff to avoid amplifying traffic jitter when disconnected.
- Permanent rejections like `401 / 403 / 404` must not retry indefinitely by default.
- Should maintain liveness timeout; when receiving no keepalive / frame for long time, should主动断开 and enter recovery.
- For recoverable scenarios like "session temporarily not found / compaction paused streaming / generation switching", should set finite retry budget, not infinite retry or immediate death.
- If `Last-Event-ID` or equivalent continuation mechanism is supported, should define replay buffer window; when client lags too much and required events have been evicted, server must return explicit error, not silently drop frames and continue.

## 6. WebSocket Compatibility Strategy

- WebSocket payload maintains same JSON structure as SSE `data`.
- WebSocket can multiplex multiple `stream_id`s, but each `stream_id` still independently increments.
- If client does not support incremental consumption, server aggregation and sending `progress` / `completed` frames is allowed.

## 7. Telegram and Non-Streaming Fallback Strategy

- Telegram does not require true token-by-token streaming output by default.
- Phase 1a allows using periodic `progress` messages + final result message instead of complete stream.
- If `approval_requested` appears, must prioritize ensuring interactivity is reachable, rather than continuing to output incremental text.

## 8. Behavior Constraints

- Within same `stream_id`, `sequence` must be monotonically increasing.
- `completed` and `failed` are terminal chunks.
- Streaming output can only express display semantics, must not bypass task state fact source.
- After channel disconnection, must be recoverable, replayable, or phase-recoverable based on `stream_id`.
- Session / channel state can only express interaction progress, must not replace authoritative state of task, workflow, or execution.
- After transport reconstruction, should continue streaming using `last_sequence` or equivalent high-water mark, not full replay from 0.

## 9. Supplementary Rules

- When multiple windows subscribe to same `stream_id`, deduplicate by `stream_id + sequence`; duplicate frames allow safe ignore.
- CLI TTY and Web SSE backpressure should prioritize discarding rebuildable intermediate `progress`, must not discard terminal frames.
- Keepalive / comment frames can only be used for liveness, should not enter business event primary chain.
- Transport layer state at least distinguishes `connected / reconnecting / failed`; observer subscription and subscription with execution authority must not be confused.
- If read-only observer mode is supported, can add `viewer_only` or equivalent interaction state, but that state can only express permission-limited observation, must not be misused as business failure.
- If client has display layer commit tick / catch-up mechanism, should only work based on queue state like backlog depth, oldest message age, etc., must not reorder or change business semantics due to different upstream sources.
- When connecting replay/live dual channels, should first establish live subscription then snapshot replay buffer, and deduplicate with `replay_max_sequence` or equivalent high water mark to avoid gaps or duplicate advancement between replay and live.
- For interactive sessions/channels, recommend limiting concurrent active requests for same interaction context; if active request guard exists, its semantics can only constrain interaction submission, must not replace task/execution ownership control.
