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

export class ConversationClient {
  private readonly messages: ConversationMessage[] = [];
  private status: ConversationStatus = "idle";

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
