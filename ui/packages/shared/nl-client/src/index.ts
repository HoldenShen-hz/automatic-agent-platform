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

export interface ConversationSnapshot {
  readonly messages: readonly ConversationMessage[];
  readonly status: ConversationStatus;
  readonly planReady: boolean;
  readonly isStreaming: boolean;
}

export interface ConversationClientOptions {
  readonly initialMessages?: readonly ConversationMessage[];
  readonly transport?: {
    subscribe(channel: string, handler: (event: { type: string; payload: unknown }) => void): () => void;
  };
  readonly userId?: string;
  readonly onStateChange?: (snapshot: ConversationSnapshot) => void;
}

export class ConversationClient {
  private readonly messages: ConversationMessage[] = [];
  private status: ConversationStatus = "idle";
  private planReady = false;
  private isStreaming = false;
  private readonly unsubscribers: Array<() => void> = [];

  public constructor(private readonly options: ConversationClientOptions = {}) {
    if (Array.isArray(options.initialMessages) && options.initialMessages.length > 0) {
      this.messages.push(...options.initialMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
      })));
    }
    if (options.transport != null && options.userId != null) {
      this.isStreaming = true;
      this.unsubscribers.push(
        options.transport.subscribe(`nl.session.${options.userId}`, (event) => {
          if (event.type !== "nl.session.updated") {
            return;
          }
          const payload = event.payload as {
            status?: ConversationStatus;
            messages?: Array<{ role: ConversationMessage["role"]; content: string }>;
          };
          this.status = payload.status ?? this.status;
          if (Array.isArray(payload.messages)) {
            this.messages.length = 0;
            for (const message of payload.messages) {
              this.messages.push({
                id: `msg-${this.messages.length + 1}`,
                role: message.role,
                content: message.content,
              });
            }
          }
          this.emitStateChange();
        }),
      );
      this.unsubscribers.push(
        options.transport.subscribe("nl.plan.created", (event) => {
          if (event.type !== "nl.plan.created") {
            return;
          }
          const payload = event.payload as { planReady?: boolean };
          this.planReady = payload.planReady ?? true;
          this.emitStateChange();
        }),
      );
    }
  }

  public listMessages(): readonly ConversationMessage[] {
    return this.messages;
  }

  public getStatus(): ConversationStatus {
    return this.status;
  }

  public send(content: string): ConversationMessage {
    this.status = "parsing";
    const message: ConversationMessage = {
      id: `msg-${this.messages.length + 1}`,
      role: "user",
      content,
    };
    this.messages.push(message);
    this.emitStateChange();
    return message;
  }

  public pushAssistant(content: string): ConversationMessage {
    this.status = "reporting";
    const message: ConversationMessage = {
      id: `msg-${this.messages.length + 1}`,
      role: "assistant",
      content,
    };
    this.messages.push(message);
    this.emitStateChange();
    return message;
  }

  public requestClarification(content: string): ConversationMessage {
    this.status = "clarifying";
    const message: ConversationMessage = {
      id: `msg-${this.messages.length + 1}`,
      role: "assistant",
      content,
    };
    this.messages.push(message);
    this.emitStateChange();
    return message;
  }

  public buildPlan(content: string): ConversationMessage {
    this.status = "building";
    this.planReady = true;
    const message: ConversationMessage = {
      id: `msg-${this.messages.length + 1}`,
      role: "system",
      content,
    };
    this.messages.push(message);
    this.emitStateChange();
    return message;
  }

  public confirm(content: string): ConversationMessage {
    this.status = "confirming";
    const message: ConversationMessage = {
      id: `msg-${this.messages.length + 1}`,
      role: "assistant",
      content,
    };
    this.messages.push(message);
    this.emitStateChange();
    return message;
  }

  public execute(content: string): ConversationMessage {
    this.status = "executing";
    const message: ConversationMessage = {
      id: `msg-${this.messages.length + 1}`,
      role: "system",
      content,
    };
    this.messages.push(message);
    this.emitStateChange();
    return message;
  }

  public getSnapshot(): ConversationSnapshot {
    return {
      messages: [...this.messages],
      status: this.status,
      planReady: this.planReady,
      isStreaming: this.isStreaming,
    };
  }

  public dispose(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;
    this.isStreaming = false;
    this.emitStateChange();
  }

  private emitStateChange(): void {
    this.options.onStateChange?.(this.getSnapshot());
  }
}
