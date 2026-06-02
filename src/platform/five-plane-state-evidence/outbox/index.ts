export interface StateEvidenceOutboxMessage {
  readonly messageId: string;
  readonly partitionKey: string;
  readonly eventType: string;
  readonly payload: unknown;
  readonly status: "pending" | "published" | "failed" | "dead_lettered";
  readonly attemptCount: number;
  readonly createdAt?: string;
}

export function createStateEvidenceOutboxMessage(
  message: StateEvidenceOutboxMessage,
): StateEvidenceOutboxMessage {
  return Object.freeze({
    ...message,
    createdAt: message.createdAt ?? new Date().toISOString(),
  });
}

export class StateEvidenceOutboxService {
  private readonly messages = new Map<string, StateEvidenceOutboxMessage>();

  public enqueue(message: StateEvidenceOutboxMessage): StateEvidenceOutboxMessage {
    const normalized = createStateEvidenceOutboxMessage(message);
    this.messages.set(normalized.messageId, normalized);
    return normalized;
  }

  public markPublished(messageId: string): StateEvidenceOutboxMessage | null {
    const message = this.messages.get(messageId) ?? null;
    if (message == null) {
      return null;
    }
    const updated = createStateEvidenceOutboxMessage({
      ...message,
      status: "published",
      attemptCount: message.attemptCount + 1,
    });
    this.messages.set(messageId, updated);
    return updated;
  }

  public listByStatus(status: StateEvidenceOutboxMessage["status"]): StateEvidenceOutboxMessage[] {
    return [...this.messages.values()].filter((message) => message.status === status);
  }
}
