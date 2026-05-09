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
  /** R5-31: Indicates if session contains restricted/regulated data */
  readonly isRestricted?: boolean;
}

/**
 * Options for storing conversation history
 */
export interface ConversationHistoryOptions {
  readonly memoryLayer?: MemoryRecord["memoryLayer"];
  readonly scope?: string;
  readonly retentionDays?: number;
  /** R5-31: Mark session as restricted/regulated to prevent long-term memory persistence */
  readonly isRestricted?: boolean;
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

  public constructor(memoryService?: MemoryService) {
    this.memoryService = memoryService ?? null;
  }

  /**
   * Check if memory service is available
   */
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
      // R5-31: New sessions inherit isRestricted flag if provided
      ...(options.isRestricted !== undefined ? { isRestricted: options.isRestricted } : {}),
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

    // Persist to memory store if available and not restricted
    // R5-31: Restricted/regulated dialog data must not be written to long-term memory
    if (this.memoryService && options.memoryLayer !== "layer_3" && !session.isRestricted) {
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

    // R5-31: Restricted/regulated dialog data must not be written to long-term memory
    if (this.memoryService && options.memoryLayer !== "layer_3" && !session.isRestricted) {
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

    // R5-31: Restricted/regulated dialog data must not be written to long-term memory
    if (this.memoryService && options.memoryLayer !== "layer_3" && !session.isRestricted) {
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

    const memories = await this.memoryService.recall({
      sessionId,
      scopes: [this.defaultScope],
      tenantId,
    });

    const sessionMemory = memories.find(
      (m) => this.extractSessionId(m) === sessionId,
    );

    if (!sessionMemory) {
      return null;
    }

    const session = this.deserializeSession(sessionMemory.contentJson);

    // R4-45/R29-26: Enforce tenant isolation - only return session if it belongs to the requesting tenant
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

    // R4-45: Server-side tenant isolation via query-level filtering.
    // The memory service recall() supports tenantId in its query per §9.1.
    // This replaces the previous client-side post-filter approach.
    const memories = await this.memoryService.recall({
      scopes: [this.defaultScope],
      // R4-45: Pass tenantId for server-side isolation - the recall query
      // now filters by tenantId at the storage layer, not client-side
      ...(tenantId ? { tenantId } : {}),
    });

    const userSessions: ConversationSessionRecord[] = [];

    for (const memory of memories) {
      const session = this.tryDeserializeSession(memory.contentJson);
      // R4-45: Defense-in-depth - retain client-side filter as fallback in case
      // storage layer doesn't enforce tenant isolation (should never trigger in healthy system)
      if (session && session.userId === userId && session.tenantId === tenantId) {
        userSessions.push(session);
      }
    }

    // R29-34: Sort before limiting to ensure we return the most recent sessions
    return userSessions
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
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
