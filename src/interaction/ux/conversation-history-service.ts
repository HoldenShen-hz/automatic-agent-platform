/**
 * Conversation History Service
 *
 * Provides persistent conversation history storage using the memory store.
 * Implements §45 "Conversation History Persistence" requirement.
 *
 * @see docs_en/reviews/architecture-design-vs-implementation-review.md §45
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type { MemoryRecord, MemorySourceTrustLevel } from "../../platform/contracts/types/domain.js";
import type { MemoryService } from "../../platform/state-evidence/memory/index.js";
import type { DetectedIntent } from "../nl-gateway/index.js";

// UI spec R7-27: nl.clarification_needed event type for real-time WS push
export interface ClarificationNeededEvent {
  readonly type: "nl.clarification_needed";
  readonly sessionId: string;
  readonly turnId: string;
  readonly prompt: string;
  readonly timestamp: string;
}

/**
 * Conversation turn record
 */
export interface ConversationTurnRecord {
  readonly turnId: string;
  readonly role: "user" | "assistant" | "system";
  readonly message: string;
  readonly intent?: DetectedIntent["intentType"];
  readonly confidence?: number;
  readonly entities?: Record<string, string>;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown>;
  // UI spec §45 required fields per R7-26
  readonly clarificationState?: "awaiting_response" | "responded" | "not_needed";
  readonly riskPreview?: {
    readonly riskLevel: "low" | "medium" | "high" | "critical";
    readonly riskFactors: readonly string[];
    readonly mitigationSuggestions: readonly string[];
  };
  readonly actionOptions?: readonly {
    readonly actionId: string;
    readonly label: string;
    readonly intent: string;
  }[];
}

/**
 * Conversation session record
 */
export interface ConversationSessionRecord {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly turns: readonly ConversationTurnRecord[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastIntent?: DetectedIntent["intentType"];
  readonly status: "active" | "completed" | "abandoned";
  // UI spec §45 required field
  readonly pendingClarificationCount?: number;
}

/**
 * Options for storing conversation history
 */
export interface ConversationHistoryOptions {
  readonly memoryLayer?: MemoryRecord["memoryLayer"];
  readonly scope?: string;
  readonly retentionDays?: number;
  readonly dataHandling?: "standard" | "restricted" | "regulated";
}

/**
 * Conversation History Service
 *
 * Persists conversation history to memory store for durability.
 * Supports session management, turn tracking, and history retrieval.
 */
export class ConversationHistoryService {
  private readonly memoryService: MemoryService | null;
  private readonly defaultScope = "conversation";
  private readonly defaultRetentionDays = 90;
  private eventEmitter: ((event: ClarificationNeededEvent) => void) | null = null;

  /**
   * UI spec R7-27: Set the event emitter for nl.clarification_needed real-time push.
   * This enables the service to emit WebSocket events when clarification is needed.
   */
  public setEventEmitter(emitter: (event: ClarificationNeededEvent) => void): void {
    this.eventEmitter = emitter;
  }

  /**
   * UI spec R7-27: Emit nl.clarification_needed event when user needs to clarify.
   */
  public emitClarificationNeeded(sessionId: string, turnId: string, prompt: string): void {
    if (this.eventEmitter) {
      const event: ClarificationNeededEvent = {
        type: "nl.clarification_needed",
        sessionId,
        turnId,
        prompt,
        timestamp: nowIso(),
      };
      this.eventEmitter(event);
    }
  }

  public constructor(memoryService?: MemoryService) {
    this.memoryService = memoryService ?? null;
  }

  public isAvailable(): boolean {
    return this.memoryService !== null;
  }

  /**
   * Start a new conversation session
   */
  public startSession(
    tenantId: string,
    userId: string,
    options: ConversationHistoryOptions = {},
  ): ConversationSessionRecord {
    const sessionId = newId("conv");
    const now = nowIso();

    return {
      sessionId,
      tenantId,
      userId,
      turns: [],
      createdAt: now,
      updatedAt: now,
      status: "active",
    };
  }

  /**
   * Add a turn to a conversation session
   */
  public async addTurn(
    session: ConversationSessionRecord,
    turn: Omit<ConversationTurnRecord, "turnId" | "timestamp">,
    options: ConversationHistoryOptions = {},
  ): Promise<ConversationSessionRecord> {
    const turnId = newId("turn");
    const timestamp = nowIso();

    const turnRecord: ConversationTurnRecord = {
      ...turn,
      turnId,
      timestamp,
    };

    const updatedSession: ConversationSessionRecord = {
      ...session,
      turns: [...session.turns, turnRecord],
      updatedAt: timestamp,
      ...(turn.intent ? { lastIntent: turn.intent } : {}),
    };

    // Persist to memory store if available
    // §45: Persist when memoryLayer is "layer_3" (long-term persistent) or when not set (defaults to layer_3)
    if (this.memoryService && this.shouldPersistToLongTermMemory(options) && (options.memoryLayer === "layer_3" || !options.memoryLayer)) {
      await this.persistSession(updatedSession, options);
    }

    return updatedSession;
  }

  /**
   * Complete a conversation session
   */
  public async completeSession(
    session: ConversationSessionRecord,
    options: ConversationHistoryOptions = {},
  ): Promise<ConversationSessionRecord> {
    const completedSession: ConversationSessionRecord = {
      ...session,
      status: "completed",
      updatedAt: nowIso(),
    };

    if (this.memoryService && this.shouldPersistToLongTermMemory(options) && (options.memoryLayer === "layer_3" || !options.memoryLayer)) {
      await this.persistSession(completedSession, options);
    }

    return completedSession;
  }

  /**
   * Abandon a conversation session
   */
  public async abandonSession(
    session: ConversationSessionRecord,
    options: ConversationHistoryOptions = {},
  ): Promise<ConversationSessionRecord> {
    const abandonedSession: ConversationSessionRecord = {
      ...session,
      status: "abandoned",
      updatedAt: nowIso(),
    };

    // R5-31 fix: Only persist to long-term memory when memoryLayer is "layer_3" or unset
    // This prevents restricted/regulated dialog data from being written to long-term memory
    // §39.6 requires only session memory for restricted/regulated data
    if (this.memoryService && this.shouldPersistToLongTermMemory(options) && (options.memoryLayer === "layer_3" || !options.memoryLayer)) {
      await this.persistSession(abandonedSession, options);
    }

    return abandonedSession;
  }

  /**
   * Persist session to memory store
   */
  private async persistSession(
    session: ConversationSessionRecord,
    options: ConversationHistoryOptions,
  ): Promise<void> {
    if (!this.memoryService) {
      return;
    }

    const scope = options.scope ?? this.defaultScope;
    const retentionDays = options.retentionDays ?? this.defaultRetentionDays;
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

    await this.memoryService.remember({
      sessionId: session.sessionId,
      scope,
      memoryLayer: options.memoryLayer ?? "layer_3",
      content: this.serializeSession(session),
      classification: "conversation_history",
      sourceTrustLevel: "system" as MemorySourceTrustLevel,
      qualityScore: 1.0,
      kind: "episode",
      expiresAt,
    });
  }

  private shouldPersistToLongTermMemory(options: ConversationHistoryOptions): boolean {
    return options.dataHandling !== "restricted" && options.dataHandling !== "regulated";
  }

  /**
   * Retrieve conversation session from memory store
   */
  public async getSession(
    sessionId: string,
    tenantId: string,
  ): Promise<ConversationSessionRecord | null> {
    if (!this.memoryService) {
      return null;
    }

    // §9.1: Query-level tenant isolation - pass tenantId to memory service for filtering
    const memories = await this.memoryService.recall({
      sessionId,
      scopes: [this.defaultScope],
      tenantId, // Query-level tenant isolation per §9.1
    });

    const sessionMemory = memories.find(
      (m) => this.extractSessionId(m) === sessionId,
    );

    if (!sessionMemory) {
      return null;
    }

    const session = this.deserializeSession(sessionMemory.contentJson);

    // R26-09 / R29-26 FIX: Validate tenantId before returning session data.
    // This prevents IDOR vulnerability where any tenant could access any session
    // by providing a valid sessionId. Without this check, cross-tenant data
    // access is possible if the memory service query doesn't perfectly isolate.
    if (session.tenantId !== tenantId) {
      return null;
    }

    return session;
  }

  /**
   * List recent conversation sessions for a user
   * @param userId - User ID to filter by
   * @param tenantId - Tenant ID for multi-tenant isolation (required per §9.1)
   * @param limit - Maximum number of sessions to return
   */
  public async listUserSessions(
    userId: string,
    tenantId: string,
    limit = 10,
  ): Promise<readonly ConversationSessionRecord[]> {
    if (!this.memoryService) {
      return [];
    }

    // §9.1: Query-level tenant isolation - pass tenantId to memory service for filtering
    const memories = await this.memoryService.recall({
      scopes: [this.defaultScope],
      tenantId, // Query-level tenant isolation per §9.1
    });

    const userSessions: ConversationSessionRecord[] = [];

    for (const memory of memories) {
      const session = this.tryDeserializeSession(memory.contentJson);
      // Additional safety filter - memory service should have filtered by tenantId already
      if (session && session.userId === userId && session.tenantId === tenantId) {
        userSessions.push(session);
      }
      if (userSessions.length >= limit) {
        break;
      }
    }

    return userSessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  /**
   * Extract session ID from memory record
   */
  private extractSessionId(memory: MemoryRecord): string | null {
    try {
      if (typeof memory.contentJson === "string") {
        const parsed = JSON.parse(memory.contentJson);
        return parsed.sessionId ?? null;
      }
      if (typeof memory.contentJson === "object" && memory.contentJson !== null) {
        return (memory.contentJson as Record<string, unknown>).sessionId as string ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Serialize session to string for storage
   */
  private serializeSession(session: ConversationSessionRecord): string {
    return JSON.stringify(session);
  }

  /**
   * Deserialize session from storage
   */
  private deserializeSession(content: unknown): ConversationSessionRecord {
    if (typeof content === "string") {
      return JSON.parse(content) as ConversationSessionRecord;
    }
    if (typeof content === "object" && content !== null) {
      return content as ConversationSessionRecord;
    }
    throw new Error("Invalid session content");
  }

  /**
   * Try to deserialize session, return null on failure
   */
  private tryDeserializeSession(content: unknown): ConversationSessionRecord | null {
    try {
      return this.deserializeSession(content);
    } catch {
      return null;
    }
  }
}
