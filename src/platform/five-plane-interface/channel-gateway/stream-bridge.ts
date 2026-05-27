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
 *   * See: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: stream}
 *
 * - **Replay Buffer**: Finite event window for short disconnection recovery
 *   * See: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: replay buffer}
 *
 * - **Last-Event-ID**: SSE client declaration for resume position
 *   * See: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: Last-Event-ID}
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
import { ValidationError } from "../../contracts/errors.js";
import type { EventRecord } from "../../contracts/types/domain.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { z } from "zod";

const logger = new StructuredLogger({ retentionLimit: 100 });
const CLIENT_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{5,127}$/;

/**
 * Schema for validating task status change payloads.
 */
const TaskStatusChangePayloadSchema = z.object({
  toStatus: z.string().optional(),
});

/**
 * Schema for validating event record payloads at inter-plane boundary.
 */
const EventRecordPayloadSchema = z.record(z.unknown());

/**
 * Safely parses JSON with schema validation for inter-plane boundary.
 * @param jsonString - Raw JSON string to parse
 * @param schema - Zod schema for validation
 * @param errorContext - Context string for error messages
 * @returns Validated parsed object
 */
function safeJsonParse<T>(jsonString: string, schema: z.ZodType<T>, errorContext: string): T {
  try {
    const parsed = JSON.parse(jsonString);
    return schema.parse(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      logger.warn(`${errorContext}: schema validation failed`, { error: err.errors });
    }
    // Fallback: return object with raw content if schema validation fails
    return { originalJson: jsonString } as T;
  }
}

/**
 * Event types that can be dropped from the replay buffer when it exceeds max size.
 * These are "soft" events that clients can function without (status updates, progress, deltas).
 * Critical events like "completed", "failed", and "approval_requested" are always retained.
 */
const DROPPABLE_EVENT_TYPES = new Set<StreamEventFrame["eventType"]>(["status_changed", "progress", "message_delta"]);

export type StreamChannel = string;
export type TransportState = "connected" | "reconnecting" | "failed";

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
    | "failed"
    | "stream_gap";
  /** Monotonically increasing sequence number within the stream */
  sequence: number;
  /** Event-specific payload data */
  payload: Record<string, unknown>;
  /** ISO timestamp when frame was created */
  createdAt: string;
}

export type StreamEvent = StreamEventFrame;
export type ProgressChunk = StreamEventFrame & {
  eventType: "status_changed" | "progress" | "message_delta" | "artifact_ready" | "approval_requested";
};
export type FinalChunk = StreamEventFrame & { eventType: "completed" };
export type ErrorChunk = StreamEventFrame & { eventType: "failed" | "stream_gap" };

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
  /**
   * Maximum sequence lag before a client is considered a slow consumer.
   * @defaultValue 10
   */
  slowConsumerLagThreshold?: number;
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
 * Metadata about a client's stream connection including backpressure state.
 */
export interface ClientStreamState {
  readonly clientId: string;
  readonly streamId: string;
  /** Estimated buffered bytes for this client on this stream */
  bufferedBytes: number;
  /** Number of frames currently buffered for this client */
  bufferedFrameCount: number;
  /** Whether this client is in slow-consumer state */
  isSlowConsumer: boolean;
  /** Last time backpressure warning was sent */
  lastBackpressureWarningAt: string | null;
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

export interface StreamClientCursor {
  readonly clientId: string;
  readonly streamId: string;
  readonly lastSequence: number;
  readonly connectedAt: string;
  readonly updatedAt: string;
}

export interface StreamGapInfo {
  readonly clientId: string;
  readonly streamId: string;
  readonly expectedSequence: number;
  readonly earliestAvailableSequence: number;
  readonly replayMaxSequence: number;
  readonly gapSize: number;
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
      const payload = safeJsonParse(event.payloadJson, TaskStatusChangePayloadSchema, "mapEventType:task:status_changed");
      if (payload.toStatus === "done" || payload.toStatus === "completed") {
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
  private readonly clientCursors = new Map<string, StreamClientCursor>();
  private readonly clientIdsByStream = new Map<string, Set<string>>();
  private readonly transportStateByStream = new Map<string, TransportState>();
  // R18-35: Per-connection backpressure tracking
  private readonly clientBackpressureState = new Map<string, { bufferedBytes: number; bufferedFrameCount: number; lastWarningAt: string | null }>();
  private readonly SLOW_CONSUMER_BYTES_THRESHOLD = 1_000_000; // 1MB
  private readonly BACKPRESSURE_WARNING_INTERVAL_MS = 10_000; // 10 seconds between warnings

  /**
   * Creates a new StreamBridge instance.
   * @param options - Configuration options (defaults applied if not provided)
   */
  public constructor(options: StreamBridgeOptions = {}) {
    this.options = {
      maxReplayFrames: options.maxReplayFrames ?? 100,
      slowConsumerLagThreshold: options.slowConsumerLagThreshold ?? 10,
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
    return this.emitFrame({
      streamId: input.streamId,
      taskId: input.event.taskId ?? "unknown_task",
      channel: input.channel,
      eventType: mapEventType(input.event),
      payload: safeJsonParse(input.event.payloadJson, EventRecordPayloadSchema, "emitFromEvent"),
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
   * Registers a connected client against a stream so lag and replay gap can be tracked.
   */
  public registerClient(clientId: string, streamId: string, lastSequence = 0): void {
    assertValidClientId(clientId);
    const now = nowIso();
    this.clientCursors.set(clientId, {
      clientId,
      streamId,
      lastSequence,
      connectedAt: now,
      updatedAt: now,
    });
    const clients = this.clientIdsByStream.get(streamId) ?? new Set<string>();
    clients.add(clientId);
    this.clientIdsByStream.set(streamId, clients);
    // R18-35: Initialize per-client backpressure state
    this.clientBackpressureState.set(clientId, {
      bufferedBytes: 0,
      bufferedFrameCount: 0,
      lastWarningAt: null,
    });
  }

  /**
   * Removes a client registration from stream tracking.
   */
  public unregisterClient(clientId: string): void {
    const cursor = this.clientCursors.get(clientId);
    if (cursor == null) {
      return;
    }
    this.clientCursors.delete(clientId);
    this.clientBackpressureState.delete(clientId); // R18-35: Clean up backpressure state
    const clients = this.clientIdsByStream.get(cursor.streamId);
    clients?.delete(clientId);
    if (clients != null && clients.size === 0) {
      this.clientIdsByStream.delete(cursor.streamId);
    }
  }

  /**
   * Updates the highest acknowledged sequence number for a client.
   */
  public updateClientCursor(clientId: string, lastSequence: number): void {
    const existing = this.clientCursors.get(clientId);
    if (existing == null) {
      return;
    }
    this.clientCursors.set(clientId, {
      ...existing,
      lastSequence,
      updatedAt: nowIso(),
    });
  }

  /**
   * R18-35: Gets the backpressure state for a specific client.
   */
  public getClientBackpressureState(clientId: string): ClientStreamState | null {
    const cursor = this.clientCursors.get(clientId);
    const bpState = this.clientBackpressureState.get(clientId);
    if (cursor == null || bpState == null) {
      return null;
    }
    return {
      clientId,
      streamId: cursor.streamId,
      bufferedBytes: bpState.bufferedBytes,
      bufferedFrameCount: bpState.bufferedFrameCount,
      isSlowConsumer: this.isSlowConsumer(clientId),
      lastBackpressureWarningAt: bpState.lastWarningAt,
    };
  }

  /**
   * R18-35: Updates the buffered bytes estimate for a client and returns whether
   * a backpressure warning should be sent (rate-limited).
   */
  public updateClientBackpressure(clientId: string, bufferedBytes: number, bufferedFrameCount: number): boolean {
    const bpState = this.clientBackpressureState.get(clientId);
    if (bpState == null) {
      return false;
    }
    bpState.bufferedBytes = bufferedBytes;
    bpState.bufferedFrameCount = bufferedFrameCount;

    // Rate-limit backpressure warnings to once per interval
    const now = Date.now();
    const lastWarning = bpState.lastWarningAt ? new Date(bpState.lastWarningAt).getTime() : 0;
    if (bufferedBytes > this.SLOW_CONSUMER_BYTES_THRESHOLD && now - lastWarning >= this.BACKPRESSURE_WARNING_INTERVAL_MS) {
      bpState.lastWarningAt = new Date().toISOString();
      return true; // Caller should emit backpressure_warning event
    }
    return false;
  }

  /**
   * R18-35: Gets all clients in slow-consumer state for a stream.
   */
  public getSlowConsumerClients(streamId: string): ClientStreamState[] {
    const clientIds = this.clientIdsByStream.get(streamId) ?? new Set<string>();
    return Array.from(clientIds)
      .map((id) => this.getClientBackpressureState(id))
      .filter((state): state is ClientStreamState => state !== null && state.isSlowConsumer);
  }

  /**
   * Returns the number of currently tracked clients for a stream.
   */
  public getConnectedClientCount(streamId: string): number {
    return this.clientIdsByStream.get(streamId)?.size ?? 0;
  }

  /**
   * Returns true when a client's cursor lags too far behind the stream head
   * or when the client has already fallen behind the replay window.
   */
  public isSlowConsumer(clientId: string): boolean {
    const cursor = this.clientCursors.get(clientId);
    if (cursor == null) {
      return false;
    }
    if (this.detectStreamGap(clientId) != null) {
      return true;
    }
    const replayMaxSequence = this.nextSequenceByStream.get(cursor.streamId) ?? 0;
    return replayMaxSequence - cursor.lastSequence > this.options.slowConsumerLagThreshold;
  }

  /**
   * Lists all slow consumers currently attached to a stream.
   */
  public getSlowConsumers(streamId: string): string[] {
    const clientIds = this.clientIdsByStream.get(streamId) ?? new Set<string>();
    return Array.from(clientIds).filter((clientId) => this.isSlowConsumer(clientId));
  }

  /**
   * Detects whether a client has fallen behind the replay buffer window.
   */
  public detectStreamGap(clientId: string): StreamGapInfo | null {
    const cursor = this.clientCursors.get(clientId);
    if (cursor == null) {
      return null;
    }
    const replayWindow = this.getReplayWindow(cursor.streamId);
    const expectedSequence = cursor.lastSequence + 1;
    if (expectedSequence < replayWindow.earliestAvailableSequence || cursor.lastSequence < replayWindow.droppedBeforeSequence) {
      return {
        clientId,
        streamId: cursor.streamId,
        expectedSequence,
        earliestAvailableSequence: replayWindow.earliestAvailableSequence,
        replayMaxSequence: replayWindow.replayMaxSequence,
        gapSize: Math.max(0, replayWindow.earliestAvailableSequence - expectedSequence),
      };
    }
    return null;
  }

  /**
   * Emits a client-specific gap frame when replay can no longer cover the client's cursor.
   */
  public emitGapFrame(clientId: string): StreamEventFrame | null {
    const gap = this.detectStreamGap(clientId);
    if (gap == null) {
      return null;
    }
    return this.emitFrame({
      streamId: gap.streamId,
      taskId: this.getTaskIdForStream(gap.streamId),
      channel: "updates",
      eventType: "stream_gap",
      payload: {
        clientId: gap.clientId,
        expectedSequence: gap.expectedSequence,
        earliestAvailableSequence: gap.earliestAvailableSequence,
        replayMaxSequence: gap.replayMaxSequence,
        gapSize: gap.gapSize,
      },
    });
  }

  /**
   * Returns the transport state for a stream; defaults to connected.
   */
  public getTransportState(streamId: string): TransportState {
    return this.transportStateByStream.get(streamId) ?? "connected";
  }

  /**
   * Updates transport state for a stream.
   */
  public setTransportState(streamId: string, state: TransportState): void {
    this.transportStateByStream.set(streamId, state);
  }

  /**
   * Clears a single stream and any attached client tracking.
   */
  public closeStream(streamId: string): void {
    for (const clientId of Array.from(this.clientIdsByStream.get(streamId) ?? [])) {
      this.clientCursors.delete(clientId);
      this.clientBackpressureState.delete(clientId); // R18-35: Clean up backpressure state
    }
    this.clientIdsByStream.delete(streamId);
    this.nextSequenceByStream.delete(streamId);
    this.replayBuffer.delete(streamId);
    this.droppedBeforeSequenceByStream.delete(streamId);
    this.transportStateByStream.delete(streamId);
  }

  /**
   * Clears all stream state managed by this bridge.
   */
  public dispose(): void {
    this.clientCursors.clear();
    this.clientBackpressureState.clear(); // R18-35: Clear backpressure state
    this.clientIdsByStream.clear();
    this.nextSequenceByStream.clear();
    this.replayBuffer.clear();
    this.droppedBeforeSequenceByStream.clear();
    this.transportStateByStream.clear();
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
   * Appends a frame to the replay buffer, evicting old frames if necessary.
   *
 * When the buffer exceeds maxReplayFrames, it attempts to drop the oldest
 * frame that is marked as droppable. If no droppable frames exist, it drops
 * the oldest frame regardless of type so the replay buffer stays bounded.
   *
   * @param frame - The frame to append
   */
  private appendToReplayBuffer(frame: StreamEventFrame): void {
    const next = [...(this.replayBuffer.get(frame.streamId) ?? []), frame];

    while (next.length > this.options.maxReplayFrames) {
      const criticalEventTypes = new Set(["completed", "failed", "approval_requested"]);
      let indexToDrop = -1;
      for (let i = 0; i < next.length; i++) {
        const candidateFrame = next[i];
        if (candidateFrame && !criticalEventTypes.has(candidateFrame.eventType)) {
          indexToDrop = i;
          break;
        }
      }
      if (indexToDrop < 0) {
        indexToDrop = 0;
        logger?.warn?.("stream.replay_buffer_full_critical", {
          streamId: frame.streamId,
          frameSequence: frame.sequence,
          bufferedCount: next.length,
        });
      }
      const removed = next.splice(indexToDrop, 1)[0];
      if (removed != null) {
        const previousDropped = this.droppedBeforeSequenceByStream.get(frame.streamId) ?? 0;
        this.droppedBeforeSequenceByStream.set(frame.streamId, Math.max(previousDropped, removed.sequence));
      }
    }

    this.replayBuffer.set(frame.streamId, next);
  }

  private getTaskIdForStream(streamId: string): string {
    return this.replayBuffer.get(streamId)?.at(-1)?.taskId ?? "unknown_task";
  }

  /**
   * R18-35: Creates a stream_gap frame for a slow consumer whose buffered bytes
   * exceed the threshold. Callers (e.g., SSE server) should emit this to notify the client.
   *
   * @param clientId - The client to create a gap frame for
   * @returns A stream_gap frame if client is in slow-consumer state, null otherwise
   */
  public createSlowConsumerGapFrame(clientId: string): StreamEventFrame | null {
    const bpState = this.clientBackpressureState.get(clientId);
    if (bpState == null || bpState.bufferedBytes < this.SLOW_CONSUMER_BYTES_THRESHOLD) {
      return null;
    }
    const cursor = this.clientCursors.get(clientId);
    if (cursor == null) {
      return null;
    }
    // Emit a stream_gap with slow consumer reason
    return this.emitFrame({
      streamId: cursor.streamId,
      taskId: this.getTaskIdForStream(cursor.streamId),
      channel: "backpressure",
      eventType: "stream_gap",
      payload: {
        clientId,
        reason: "slow_consumer",
        bufferedBytes: bpState.bufferedBytes,
        bufferedFrameCount: bpState.bufferedFrameCount,
        thresholdBytes: this.SLOW_CONSUMER_BYTES_THRESHOLD,
      },
    });
  }

  /**
   * R18-35: Gets the current slow-consumer threshold in bytes.
   */
  public getSlowConsumerThresholdBytes(): number {
    return this.SLOW_CONSUMER_BYTES_THRESHOLD;
  }
}

function assertValidClientId(clientId: string): void {
  if (/^\d+$/.test(clientId)) {
    throw new ValidationError(
      "stream.client_id_enumerable",
      `stream.client_id_enumerable:${clientId}`,
      {
        source: "gateway",
        details: { clientId },
      },
    );
  }
  if (!CLIENT_ID_PATTERN.test(clientId)) {
    throw new ValidationError(
      "stream.client_id_invalid",
      `stream.client_id_invalid:${clientId}`,
      {
        source: "gateway",
        details: { clientId },
      },
    );
  }
}
