/**
 * Conversation History Service
 *
 * Provides persistent conversation history storage using the memory store.
 * Implements §45 "Conversation History Persistence" requirement.
 *
 * @see docs_en/reviews/architecture-design-vs-implementation-review.md §45
 */
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
/**
 * Conversation History Service
 *
 * Persists conversation history to memory store for durability.
 * Supports session management, turn tracking, and history retrieval.
 */
export class ConversationHistoryService {
    memoryService;
    defaultScope = "conversation";
    defaultRetentionDays = 90;
    constructor(memoryService) {
        this.memoryService = memoryService ?? null;
    }
    /**
     * Check if memory service is available
     */
    isAvailable() {
        return this.memoryService !== null;
    }
    /**
     * Start a new conversation session
     */
    startSession(tenantId, userId, options = {}) {
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
    async addTurn(session, turn, options = {}) {
        const turnId = newId("turn");
        const timestamp = nowIso();
        const turnRecord = {
            ...turn,
            turnId,
            timestamp,
        };
        const updatedSession = {
            ...session,
            turns: [...session.turns, turnRecord],
            updatedAt: timestamp,
            ...(turn.intent ? { lastIntent: turn.intent } : {}),
        };
        // Persist to memory store if available
        if (this.memoryService && options.memoryLayer !== "layer_3") {
            await this.persistSession(updatedSession, options);
        }
        return updatedSession;
    }
    /**
     * Complete a conversation session
     */
    async completeSession(session, options = {}) {
        const completedSession = {
            ...session,
            status: "completed",
            updatedAt: nowIso(),
        };
        if (this.memoryService) {
            await this.persistSession(completedSession, options);
        }
        return completedSession;
    }
    /**
     * Abandon a conversation session
     */
    async abandonSession(session, options = {}) {
        const abandonedSession = {
            ...session,
            status: "abandoned",
            updatedAt: nowIso(),
        };
        if (this.memoryService) {
            await this.persistSession(abandonedSession, options);
        }
        return abandonedSession;
    }
    /**
     * Persist session to memory store
     */
    async persistSession(session, options) {
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
            sourceTrustLevel: "system",
            qualityScore: 1.0,
            kind: "episode",
            expiresAt,
        });
    }
    /**
     * Retrieve conversation session from memory store
     */
    async getSession(sessionId, tenantId) {
        if (!this.memoryService) {
            return null;
        }
        const memories = await this.memoryService.recall({
            sessionId,
            scopes: [this.defaultScope],
        });
        const sessionMemory = memories.find((m) => this.extractSessionId(m) === sessionId);
        if (!sessionMemory) {
            return null;
        }
        return this.deserializeSession(sessionMemory.contentJson);
    }
    /**
     * List recent conversation sessions for a user
     */
    async listUserSessions(userId, tenantId, limit = 10) {
        if (!this.memoryService) {
            return [];
        }
        const memories = await this.memoryService.recall({
            scopes: [this.defaultScope],
        });
        const userSessions = [];
        for (const memory of memories) {
            const session = this.tryDeserializeSession(memory.contentJson);
            if (session && session.userId === userId && session.tenantId === tenantId) {
                userSessions.push(session);
            }
            if (userSessions.length >= limit) {
                break;
            }
        }
        return userSessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    /**
     * Extract session ID from memory record
     */
    extractSessionId(memory) {
        try {
            if (typeof memory.contentJson === "string") {
                const parsed = JSON.parse(memory.contentJson);
                return parsed.sessionId ?? null;
            }
            if (typeof memory.contentJson === "object" && memory.contentJson !== null) {
                return memory.contentJson.sessionId ?? null;
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /**
     * Serialize session to string for storage
     */
    serializeSession(session) {
        return JSON.stringify(session);
    }
    /**
     * Deserialize session from storage
     */
    deserializeSession(content) {
        if (typeof content === "string") {
            return JSON.parse(content);
        }
        if (typeof content === "object" && content !== null) {
            return content;
        }
        throw new Error("Invalid session content");
    }
    /**
     * Try to deserialize session, return null on failure
     */
    tryDeserializeSession(content) {
        try {
            return this.deserializeSession(content);
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=conversation-history-service.js.map