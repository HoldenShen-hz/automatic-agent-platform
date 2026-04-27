export interface StateEvidenceOutboxMessage {
  readonly messageId: string;
  readonly partitionKey: string;
  readonly eventType: string;
  readonly payload: unknown;
  readonly status: "pending" | "published" | "failed" | "dead_lettered";
  readonly attemptCount: number;
}

export function createStateEvidenceOutboxMessage(
  message: StateEvidenceOutboxMessage,
): StateEvidenceOutboxMessage {
  return message;
}
