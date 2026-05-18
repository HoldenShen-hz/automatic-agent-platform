# Gateway Streaming Contract

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-stage cycle:

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

This contract defines streaming output, event distribution, frame format, and progress update specifications for CLI, Web, Telegram, and other channels.

## 2. Key Objects

- `StreamChannel`
- `StreamEvent`
- `ProgressChunk`
- `FinalChunk`
- `ErrorChunk`

v4.3 Alignment Notes:

- The code-side authoritative streaming frame object is `StreamEventFrame`; `StreamEvent` is exported as its alias.
- For contract naming compatibility, the code-side also exports type aliases `StreamChannel`, `ProgressChunk`, `FinalChunk`, `ErrorChunk`; these aliases all converge to the same `StreamEventFrame` primary chain, rather than maintaining parallel DTOs.
- `stream_gap` as a client-facing gap frame when the replay window has evicted fallen items belongs within the `ErrorChunk` semantic domain as a recoverable streaming error.

## 3. StreamEvent Minimum Fields

- `stream_id`
- `harness_run_id`
- `node_run_id?`
- `task_id?`
- `channel`
- `event_type`
- `sequence`
- `payload`
- `created_at`

## 4. event_type Enum

- `status_changed`
- `progress`
- `message_delta`
- `artifact_ready`
- `approval_requested`
- `completed`
- `failed`

## 5. SSE Frame Format

Ring 1 baseline unified format:

- `id`: `<stream_id>:<sequence>`
- `event`: `event_type`
- `data`: JSON, must include at least `stream_id`, `harness_run_id`, `sequence`, `payload`

Rules:

- SSE clients should support checkpoint resumption or minimal recovery based on `id`.
- `completed` and `failed` are terminal frames.
- `sequence` must be monotonically increasing and must not roll back.

Recommended execution rules:

- Reconnect should use exponential backoff to avoid amplifying traffic jitter during disconnections.
- Permanent rejections like `401 / 403 / 404` should not retry indefinitely by default.
- Should maintain a liveness timeout; when receiving only keepalive/frame without any data for a long time, should proactively disconnect and enter recovery.
- For recoverable scenarios like "session temporarily not found / compaction paused streaming / generation switched", a finite retry budget should be set, rather than infinite retry or immediate death judgment.
- If supporting `Last-Event-ID` or equivalent continuation mechanism, a replay buffer window should be defined; when the client lags too far behind and required events have been evicted, the server must return a clear error, rather than silently dropping frames and continuing.

## v4.3 Contract Remediation

- T-66: This document originally defined `task_id` as the primary anchor for streaming events and used "Phase 1a" terminology. The root cause was that the streaming contract followed the task-level gateway model, without synchronizing to `HarnessRun / NodeRun` and ring terminology. Fix: The body now uses `harness_run_id / node_run_id` as the primary chain, with `task_id` retained only for aggregate view purposes.

## 6. WebSocket Compatibility Strategy

- WebSocket payload maintains the same JSON structure as SSE `data`.
- WebSocket can multiplex multiple `stream_id`s, but each `stream_id` still increments independently.
- If the client does not support incremental consumption, the server may aggregate and send `progress` / `completed` frames.

## 7. Telegram and Non-Streaming Fallback Strategy

- Telegram does not require true token-by-token streaming output by default.
- Phase 1a allows using staged `progress` messages plus final result messages instead of complete streams.
- If `approval_requested` occurs, interaction reachability must be prioritized, rather than continuing to output incremental text.

## 8. Behavioral Constraints

- Within the same `stream_id`, `sequence` must be monotonically increasing.
- `completed` and `failed` are terminal chunks.
- Streaming output can only express display semantics and must not bypass task state facts source.
- After channel disconnection, recovery, replay, or staged fallback must be possible based on `stream_id`.
- Session / channel state can only express interaction progress and must not replace authoritative state for task, workflow, or execution.
- After transport reconstruction, should continue streaming using `last_sequence` or equivalent high-water mark, rather than replaying from 0 in full.

## 9. Supplementary Rules

- When multiple windows subscribe to the same `stream_id`, deduplicate by `stream_id + sequence`; duplicate frames are allowed to be safely ignored.
- Both CLI TTY and Web SSE backpressure should preferentially drop rebuildable intermediate `progress`, and must not drop terminal frames.
- keepalive / comment frames can be used only for liveness and should not enter the business event primary chain.
- Transport layer state should at least distinguish `connected / reconnecting / failed`; observer subscriptions and subscriptions with execution rights must not be confused.
- If read-only observer mode is supported, `viewer_only` or equivalent interaction state may be added, but this state can only express permission-limited observation and must not be misused as a business failure.
- If the client has a display-layer commit tick / catch-up mechanism, should work based only on queue state such as backlog depth and oldest message age, rather than reordering or changing business semantics due to different upstream sources.
- When connecting replay/live dual channels, should first establish the live subscription, then snapshot the replay buffer, and deduplicate using `replay_max_sequence` or equivalent high-water mark, to avoid gaps or duplicate advancement between replay and live.
- For interactive session/channel, it is recommended to limit concurrent active request count for the same interaction context; if an active request guard exists, its semantics can only constrain interaction submission and must not replace task/execution ownership control.
