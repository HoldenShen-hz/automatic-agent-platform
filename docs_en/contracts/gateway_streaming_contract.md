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
- **Improve**: Improvement candidate evaluation and release
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines streaming output, event distribution, frame format, and progress update specifications for channels like CLI, Web, Telegram.

## 2. Key Objects

- `StreamEventFrame`
- `SseFrame`
- `StreamReplayWindow`
- `StreamReplayResult`

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

Ring 1 baseline unified use:

- `id`: `<stream_id>:<sequence>`
- `event`: `event_type`
- `data`: JSON, at minimum includes `stream_id`, `harness_run_id`, `sequence`, `payload`

Rules:

- SSE client supports断点续传 or minimum recovery based on `id`.
- `completed` and `failed` are terminal frames.
- `sequence` must be monotonically increasing and not roll back.

Recommended operational rules:

- Reconnect should use exponential backoff to avoid amplifying traffic volatility during disconnection.
- Permanent rejections like `401 / 403 / 404` must not retry indefinitely by default.
- Should maintain liveness timeout; when long time without receiving keepalive / frame, should proactively disconnect and enter recovery.
- For recoverable scenarios like "session temporarily not found / compaction paused streaming / generation switching", should set limited retry budget, not infinite retry or immediate death.
- If `Last-Event-ID` or equivalent continuation mechanism is supported, should define replay buffer window; when client falls too far behind and required events have been evicted, server must return explicit error, not silently drop frames and continue.

## v4.3 Contract Remediation

- T-66: This document originally defined `task_id` as streaming event main anchor and used Phase 1a terminology. Root cause: streaming contract followed task-level gateway model and did not synchronize to `HarnessRun / NodeRun` and ring terminology. Fix: The text now changes to `harness_run_id / node_run_id` main chain; `task_id` only retains aggregation view purpose.

## 6. WebSocket Compatibility Strategy

- WebSocket payload maintains same JSON structure as SSE `data`.
- WebSocket can multiplex multiple `stream_id`s, but each `stream_id` still increments independently.
- If client does not support incremental consumption, server can aggregate and send `progress` / `completed` frames.

## 7. Telegram and Non-Streaming Fallback Strategy

- Telegram does not require true token-by-token streaming output by default.
- Phase 1a allows using periodic `progress` messages + final result message to replace complete stream.
- If `approval_requested` appears, must prioritize ensuring interactivity is reachable rather than continuing to output incremental text.

## 8. Behavioral Constraints

- Within the same `stream_id`, `sequence` must be monotonically increasing.
- `completed` and `failed` are terminal chunks.
- Streaming output can only express display semantics and must not bypass task state fact source.
- After channel disconnection, must be recoverable based on `stream_id` for recovery, replay, or phased fallback.
- Session / channel state can only express interaction progress and must not replace authoritative state of task, workflow, or execution.
- After transport reconstruction, should continue streaming using `last_sequence` or equivalent high-water mark, not full replay from 0.

## 9. Supplementary Rules

- When multiple windows subscribe to the same `stream_id`, deduplicate by `stream_id + sequence`; duplicate frames are allowed to be safely ignored.
- CLI TTY and Web SSE backpressure should both prioritize dropping reconstructable intermediate `progress`, must not drop terminal frames.
- keepalive / comment frames can be used for liveness only and should not enter business event main chain.
- Transport layer state at minimum distinguishes `connected / reconnecting / failed`; observer subscription and execution rights subscription must not be confused.
- If read-only observer mode is supported, can add `viewer_only` or equivalent interaction state, but this state can only express permission-restricted observation and must not be misused as business failure.
- If client has display layer commit tick / catch-up mechanism, should only work based on queue state like backlog depth, oldest message age, etc., and must not reorder or change business semantics due to different upstream sources.
- When connecting replay/live dual channels, should first establish live subscription then snapshot replay buffer, and deduplicate by `replay_max_sequence` or equivalent high-water mark to avoid gaps or duplicates between replay and live.
- For interactive session/channel, recommend limiting concurrent active requests for the same interactive context; if active request guard exists, its semantics can only constrain interaction submission and cannot replace task/execution ownership control.
