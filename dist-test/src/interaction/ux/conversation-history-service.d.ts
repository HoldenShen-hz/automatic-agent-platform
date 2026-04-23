/**
 * Conversation History Service
 *
 * Provides persistent conversation history storage using the memory store.
 * Implements §45 "Conversation History Persistence" requirement.
 *
 * @see docs_en/reviews/architecture-design-vs-implementation-review.md §45
 */
import type { MemoryRecord } from "../../platform/contracts/types/domain.js";
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
}
/**
 * Options for storing conversation history
 */
export interface ConversationHistoryOptions {
    readonly memoryLayer?: MemoryRecord["memoryLayer"];
    readonly scope?: string;
    readonly retentionDays?: number;
}
/**
 * Conversation History Service
 *
 * Persists conversation history to memory store for durability.
 * Supports session management, turn tracking, and history retrieval.
 */
export declare class ConversationHistoryService {
    private readonly memoryService;
    private readonly defaultScope;
    private readonly defaultRetentionDays;
    constructor(memoryService?: MemoryService);
    /**
     * Check if memory service is available
     */
    isAvailable(): boolean;
    /**
     * Start a new conversation session
     */
    startSession(tenantId: string, userId: string, options?: ConversationHistoryOptions): ConversationSessionRecord;
    /**
     * Add a turn to a conversation session
     */
    addTurn(session: ConversationSessionRecord, turn: Omit<ConversationTurnRecord, "turnId" | "timestamp">, options?: ConversationHistoryOptions): Promise<ConversationSessionRecord>;
    /**
     * Complete a conversation session
     */
    completeSession(session: ConversationSessionRecord, options?: ConversationHistoryOptions): Promise<ConversationSessionRecord>;
    /**
     * Abandon a conversation session
     */
    abandonSession(session: ConversationSessionRecord, options?: ConversationHistoryOptions): Promise<ConversationSessionRecord>;
    /**
     * Persist session to memory store
     */
    private persistSession;
    /**
     * Retrieve conversation session from memory store
     */
    getSession(sessionId: string, tenantId: string): Promise<ConversationSessionRecord | null>;
    /**
     * List recent conversation sessions for a user
     */
    listUserSessions(userId: string, tenantId: string, limit?: number): Promise<readonly ConversationSessionRecord[]>;
    /**
     * Extract session ID from memory record
     */
    private extractSessionId;
    /**
     * Serialize session to string for storage
     */
    private serializeSession;
    /**
     * Deserialize session from storage
     */
    private deserializeSession;
    /**
     * Try to deserialize session, return null on failure
     */
    private tryDeserializeSession;
}
