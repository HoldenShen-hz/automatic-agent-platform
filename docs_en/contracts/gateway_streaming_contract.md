# Gateway Streaming Contract

---

## OAPEFLIR Related

This contract participates in the following stages of the OAPEFLIR 8-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution evaluation and risk assessment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines streaming output, event distribution, frame format, and progress update specifications for channels such as CLI, Web, Telegram, etc.

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

Phase 1a unified uses:

- `id`: `<stream_id>:<sequence>`
- `event`: `event_type`
- `data`: JSON, at minimum includes `stream_id`, `task_id`, `sequence`, `payload`

Rules:

- SSE client supports resume-from-interruption or minimal recovery by `id`.
- `completed` and `failed` are terminal frames.
- `sequence` must monotonically increase and not roll back.

Recommended operational rules:

- Reconnect should use exponential backoff to avoid amplifying traffic jitter when disconnected.
- `401 / 403 / 404` permanent rejections default to no infinite retry.
- Should maintain liveness timeout; when receiving no keepalive / frame for a long time, should proactively disconnect and enter recovery.
- For recoverable scenarios like "session temporarily not found / compaction paused streaming / generation switched", should set finite retry budget, not infinite retry or immediate death.
- If `Last-Event-ID` or equivalent continuation mechanism is supported, should define replay buffer window; when client lags too much and required events have been evicted, server must return explicit error, not silently drop frames and continue.

## 6. WebSocket Compatibility Strategy

- WebSocket payload maintains same JSON structure as SSE `data`.
- WebSocket may multiplex multiple `stream_id`, but each `stream_id` still independently increases.
- If client does not support incremental consumption, server may aggregate and send `progress` / `completed` frames.

## 7. Telegram And Non-Streaming Fallback Strategy

- Telegram does not require true token-by-token streaming output by default.
- Phase 1a allows using periodic `progress` messages + final result message instead of complete stream.
- If `approval_requested` occurs, must prioritize ensuring interaction reachability rather than continuing to output incremental text.

## 8. Behavioral Constraints

- Within same `stream_id`, `sequence` must monotonically increase.
- `completed` and `failed` are terminal chunks.
- Streaming output can only express display semantics; must not bypass task status factual source.
- After channel disconnection, must be recoverable based on `stream_id` for recovery, replay, or phased fallback.
- Session / channel state can only express interaction progress; must not replace authoritative state of task, workflow, or execution.
- After transport reconstruction, should continue streaming using `last_sequence` or equivalent high-water mark, not full replay from 0.

## 9. Supplementary Rules

- When multiple windows subscribe to same `stream_id`, deduplicate by `stream_id + sequence`; duplicate frames can be safely ignored.
- CLI TTY and Web SSE backpressure should prioritize dropping rebuildable intermediate `progress`, must not drop terminal frames.
- Keepalive / comment frames can be used for liveness only; should not enter business event main chain.
- Transport layer state at minimum distinguishes `connected / reconnecting / failed`; observer subscription and subscription with execution rights must not be confused.
- If read-only observer mode is supported, may add `viewer_only` or equivalent interaction state, but that state can only express permission-limited observation; must not be misused as business failure.
- If client has display-layer commit tick / catch-up mechanism, should only work based on queue state like backlog depth, oldest message age; must not reorder or change business semantics due to different upstream sources.
- When replay/live dual channels connect, should establish live subscription first then snapshot replay buffer, and deduplicate with `replay_max_sequence` or equivalent high-water mark to avoid gaps or duplicate advancement between replay and live.
- For interactive session/channel, recommend limiting concurrent active requests for same interactive context; if active request guard exists, its semantics can only constrain interactive submission; must not replace task/execution ownership control.