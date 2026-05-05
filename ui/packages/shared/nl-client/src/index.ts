export type ConversationStatus =
  | "idle"
  | "parsing"
  | "clarifying"
  | "building"
  | "confirming"
  | "executing"
  | "reporting";

export interface ConversationMessage {
  readonly id: string;
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
}

export interface ConversationEventEnvelope {
  readonly channel: string;
  readonly type: string;
  readonly payload: unknown;
}

export interface ConversationTransport {
  subscribe(channel: string, handler: (event: ConversationEventEnvelope) => void): () => void;
  publish(event: ConversationEventEnvelope): void;
}

export interface ConversationSnapshot {
  readonly messages: readonly ConversationMessage[];
  readonly status: ConversationStatus;
  readonly planReady: boolean;
  readonly executionReady: boolean;
  readonly isStreaming: boolean;
}

export interface ConversationClientOptions {
  readonly transport?: ConversationTransport;
  readonly userId?: string;
  readonly initialMessages?: readonly ConversationMessage[];
  readonly onStateChange?: (snapshot: ConversationSnapshot) => void;
}

type WsMessagePayload = { role: "user" | "assistant" | "system"; content: string };

/**
 * Shared NL client that can either sync with backend realtime transport or
 * fall back to in-memory behavior for development/testing.
 */
export class ConversationClient {
  private readonly messages: ConversationMessage[];
  private status: ConversationStatus = "idle";
  private planReady = false;
  private executionReady = false;
  private isStreaming = false;
  private readonly transport: ConversationTransport | null;
  private readonly userId: string | null;
  private readonly onStateChange: ((snapshot: ConversationSnapshot) => void) | null;
  private readonly cleanup: Array<() => void> = [];

  constructor(options: ConversationClientOptions = {}) {
    this.messages = [...(options.initialMessages ?? [])];
    this.transport = options.transport ?? null;
    this.userId = options.userId ?? null;
    this.onStateChange = options.onStateChange ?? null;

    if (this.transport != null && this.userId != null) {
      this.attachRealtime(this.transport, this.userId);
    } else if (typeof console !== "undefined") {
      console.warn("[ConversationClient] In-memory fallback active. Provide transport+userId for backend sync.");
    }

    this.emitState();
  }

  public dispose(): void {
    while (this.cleanup.length > 0) {
      this.cleanup.pop()?.();
    }
    this.isStreaming = false;
    this.emitState();
  }

  public getSnapshot(): ConversationSnapshot {
    return {
      messages: this.listMessages(),
      status: this.status,
      planReady: this.planReady,
      executionReady: this.executionReady,
      isStreaming: this.isStreaming,
    };
  }

  public listMessages(): readonly ConversationMessage[] {
    return [...this.messages];
  }

  public getStatus(): ConversationStatus {
    return this.status;
  }

  public isRealtimeConnected(): boolean {
    return this.transport != null && this.userId != null;
  }

  public send(content: string): ConversationMessage {
    const message = this.appendMessage("user", content);
    this.status = "parsing";
    this.planReady = false;
    this.executionReady = false;
    if (this.transport != null && this.userId != null) {
      this.transport.publish({
        channel: `nl.session.${this.userId}`,
        type: "nl.prompt.sent",
        payload: { content, userId: this.userId },
      });
    }
    this.emitState();
    return message;
  }

  public pushAssistant(content: string): ConversationMessage {
    this.status = "reporting";
    const message = this.appendMessage("assistant", content);
    this.emitState();
    return message;
  }

  public requestClarification(content: string): ConversationMessage {
    this.status = "clarifying";
    const message = this.appendMessage("assistant", content);
    if (this.transport != null && this.userId != null) {
      this.transport.publish({
        channel: `nl.session.${this.userId}`,
        type: "nl.clarification.requested",
        payload: { userId: this.userId, question: content },
      });
    }
    this.emitState();
    return message;
  }

  public buildPlan(content: string): ConversationMessage {
    this.status = "building";
    this.planReady = this.transport == null;
    this.executionReady = false;
    const message = this.appendMessage("system", content);
    if (this.transport != null && this.userId != null) {
      this.transport.publish({
        channel: `nl.session.${this.userId}`,
        type: "nl.plan.requested",
        payload: { userId: this.userId },
      });
    }
    this.emitState();
    return message;
  }

  public confirm(content: string): ConversationMessage {
    this.status = "confirming";
    this.executionReady = true;
    const message = this.appendMessage("assistant", content);
    if (this.transport != null && this.userId != null) {
      this.transport.publish({
        channel: `nl.session.${this.userId}`,
        type: "nl.plan.confirmed",
        payload: { userId: this.userId },
      });
    }
    this.emitState();
    return message;
  }

  public execute(content: string): ConversationMessage {
    this.status = "executing";
    const message = this.appendMessage("system", content);
    if (this.transport != null && this.userId != null) {
      this.transport.publish({
        channel: `nl.session.${this.userId}`,
        type: "nl.execution.started",
        payload: { userId: this.userId },
      });
    }
    this.emitState();
    return message;
  }

  private attachRealtime(transport: ConversationTransport, userId: string): void {
    this.isStreaming = true;
    this.cleanup.push(
      transport.subscribe(`nl.session.${userId}`, (event) => {
        if (event.type !== "nl.session.updated") {
          return;
        }
        const payload = event.payload as {
          status?: ConversationStatus;
          messages?: WsMessagePayload[];
        };
        if (payload.status != null) {
          this.status = payload.status;
        }
        if (payload.messages != null) {
          this.messages.splice(
            0,
            this.messages.length,
            ...payload.messages.map((message, index) => ({
              id: `ws-${index}`,
              role: message.role,
              content: message.content,
            })),
          );
        }
        this.emitState();
      }),
    );
    this.cleanup.push(
      transport.subscribe("nl.plan.created", (event) => {
        if (event.type !== "nl.plan.created") {
          return;
        }
        const payload = event.payload as { planBundle?: unknown; planReady?: boolean };
        if (payload.planBundle != null || payload.planReady === true) {
          this.planReady = payload.planReady ?? true;
          this.emitState();
        }
      }),
    );
  }

  private appendMessage(
    role: ConversationMessage["role"],
    content: string,
  ): ConversationMessage {
    const message: ConversationMessage = {
      id: `msg-${this.messages.length + 1}`,
      role,
      content,
    };
    this.messages.push(message);
    return message;
  }

  private emitState(): void {
    this.onStateChange?.(this.getSnapshot());
  }
}
