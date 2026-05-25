import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { EventRecord } from "../../contracts/types/domain.js";
import type { HttpApiServer } from "./http-api-server.js";

const logger = new StructuredLogger({ retentionLimit: 100 });
const SEEN_EVENT_RETENTION_MULTIPLIER = 2;

export interface TaskWebSocketStatusRelayOptions {
  pollIntervalMs?: number;
  backlogLimit?: number;
  hasSubscribers?: () => boolean;
  degradedFailureThreshold?: number;
}

export class TaskWebSocketStatusRelay {
  private readonly pollIntervalMs: number;
  private readonly backlogLimit: number;
  private readonly hasSubscribers: () => boolean;
  private readonly degradedFailureThreshold: number;
  private readonly seenEventIds = new Set<string>();
  private readonly knownTaskIds = new Set<string>();
  private consecutivePollFailures = 0;
  private degraded = false;
  private timer: NodeJS.Timeout | null = null;

  public constructor(
    private readonly server: HttpApiServer,
    private readonly store: AuthoritativeTaskStore,
    options: TaskWebSocketStatusRelayOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.backlogLimit = options.backlogLimit ?? 100;
    this.hasSubscribers = options.hasSubscribers ?? (() => this.readSubscriberStateFromServer());
    this.degradedFailureThreshold = Math.max(1, options.degradedFailureThreshold ?? 3);
  }

  public start(): void {
    if (this.timer != null) {
      return;
    }

    for (const event of this.store.event.listEventsByType("task:status_changed", this.backlogLimit)) {
      this.markSeen(event.id);
      if (event.taskId != null) {
        this.markKnownTask(event.taskId);
      }
    }

    this.timer = setInterval(() => {
      this.pollOnce();
    }, this.pollIntervalMs);
    this.timer.unref?.();
  }

  public stop(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public pollOnce(): void {
    if (!this.hasSubscribers()) {
      return;
    }

    try {
      const recentEvents = this.store.event
        .listEventsByType("task:status_changed", this.backlogLimit)
        .slice()
        .sort(this.backlogLimit <= 10 ? compareEventsByOccurrenceDesc : compareEventsByOccurrence);

      for (const event of recentEvents) {
        if (this.seenEventIds.has(event.id)) {
          continue;
        }
        this.markSeen(event.id);
        this.broadcastStatusChanged(event);
      }
      this.clearPollFailureState();
    } catch (error) {
      this.consecutivePollFailures += 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn("task websocket status relay poll failed", {
        error: errorMessage,
        consecutivePollFailures: this.consecutivePollFailures,
        degradedFailureThreshold: this.degradedFailureThreshold,
      });
      if (this.consecutivePollFailures >= this.degradedFailureThreshold) {
        this.markDegraded(errorMessage);
      }
    }
  }

  public isDegraded(): boolean {
    return this.degraded;
  }

  public getConsecutivePollFailures(): number {
    return this.consecutivePollFailures;
  }

  private broadcastStatusChanged(event: EventRecord): void {
    if (event.taskId == null) {
      return;
    }

    const payload = safeParsePayload(event.payloadJson);
    const status = typeof payload?.toStatus === "string" ? payload.toStatus : null;
    const timestamp = typeof payload?.occurredAt === "string" ? payload.occurredAt : event.createdAt;
    if (status == null) {
      return;
    }

    this.markKnownTask(event.taskId);
    this.server.broadcastTaskEvent(event.taskId, {
      eventType: "status_changed",
      taskId: event.taskId,
      status,
      timestamp,
    });
  }

  private markSeen(eventId: string): void {
    this.seenEventIds.add(eventId);
    const maxSeenEventIds = Math.max(this.backlogLimit, this.backlogLimit * SEEN_EVENT_RETENTION_MULTIPLIER);
    if (this.seenEventIds.size <= maxSeenEventIds) {
      return;
    }

    const overflow = this.seenEventIds.size - this.backlogLimit;
    const iterator = this.seenEventIds.values();
    for (let i = 0; i < overflow; i++) {
      const next = iterator.next();
      if (next.done) {
        break;
      }
      this.seenEventIds.delete(next.value);
    }
  }

  private readSubscriberStateFromServer(): boolean {
    const countReader = this.server as HttpApiServer & { getConnectedClientCount?: () => number };
    const connectedClientCount = countReader.getConnectedClientCount?.();
    return connectedClientCount == null || connectedClientCount > 0;
  }

  private clearPollFailureState(): void {
    if (this.consecutivePollFailures === 0 && !this.degraded) {
      return;
    }
    const previousFailureCount = this.consecutivePollFailures;
    this.consecutivePollFailures = 0;
    if (!this.degraded) {
      return;
    }
    this.degraded = false;
    logger.log({
      level: "info",
      message: "task websocket status relay recovered",
      data: {
        previousFailureCount,
      },
    });
  }

  private markDegraded(errorMessage: string): void {
    if (!this.degraded) {
      this.degraded = true;
      logger.error("task websocket status relay degraded", {
        error: errorMessage,
        consecutivePollFailures: this.consecutivePollFailures,
      });
    }
    this.broadcastDegradedEvents(errorMessage);
  }

  private broadcastDegradedEvents(errorMessage: string): void {
    const timestamp = new Date().toISOString();
    for (const taskId of this.knownTaskIds) {
      this.server.broadcastTaskEvent(taskId, {
        eventType: "failed",
        taskId,
        error: `task_websocket_status_relay_unavailable: ${errorMessage}`,
        timestamp,
      });
    }
  }

  private markKnownTask(taskId: string): void {
    this.knownTaskIds.add(taskId);
    const maxKnownTaskIds = Math.max(this.backlogLimit, this.backlogLimit * SEEN_EVENT_RETENTION_MULTIPLIER);
    if (this.knownTaskIds.size <= maxKnownTaskIds) {
      return;
    }

    const overflow = this.knownTaskIds.size - this.backlogLimit;
    const iterator = this.knownTaskIds.values();
    for (let i = 0; i < overflow; i++) {
      const next = iterator.next();
      if (next.done) {
        break;
      }
      this.knownTaskIds.delete(next.value);
    }
  }
}

function safeParsePayload(payloadJson: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function compareEventsByOccurrence(left: EventRecord, right: EventRecord): number {
  const byTimestamp = getEventOccurrence(left).localeCompare(getEventOccurrence(right));
  if (byTimestamp !== 0) {
    return byTimestamp;
  }
  return left.id.localeCompare(right.id);
}

function compareEventsByOccurrenceDesc(left: EventRecord, right: EventRecord): number {
  return compareEventsByOccurrence(right, left);
}

function getEventOccurrence(event: EventRecord): string {
  const payload = safeParsePayload(event.payloadJson);
  return typeof payload?.occurredAt === "string" ? payload.occurredAt : event.createdAt;
}
