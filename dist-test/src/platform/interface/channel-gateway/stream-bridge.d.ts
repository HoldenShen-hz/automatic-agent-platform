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
import type { EventRecord } from "../../contracts/types/domain.js";
/**
 * A single frame in the event stream.
 *
 * Frames are the atomic units of the stream. Each frame has a monotonically
 * increasing sequence number within its stream, allowing clients to detect
 * gaps and request replay of missed events.
 */
export interface StreamEventFrame {
    /** Unique identifier for this stream */
    streamId: string;
    /** The task this frame belongs to */
    taskId: string;
    /** Channel name for routing (e.g., "updates", "errors") */
    channel: string;
    /** Type of event determining payload structure */
    eventType: "status_changed" | "progress" | "message_delta" | "artifact_ready" | "approval_requested" | "completed" | "failed";
    /** Monotonically increasing sequence number within the stream */
    sequence: number;
    /** Event-specific payload data */
    payload: Record<string, unknown>;
    /** ISO timestamp when frame was created */
    createdAt: string;
}
/**
 * Configuration options for StreamBridge behavior.
 */
export interface StreamBridgeOptions {
    /**
     * Maximum number of frames to retain in the replay buffer per stream.
     * When exceeded, oldest droppable frames are evicted first.
     * @defaultValue 100
     */
    maxReplayFrames?: number;
}
/**
 * Metadata about the current replay buffer state for a stream.
 * Useful for clients to understand what replay is possible.
 */
export interface StreamReplayWindow {
    /** Lowest sequence number still available in buffer */
    earliestAvailableSequence: number;
    /** Highest sequence number that has been emitted */
    replayMaxSequence: number;
    /** Sequences at or below this have been permanently dropped */
    droppedBeforeSequence: number;
    /** Number of frames currently buffered */
    bufferedFrameCount: number;
}
/**
 * Result of a replay request, containing frames and buffer metadata.
 *
 * If replayable is false, the buffer has been partially evicted and
 * the client cannot recover all events since lastSequence.
 */
export interface StreamReplayResult {
    /** Whether full replay from lastSequence is possible */
    replayable: boolean;
    /** Frames newer than lastSequence */
    frames: StreamEventFrame[];
    /** Highest sequence number that has been emitted */
    replayMaxSequence: number;
    /** Lowest sequence number still available */
    earliestAvailableSequence: number;
    /** Sequences at or below this have been dropped */
    droppedBeforeSequence: number;
    /** Error code if replay is not possible, null otherwise */
    errorCode: "stream.replay_buffer_evicted" | null;
}
/**
 * A frame formatted for Server-Sent Events (SSE) transmission.
 * The SSE protocol requires an "event" type and "data" field.
 */
export interface SseFrame {
    /** Unique frame identifier in format "streamId:sequence" */
    id: string;
    /** SSE event type matching StreamEventFrame.eventType */
    event: StreamEventFrame["eventType"];
    /** JSON-stringified frame data */
    data: string;
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
export declare class StreamBridge {
    private readonly options;
    private readonly nextSequenceByStream;
    private readonly replayBuffer;
    private readonly droppedBeforeSequenceByStream;
    /**
     * Creates a new StreamBridge instance.
     * @param options - Configuration options (defaults applied if not provided)
     */
    constructor(options?: StreamBridgeOptions);
    /**
     * Generates a unique stream identifier.
     *
     * @param taskId - The task this stream is associated with
     * @param channel - The channel name for this stream
     * @returns A unique stream ID in format "channel_taskId_randomId"
     */
    createStreamId(taskId: string, channel: string): string;
    /**
     * Emits a new frame onto the stream with automatic sequence numbering.
     *
     * @param input - Frame data including streamId, taskId, channel, eventType, and payload
     * @param input.createdAt - Optional ISO timestamp (defaults to now)
     * @returns The emitted frame with assigned sequence number
     */
    emitFrame(input: {
        streamId: string;
        taskId: string;
        channel: string;
        eventType: StreamEventFrame["eventType"];
        payload: Record<string, unknown>;
        createdAt?: string;
    }): StreamEventFrame;
    /**
     * Emits a frame from an internal EventRecord, automatically mapping the event type.
     *
     * @param input - Contains streamId, channel, and the event to emit
     * @returns The emitted frame with assigned sequence number
     */
    emitFromEvent(input: {
        streamId: string;
        channel: string;
        event: EventRecord;
    }): StreamEventFrame;
    /**
     * Emits a message delta frame, typically used for streaming token output.
     *
     * @param input - Delta data including the text delta and optional role
     * @returns The emitted message_delta frame
     */
    emitMessageDelta(input: {
        streamId: string;
        taskId: string;
        channel: string;
        delta: string;
        role?: string;
        createdAt?: string;
    }): StreamEventFrame;
    /**
     * Requests replay of all frames after a given sequence number.
     *
     * @param streamId - The stream to replay from
     * @param lastSequence - The last sequence number the client has received
     * @returns ReplayResult with frames and buffer metadata; replayable=false if buffer was evicted
     */
    replay(streamId: string, lastSequence: number): StreamReplayResult;
    /**
     * Returns all buffered frames with sequence greater than specified.
     *
     * @param streamId - The stream to query
     * @param lastSequence - Return frames after this sequence
     * @returns Array of matching frames (may be empty)
     */
    replayAfterSequence(streamId: string, lastSequence: number): StreamEventFrame[];
    /**
     * Returns metadata about the current replay buffer state.
     *
     * @param streamId - The stream to query
     * @returns ReplayWindow with buffer statistics
     */
    getReplayWindow(streamId: string): StreamReplayWindow;
    /**
     * Converts a StreamEventFrame to SSE format for transmission.
     *
     * @param frame - The frame to convert
     * @returns SSE-formatted frame with id, event type, and stringified data
     */
    toSseFrame(frame: StreamEventFrame): SseFrame;
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
    private appendToReplayBuffer;
}
