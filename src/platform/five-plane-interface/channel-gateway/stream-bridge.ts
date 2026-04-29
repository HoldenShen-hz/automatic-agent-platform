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
import type { EventRecord } from "../../contracts/types/domain.js";
import { z } from "zod";

/**
 * Event types that can be dropped from the replay buffer when it exceeds max size.
 * These are "soft" events that clients can function without (status updates, progress, deltas).
 * Critical events like "completed", "failed", and "approval_requested" are always retained.
 */
const DROPPABLE_EVENT_TYPES = new Set<StreamEventFrame["eventType"]>(["status_changed", "progress", "message_delta"]);

/**
 * Schema for validating event payload JSON in mapEventType.
 * §5.2: All inter-plane boundary JSON must be schema-validated.
 */
const taskStatusChangedPayloadSchema = z.object({
  toStatus: z.string().optional(),
});

/**
 * Schema for validating event payload JSON in emitFromEvent.
 * §5.2: All inter-plane boundary JSON must be schema-validated.
 */
const genericEventPayloadSchema = z.record(z.unknown());

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
  eventType:
    | "status_changed"
    | "progress"
    | "message_delta"
    | "artifact_ready"
    | "approval_requested"
    | "completed"
    | "failed";
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
 * Maps internal EventRecord types to StreamEventFrame event types.
 *
 * This translation layer adapts domain events to stream-compatible types.
 * Terminal states (done, failed, completed) are specially mapped to allow
 * clients to easily identify when a stream has finished.
 *
 * @param event - The internal event record to map
 * @returns The corresponding stream event type
 */
function mapEventType(event: EventRecord): StreamEventFrame["eventType"] {
  switch (event.eventType) {
    case "task:status_changed": {
      // §5.2: Schema-validated parsing at inter-plane boundary
      const parsed = taskStatusChangedPayloadSchema.safeParse(JSON.parse(event.payloadJson));
      const payload = parsed.success ? parsed.data : { toStatus: undefined };
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
  private readonly options: Required<StreamBridgeOptions>;
  private readonly nextSequenceByStream = new Map<string, number>();
  private readonly replayBuffer = new Map<string, StreamEventFrame[]>();
  private readonly droppedBeforeSequenceByStream = new Map<string, number>();

  /**
   * Creates a new StreamBridge instance.
   * @param options - Configuration options (defaults applied if not provided)
   */
  public constructor(options: StreamBridgeOptions = {}) {
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
  public createStreamId(taskId: string, channel: string): string {
    return `${channel}_${taskId}_${newId("stream")}`;
  }

  /**
   * Emits a new frame onto the stream with automatic sequence numbering.
   *
   * @param input - Frame data including streamId, taskId, channel, eventType, and payload
   * @param input.createdAt - Optional ISO timestamp (defaults to now)
   * @returns The emitted frame with assigned sequence number
   */
  public emitFrame(input: {
    streamId: string;
    taskId: string;
    channel: string;
    eventType: StreamEventFrame["eventType"];
    payload: Record<string, unknown>;
    createdAt?: string;
  }): StreamEventFrame {
    const sequence = (this.nextSequenceByStream.get(input.streamId) ?? 0) + 1;
    this.nextSequenceByStream.set(input.streamId, sequence);

    const frame: StreamEventFrame = {
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
  public emitFromEvent(input: { streamId: string; channel: string; event: EventRecord }): StreamEventFrame {
    // §5.2: Schema-validated parsing at inter-plane boundary
    const parsed = genericEventPayloadSchema.safeParse(JSON.parse(input.event.payloadJson));
    const payload = parsed.success ? parsed.data : {};
    return this.emitFrame({
      streamId: input.streamId,
      taskId: input.event.taskId ?? "unknown_task",
      channel: input.channel,
      eventType: mapEventType(input.event),
      payload,
      createdAt: input.event.createdAt,
    });
  }

  /**
   * Emits a message delta frame, typically used for streaming token output.
   *
   * @param input - Delta data including the text delta and optional role
   * @returns The emitted message_delta frame
   */
  public emitMessageDelta(input: {
    streamId: string;
    taskId: string;
    channel: string;
    delta: string;
    role?: string;
    createdAt?: string;
  }): StreamEventFrame {
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
  public replay(streamId: string, lastSequence: number): StreamReplayResult {
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
  public replayAfterSequence(streamId: string, lastSequence: number): StreamEventFrame[] {
    return (this.replayBuffer.get(streamId) ?? []).filter((frame) => frame.sequence > lastSequence);
  }

  /**
   * Returns metadata about the current replay buffer state.
   *
   * @param streamId - The stream to query
   * @returns ReplayWindow with buffer statistics
   */
  public getReplayWindow(streamId: string): StreamReplayWindow {
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
  public toSseFrame(frame: StreamEventFrame): SseFrame {
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
   * Critical event types that must NEVER be dropped from replay buffer.
   * These terminal states and approval requests are essential for clients
   * to receive final workflow outcomes.
   */
const CRITICAL_EVENT_TYPES = new Set<StreamEventFrame["eventType"]>([
    "completed",
    "failed",
    "approval_requested",
    "artifact_ready",
  ]);

  /**
   * Appends a frame to the replay buffer, evicting old frames if necessary.
   *
   * When the buffer exceeds maxReplayFrames, it attempts to drop the oldest
   * droppable frame (status_changed, progress, message_delta). Critical events
   * (completed, failed, approval_requested, artifact_ready) are NEVER dropped.
   * If all buffered frames are critical, the new frame is dropped instead.
   *
   * @param frame - The frame to append
   */
  private appendToReplayBuffer(frame: StreamEventFrame): void {
    const next = [...(this.replayBuffer.get(frame.streamId) ?? []), frame];

    // If buffer exceeds limit, try to evict oldest droppable frame
    while (next.length > this.options.maxReplayFrames) {
      // Find the first droppable frame from oldest (index 0) onwards
      const indexToDrop = next.findIndex((candidate) => DROPPABLE_EVENT_TYPES.has(candidate.eventType));

      // Only drop if we found a droppable frame; never drop critical events
      if (indexToDrop >= 0) {
        const removed = next.splice(indexToDrop, 1)[0];
        if (removed != null) {
          // Track the lowest dropped sequence so clients know buffer was truncated
          const previousDropped = this.droppedBeforeSequenceByStream.get(frame.streamId) ?? 0;
          this.droppedBeforeSequenceByStream.set(frame.streamId, Math.max(previousDropped, removed.sequence));
        }
      } else {
        // All frames are critical - drop the NEW frame (the one we just appended)
        // This preserves historical critical events at the cost of losing the new one
        next.pop();
        break;
      }
    }

    this.replayBuffer.set(frame.streamId, next);
  }
}
