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

This contract defines streaming output, event distribution, frame format and progress update specifications for channels such as CLI, Web, and Telegram.

## 2. Key Objects

- `StreamChannel`
- `StreamEvent`
- `ProgressChunk`
- `FinalChunk`
- `ErrorChunk`

v4.3 alignment notes:

- The code-side authoritative streaming frame object is `StreamEventFrame`; `StreamEvent` is exported as its alias.
- For contract naming compatibility, the code side also exports type aliases `StreamChannel`, `ProgressChunk`, `FinalChunk`, `ErrorChunk`; these aliases all converge to the same `StreamEventFrame` main chain, rather than maintaining parallel DTOs.
- `stream_gap` serves as the client-facing gap frame when the replay window has been evicted, belonging to recoverable streaming errors within the `ErrorChunk` semantic domain.

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

## 4. event_type Enumeration

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

- SSE clients can resume from breakpoints or minimum recovery based on `id`.
- `completed` and `failed` are terminal frames.
- `sequence` must monotonically increase and not regress.

Recommended runtime rules:

- Reconnect should use exponential backoff to avoid amplifying traffic jitter during disconnections.
- Permanent rejections like `401 / 403 / 404` must not retry indefinitely by default.
- A liveness timeout should be maintained; when keepalive/frame is not received for a long time, actively disconnect and enter recovery.
- For recoverable scenarios like "session temporarily not found / compaction paused streaming / generation switch," a limited retry budget should be set, not infinite retry or immediate death.
- If `Last-Event-ID` or equivalent continuation mechanism is supported, a replay buffer window should be defined; when the client lags too far behind and required events have been evicted, the server must return a clear error, not silently drop frames and continue.

## v4.3 Contract Remediation

- T-66: This document previously defined `task_id` as the main anchor for streaming events and used Phase 1a scope. Root cause: streaming contract followed the task-level gateway model and was not synchronized to `HarnessRun / NodeRun` and ring scope. Fix: The main text now uses `harness_run_id / node_run_id` as the main chain, with `task_id` retaining only aggregation view purpose.

## 6. WebSocket Compatibility Strategy

- WebSocket payload maintains the same JSON structure as SSE `data`.
- WebSocket can multiplex multiple `stream_id`s, but each `stream_id` still increments independently.
- If the client does not support incremental consumption, the server may aggregate and send `progress`/`completed` frames.

## 7. Telegram and Non-Streaming Fallback Strategy

- Telegram does not require true token-by-token streaming output by default.
- Phase 1a allows using阶段性 `progress` messages + final result message to replace complete streaming.
- If `approval_requested` appears, interaction reachability must be prioritized over continued incremental text output.

## 8. Behavioral Constraints

- Within the same `stream_id`, `sequence` must monotonically increase.
- `completed` and `failed` are terminal chunks.
- Streaming output can only express display semantics, must not bypass task status fact source.
- After channel disconnection, recovery, replay or phased rollback must be possible based on `stream_id`.
- Session/channel status can only express interaction progress, must not replace authoritative status of task, workflow or execution.
- After transport reconstruction, should continue streaming using `last_sequence` or equivalent high-water mark, not full replay from 0.

## 9. Supplementary Rules

- When multiple windows subscribe to the same `stream_id`, deduplicate by `stream_id + sequence`, duplicate frames can be safely ignored.
- Backpressure from both CLI TTY and Web SSE should preferentially drop reconstructible intermediate `progress`, must not drop terminal frames.
- Keepalive/comment frames can be used only for liveness, must not enter the business event main chain.
- Transport layer status must distinguish at minimum `connected / reconnecting / failed`; observer subscriptions and subscriptions with execution rights must not be confused.
- If read-only observer mode is supported, `viewer_only` or equivalent interaction state may be added, but this status can only express permission-restricted observation, must not be misused as business failure.
- If the client has display-layer commit tick/catch-up mechanism, should work based only on backlog depth, oldest message age and other queue statuses, must not reorder or change business semantics due to different upstream sources.
- When connecting replay/live dual channels, should first establish live subscription then snapshot replay buffer, and deduplicate with `replay_max_sequence` or equivalent high-water mark, to avoid gaps or duplicate advancement between replay and live.
- For interactive session/channel, it is recommended to limit concurrent active request count for the same interaction context; if an active request guard exists, its semantics can only constrain interaction submission, must not replace task/execution ownership control.