/**
 * @fileoverview Stream Bridge - Manages event streaming with replay capabilities
 *
 * ## Overview
 *
 * Provides a bridge between internal event records and SSE (Server-Sent Events)
 * stream frames. Handles event sequencing, buffering, and replay for clients.
 *
 * ## Key Concepts
 *
 * - **Stream**: Display-oriented incremental output for UI/channel
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: stream}
 *
 * - **Replay Buffer**: Finite event window for short disconnection recovery
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: replay buffer}
 *
 * - **Last-Event-ID**: SSE client declaration for resume position
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: Last-Event-ID}
 *
 * ## Event Types
 *
 * - status_changed, progress, message_delta (droppable from replay buffer)
 * - artifact_ready, approval_requested (critical, always retained)
 * - completed, failed (terminal states)
 *
 * @see Gateway Streaming Contract: docs_zh/contracts/gateway_streaming_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 *
 * @packageDocumentation
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
/**
 * Event types that can be dropped from the replay buffer when it exceeds max size.
 * These are "soft" events that clients can function without (status updates, progress, deltas).
 * Critical events like "completed", "failed", and "approval_requested" are always retained.
 */
const DROPPABLE_EVENT_TYPES = new Set(["status_changed", "progress", "message_delta"]);
/**
 * Maps internal EventRecord types to StreamEventFrame event types.
 *
 * This translation layer adapts domain events to stream-compatible types.
 * Terminal states (done, failed, completed) are specially mapped to allow
 * clients to easily identify when a stream has finished.
 *
 * @param event - The internal event record to map
 * @returns The corresponding stream event type
 */
function mapEventType(event) {
    switch (event.eventType) {
        case "task:status_changed": {
            const payload = JSON.parse(event.payloadJson);
            if (payload.toStatus === "done") {
                return "completed";
            }
            if (payload.toStatus === "failed") {
                return "failed";
            }
            return "status_changed";
        }
        case "workflow:step_completed":
            return "progress";
        case "decision:requested":
            return "approval_requested";
        case "division:completed":
            return "completed";
        default:
            return "progress";
    }
}
/**
 * Manages event streams with replay capabilities.
 *
 * StreamBridge provides the infrastructure for SSE (Server-Sent Events) streaming.
 * It maintains per-stream sequence numbers, buffers frames for replay, and handles
 * the translation between internal events and SSE-compatible frames.
 *
 * Buffer management:
 * - Each stream maintains its own replay buffer up to maxReplayFrames
 * - When buffer is full, droppable events are evicted (oldest first)
 * - Critical events (completed, failed, approval_requested) are never dropped
 * - Dropped sequence numbers are tracked to allow clients to detect gaps
 */
export class StreamBridge {
    options;
    nextSequenceByStream = new Map();
    replayBuffer = new Map();
    droppedBeforeSequenceByStream = new Map();
    /**
     * Creates a new StreamBridge instance.
     * @param options - Configuration options (defaults applied if not provided)
     */
    constructor(options = {}) {
        this.options = {
            maxReplayFrames: options.maxReplayFrames ?? 100,
        };
    }
    /**
     * Generates a unique stream identifier.
     *
     * @param taskId - The task this stream is associated with
     * @param channel - The channel name for this stream
     * @returns A unique stream ID in format "channel_taskId_randomId"
     */
    createStreamId(taskId, channel) {
        return `${channel}_${taskId}_${newId("stream")}`;
    }
    /**
     * Emits a new frame onto the stream with automatic sequence numbering.
     *
     * @param input - Frame data including streamId, taskId, channel, eventType, and payload
     * @param input.createdAt - Optional ISO timestamp (defaults to now)
     * @returns The emitted frame with assigned sequence number
     */
    emitFrame(input) {
        const sequence = (this.nextSequenceByStream.get(input.streamId) ?? 0) + 1;
        this.nextSequenceByStream.set(input.streamId, sequence);
        const frame = {
            streamId: input.streamId,
            taskId: input.taskId,
            channel: input.channel,
            eventType: input.eventType,
            sequence,
            payload: input.payload,
            createdAt: input.createdAt ?? nowIso(),
        };
        this.appendToReplayBuffer(frame);
        return frame;
    }
    /**
     * Emits a frame from an internal EventRecord, automatically mapping the event type.
     *
     * @param input - Contains streamId, channel, and the event to emit
     * @returns The emitted frame with assigned sequence number
     */
    emitFromEvent(input) {
        return this.emitFrame({
            streamId: input.streamId,
            taskId: input.event.taskId ?? "unknown_task",
            channel: input.channel,
            eventType: mapEventType(input.event),
            payload: JSON.parse(input.event.payloadJson),
            createdAt: input.event.createdAt,
        });
    }
    /**
     * Emits a message delta frame, typically used for streaming token output.
     *
     * @param input - Delta data including the text delta and optional role
     * @returns The emitted message_delta frame
     */
    emitMessageDelta(input) {
        return this.emitFrame({
            streamId: input.streamId,
            taskId: input.taskId,
            channel: input.channel,
            eventType: "message_delta",
            payload: {
                delta: input.delta,
                role: input.role ?? "assistant",
            },
            ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        });
    }
    /**
     * Requests replay of all frames after a given sequence number.
     *
     * @param streamId - The stream to replay from
     * @param lastSequence - The last sequence number the client has received
     * @returns ReplayResult with frames and buffer metadata; replayable=false if buffer was evicted
     */
    replay(streamId, lastSequence) {
        const frames = this.replayBuffer.get(streamId) ?? [];
        const droppedBeforeSequence = this.droppedBeforeSequenceByStream.get(streamId) ?? 0;
        const replayMaxSequence = this.nextSequenceByStream.get(streamId) ?? 0;
        const earliestAvailableSequence = frames[0]?.sequence ?? Math.max(1, droppedBeforeSequence + 1);
        if (lastSequence < droppedBeforeSequence) {
            return {
                replayable: false,
                frames: [],
                replayMaxSequence,
                earliestAvailableSequence,
                droppedBeforeSequence,
                errorCode: "stream.replay_buffer_evicted",
            };
        }
        return {
            replayable: true,
            frames: frames.filter((frame) => frame.sequence > lastSequence),
            replayMaxSequence,
            earliestAvailableSequence,
            droppedBeforeSequence,
            errorCode: null,
        };
    }
    /**
     * Returns all buffered frames with sequence greater than specified.
     *
     * @param streamId - The stream to query
     * @param lastSequence - Return frames after this sequence
     * @returns Array of matching frames (may be empty)
     */
    replayAfterSequence(streamId, lastSequence) {
        return (this.replayBuffer.get(streamId) ?? []).filter((frame) => frame.sequence > lastSequence);
    }
    /**
     * Returns metadata about the current replay buffer state.
     *
     * @param streamId - The stream to query
     * @returns ReplayWindow with buffer statistics
     */
    getReplayWindow(streamId) {
        const frames = this.replayBuffer.get(streamId) ?? [];
        const replayMaxSequence = this.nextSequenceByStream.get(streamId) ?? 0;
        const droppedBeforeSequence = this.droppedBeforeSequenceByStream.get(streamId) ?? 0;
        return {
            earliestAvailableSequence: frames[0]?.sequence ?? Math.max(1, droppedBeforeSequence + 1),
            replayMaxSequence,
            droppedBeforeSequence,
            bufferedFrameCount: frames.length,
        };
    }
    /**
     * Converts a StreamEventFrame to SSE format for transmission.
     *
     * @param frame - The frame to convert
     * @returns SSE-formatted frame with id, event type, and stringified data
     */
    toSseFrame(frame) {
        return {
            id: `${frame.streamId}:${frame.sequence}`,
            event: frame.eventType,
            data: JSON.stringify({
                stream_id: frame.streamId,
                task_id: frame.taskId,
                channel: frame.channel,
                sequence: frame.sequence,
                event_type: frame.eventType,
                payload: frame.payload,
                created_at: frame.createdAt,
            }),
        };
    }
    /**
     * Appends a frame to the replay buffer, evicting old frames if necessary.
     *
     * When the buffer exceeds maxReplayFrames, it attempts to drop the oldest
     * frame that is marked as droppable. If no droppable frames exist, it drops
     * the oldest frame regardless of type. Critical events (completed, failed,
     * approval_requested) are preserved by checking the type before dropping.
     *
     * @param frame - The frame to append
     */
    appendToReplayBuffer(frame) {
        const next = [...(this.replayBuffer.get(frame.streamId) ?? []), frame];
        while (next.length > this.options.maxReplayFrames) {
            // Find the first droppable frame (search from oldest)
            const indexToDrop = next.findIndex((candidate) => DROPPABLE_EVENT_TYPES.has(candidate.eventType));
            // If no droppable found, fall back to oldest (index 0)
            const removed = next.splice(indexToDrop >= 0 ? indexToDrop : 0, 1)[0];
            if (removed != null) {
                // Track the lowest dropped sequence so clients know buffer was truncated
                const previousDropped = this.droppedBeforeSequenceByStream.get(frame.streamId) ?? 0;
                this.droppedBeforeSequenceByStream.set(frame.streamId, Math.max(previousDropped, removed.sequence));
            }
        }
        this.replayBuffer.set(frame.streamId, next);
    }
}
//# sourceMappingURL=stream-bridge.js.map