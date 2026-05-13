# Gateway Streaming Contract

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

This contract defines streaming output, event dispatch, frame format, and progress update specifications for channels such as CLI, Web, and Telegram.

## 2. Key Objects

- `StreamChannel`
- `StreamEvent`
- `ProgressChunk`
- `FinalChunk`
- `ErrorChunk`

v4.3 Alignment Notes:

- Code-side authoritative streaming frame object is `StreamEventFrame`; `StreamEvent` is exported as its alias.
- For contract naming compatibility, code-side also exports type aliases `StreamChannel`, `ProgressChunk`, `FinalChunk`, and `ErrorChunk`; these aliases all converge to the same `StreamEventFrame` primary chain rather than maintaining parallel DTOs.
- `stream_gap` as a replay window eviction client-facing gap frame belongs to the `ErrorChunk` semantic domain as a recoverable streaming error.

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
- `data`: JSON, containing at minimum `stream_id`, `harness_run_id`, `sequence`, `payload`

Rules:

- SSE clients support resumable playback or minimal recovery via `id`.
- `completed` and `failed` are terminal frames.
- `sequence` must be monotonically increasing and not rollback.

Recommended operational rules:

- Reconnect should use exponential backoff to avoid amplifying traffic jitter on disconnect.
- Permanent rejections like `401 / 403 / 404` must not retry infinitely by default.
- Should maintain liveness timeout; when receiving only keepalive/frame after long time, should proactively disconnect and enter recovery.
- For recoverable scenarios like "session temporarily not found / compaction pause / generation switch", should set finite retry budget rather than infinite retry or immediate death.
- If supporting `Last-Event-ID` or equivalent resumption mechanism, should define replay buffer window; when client lags too far behind and required events have been evicted, server must return explicit error rather than silently dropping frames and continuing.

## v4.3 Contract Remediation

- T-66: This document originally defined `task_id` as the primary anchor for streaming events using Phase 1a scope. The root cause is that the streaming contract followed the task-level gateway model and did not synchronize to the `HarnessRun / NodeRun` and ring scope. Fix: The main text now uses `harness_run_id / node_run_id` as the primary chain, with `task_id` retained only for aggregation view purposes.

## 6. WebSocket Compatibility Strategy

- WebSocket payload maintains the same JSON structure as SSE `data`.
- WebSocket may multiplex multiple `stream_id`, but each `stream_id` still increments independently.
- If client does not support incremental consumption, server aggregation and sending `progress`/`completed` frames is allowed.

## 7. Telegram and Non-Streaming Fallback Strategy

- Telegram does not require true token-by-token streaming output by default.
- Phase 1a allows using periodic `progress` messages + final result message to replace complete stream.
- If `approval_requested` appears, must prioritize ensuring interaction reachability rather than continuing incremental text output.

## 8. Behavioral Constraints

- Within the same `stream_id`, `sequence` must be monotonically increasing.
- `completed` and `failed` are terminal chunks.
- Streaming output can only express display semantics and must not bypass task status fact source.
- After channel disconnect, must be recoverable based on `stream_id` for recovery, replay, or phased fallback.
- Session/channel state can only express interaction progress and must not replace authoritative state of task, workflow, or execution.
- After transport reconstruction, should continue streaming using `last_sequence` or equivalent high-water mark rather than full replay from 0.

## 9. Supplementary Rules

- When multiple windows subscribe to the same `stream_id`, deduplicate by `stream_id + sequence`; duplicate frames are safe to ignore.
- Backpressure from CLI TTY and Web SSE should preferentially drop rebuildable intermediate `progress` and must not drop terminal frames.
- keepalive/comment frames may only be used for liveness and should not enter the business event main chain.
- Transport layer state distinguishes at minimum `connected / reconnecting / failed`; observer subscription and subscription with execution rights must not be confused.
- If supporting read-only observer mode, may add `viewer_only` or equivalent interaction state, but this state can only express permission-limited observation and must not be misused as business failure.
- If client has display-layer commit tick/catch-up mechanism, should only work based on queue state like backlog depth and oldest message age, and must not reorder or change business semantics due to different upstream sources.
- When connecting replay/live dual channels, should first establish live subscription then snapshot replay buffer, and deduplicate with `replay_max_sequence` or equivalent high-water mark to avoid gaps or duplicate advancement between replay and live.
- For interactive session/channel, recommend limiting concurrent active request count for the same interaction context; if active request guard exists, its semantics can only constrain interaction submission and must not replace task/execution ownership control.