/**
 * @fileoverview Session Types - Session, message, event, and approval records.
 *
 * Contains records related to interaction sessions, messaging,
 * event log, and human-in-the-loop approval.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

import type {
  MessageDirection,
  RemoteLogLevel,
  CompactionStage,
  TakeoverSessionStatus,
  OperatorActionType,
  EventTier,
  EventConsumerAckStatus,
  GatewayTargetKind,
  GatewayTargetSource,
  MessagePartType,
  Timestamp,
} from "./primitives.js";
import type {
  ApprovalStatus,
  SessionStatus,
} from "../status.js";

// ---------------------------------------------------------------------------
// Session record
// ---------------------------------------------------------------------------

/**
 * Session record - represents a live interaction channel for a task.
 *
 * Sessions track the communication channel (CLI, API, web) and current state.
 * A task may have multiple sessions over its lifetime (re-opened after completion).
 * The session receives streaming updates and human input during execution.
 */
export interface SessionRecord {
  id: string;
  taskId: string;
  channel: string;
  status: SessionStatus;
  externalSessionId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Gateway target record
// ---------------------------------------------------------------------------

/**
 * Gateway target record - tracks message routing targets (users, rooms, groups).
 *
 * The gateway routes messages to various target types based on the targetKind.
 * Aliases allow targeting the same entity via multiple identifiers.
 * External targets integrate with third-party messaging systems.
 */
export interface GatewayTargetRecord {
  targetId: string;
  channel: string;
  targetKind: GatewayTargetKind;
  externalTargetId: string | null;
  displayName: string;
  aliasesJson: string;
  metadataJson: string | null;
  source: GatewayTargetSource;
  lastSeenAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Message records
// ---------------------------------------------------------------------------

/**
 * Message record - represents a single message within a session.
 *
 * Messages flow in both directions (inbound from user, outbound to user, system).
 * The partsJson supports structured message content with multiple parts (text, tool calls, etc.).
 */
export interface MessageRecord {
  id: string;
  sessionId: string;
  direction: MessageDirection;
  messageType: string;
  content: string;
  partsJson?: string | null;
  attachmentsJson: string | null;
  createdAt: Timestamp;
}

/**
 * Message part - a structured component within a compound message.
 *
 * Messages can be decomposed into typed parts for richer content (tool calls,
 * reasoning traces, artifacts, etc.). Each part has a sequence number for ordering.
 */
export interface MessagePart {
  partId: string;
  messageId: string;
  partType: MessagePartType;
  sequence: number;
  contentJson: string;
  lineageJson: string | null;
  createdAt: Timestamp;
}


// ---------------------------------------------------------------------------
// Remote log record
// ---------------------------------------------------------------------------

/**
 * Remote log record - captures structured log output from remote workers.
 *
 * When workers run on remote machines, their logs are streamed back and
 * stored for debugging. The contextJson captures variable state at log time.
 */
export interface RemoteLogRecord {
  id: string;
  taskId: string;
  executionId: string;
  workerId: string;
  runtimeInstanceId: string | null;
  level: RemoteLogLevel;
  message: string;
  contextJson: string | null;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Approval record
// ---------------------------------------------------------------------------

/**
 * Approval record - tracks human-in-the-loop (HITL) approval requests.
 *
 * When an execution encounters a high-risk action, it pauses and requests
 * human approval. The requestJson captures the action details, risk level,
 * and available response options. Responses are stored in responseJson.
 */
export interface ApprovalRecord {
  id: string;
  taskId: string;
  executionId: string | null;
  status: ApprovalStatus;
  requestJson: string;
  responseJson: string | null;
  timeoutPolicy: string;
  createdAt: Timestamp;
  respondedAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Takeover session and operator action records
// ---------------------------------------------------------------------------

/**
 * Takeover session record - tracks human operator intervention sessions.
 *
 * When an operator takes over a task (e.g., for debugging or correction),
 * a takeover session is opened. The operator performs actions within this
 * session, all of which are recorded for audit purposes.
 */
export interface TakeoverSessionRecord {
  id: string;
  taskId: string;
  executionId: string | null;
  operatorId: string;
  status: TakeoverSessionStatus;
  reasonCode: string;
  startedAt: Timestamp;
  closedAt: Timestamp | null;
}

/**
 * Operator action record - audit trail of a single action taken during takeover.
 *
 * Records the action taken (modify_input, retry_execution, etc.) along with
 * before/after state snapshots to understand the impact and enable rollback
 * if needed. All actions are immutable once recorded.
 */
export interface OperatorActionRecord {
  id: string;
  takeoverSessionId: string;
  taskId: string;
  executionId: string | null;
  operatorId: string;
  actionType: OperatorActionType;
  reasonCode: string;
  actionPayloadJson: string;
  beforeStateJson: string;
  afterStateJson: string;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Compaction record
// ---------------------------------------------------------------------------

/**
 * Compaction record - tracks context window compaction operations.
 *
 * When the LLM context approaches its limit, the system performs compaction
 * in two stages: trim (removes old tool results) then summarize (compresses
 * to key insights). This record tracks what was compacted and the reduction.
 */
export interface CompactionRecord {
  id: string;
  sessionId: string;
  taskId: string;
  stage: CompactionStage;
  sourceMessageIdsJson: string;
  /** §14.2: Message range covered by this compaction (start_index-end_index) */
  coveredMessageRange: string | null;
  summaryText: string | null;
  summaryRef: string | null;
  compactionReason: string;
  overflowTriggered: 0 | 1;
  autoTriggered: 0 | 1;
  tokenReductionEstimate: number;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Event records
// ---------------------------------------------------------------------------

/**
 * Event record - an immutable fact in the system's event log.
 *
 * Events record what happened in the system for auditing, replay, and debugging.
 * Events are tiered by reliability: tier_1 requires consumer ack, tier_2 is
 * at-least-once, tier_3 is best-effort. The payloadJson contains event-specific data.
 *
 * §28.1: EventRecord now includes all required fields per the event contract:
 * - sequence: monotonic run-level ordering for replay
 * - causationId: tracks direct cause event for chain reconstruction
 * - correlationId: links related events across the same workflow/execution
 * - payloadHash: integrity verification for replay safety
 * - idempotencyKey: duplicate detection to prevent reprocessing
 */
export interface EventRecord {
  id: string;
  taskId: string | null;
  sessionId: string | null;
  executionId: string | null;
  eventType: string;
  eventTier: EventTier;
  payloadJson: string;
  traceId: string | null;
  createdAt: Timestamp;
  // §28.1 fields for replay ordering and audit - optional for callers
  schemaVersion?: string | null;
  aggregateId?: string | null;
  runId?: string | null;
  sequence?: number | null;
  // §28.1 causation tracking for event chain reconstruction
  causationId?: string | null;
  correlationId?: string | null;
  // §28.1 payload integrity for replay verification
  payloadHash?: string | null;
  // §28.1 idempotency key for duplicate detection
  idempotencyKey?: string | null;
  replayBehavior?: "replay_as_fact" | "skip_side_effect" | "simulate" | "forbidden" | null;
  principal?: string | null;
  evidenceRefs?: readonly string[];
}

/**
 * Event consumer ack record - tracks tier-1 event delivery acknowledgements.
 *
 * Tier-1 events require explicit acknowledgement from registered consumers.
 * This record tracks delivery status, retry attempts, and any errors that occurred.
 * Pending acks are replayed on startup to ensure no events are lost.
 */
export interface EventConsumerAckRecord {
  id: string;
  eventId: string;
  consumerId: string;
  status: EventConsumerAckStatus;
  lastAttemptAt: Timestamp | null;
  ackedAt: Timestamp | null;
  errorCode: string | null;
  attemptCount: number;
}

// ---------------------------------------------------------------------------
// Event dead letter record
// ---------------------------------------------------------------------------

/**
 * Event dead letter record - preserves failed event deliveries for inspection.
 *
 * When an event fails delivery to a consumer after all retries, it is moved
 * to the dead letter queue. The record preserves the original event, failure
 * context, and any reprocess attempts.
 */
export interface EventDeadLetterRecord {
  id: string;
  originalEventId: string;
  eventType: string;
  payloadJson: string;
  consumerId: string;
  failureCount: number;
  lastError: string | null;
  deadLetteredAt: Timestamp;
  reprocessedAt: Timestamp | null;
  reprocessResult: string | null;
}

// ---------------------------------------------------------------------------
// Session event record
// ---------------------------------------------------------------------------

/**
 * Session event record - tracks events that occur within a session.
 *
 * Session events provide a timeline of what happened during a session,
 * including user interactions, system responses, and state changes.
 */
export interface SessionEventRecord {
  id: string;
  sessionId: string;
  eventType: string;
  payloadJson: string;
  createdAt: Timestamp;
}
