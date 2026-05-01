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

/接受
/**
 * In-memory conversation client for testing/development only.
 *
 * §205-2418: WARNING - This client does NOT interact with any backend.
 * Root cause: Previously claimed to be a client but had no backend interaction.
 * UI state will diverge from backend truth when using this client.
 * Use WebSocket-based WSClient for production communication.
 */
export class ConversationClient {
  private readonly messages: ConversationMessage[] = [];
  private status: ConversationStatus = "idle";

  constructor() {
    // Warn in development about using in-memory client
    if (typeof console !== 'undefined') {
      console.warn("[ConversationClient] In-memory client active. UI state not synced with backend. Use WSClient in production.");
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
    return message;
  }

  public buildPlan(content: string): ConversationMessage {
    this.status = "building";
    const message: ConversationMessage = {
      id: `msg-${this.messages.length + 1}`,
      role: "system",
      content,
    };
    this.messages.push(message);
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
    return message;
  }
}
