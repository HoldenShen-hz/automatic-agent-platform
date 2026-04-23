/**
 * Takeover Escalation Manager
 *
 * Manages timeout tracking, escalation policies, and acknowledgment states
 * for takeover sessions.
 */
import type { TakeoverLifecycleEvent, TakeoverEventPayload, TakeoverTimeoutConfig, TakeoverAckStatus, AckResult } from "./human-takeover-service-async.js";
/**
 * Callback type for session auto-close handling.
 */
type AutoCloseHandler = (sessionId: string, taskId: string) => Promise<void>;
/**
 * Emitter interface for lifecycle events.
 */
interface TakeoverEventEmitter {
    emit<T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]): void;
}
/**
 * Manages escalation, timeout, and acknowledgment for takeover sessions.
 *
 * Responsibilities:
 * - Start/stop timeout timers for sessions
 * - Track acknowledgment status
 * - Manage escalation policies and levels
 * - Handle session auto-close at max escalation
 */
export declare class TakeoverEscalationManager {
    private readonly config;
    private readonly eventEmitter;
    private readonly onAutoClose?;
    /** Active timeout timers keyed by sessionId. */
    private readonly activeTimeouts;
    /** Active escalation timers keyed by sessionId. */
    private readonly escalationTimers;
    /** Acknowledgment status tracking keyed by sessionId. */
    private readonly ackStatuses;
    /** Escalation policies keyed by sessionId. */
    private readonly escalationPolicies;
    private readonly logger;
    private readonly MAX_SESSION_ENTRIES;
    private readonly SESSION_TTL_MS;
    private lastEvictionTime;
    private readonly EVICTION_INTERVAL_MS;
    constructor(config: TakeoverTimeoutConfig, eventEmitter: TakeoverEventEmitter, onAutoClose?: AutoCloseHandler | undefined);
    /**
     * Starts timeout and escalation tracking for a newly opened session.
     */
    startSessionTracking(sessionId: string, taskId: string): void;
    /**
     * Stops all tracking (timeout and escalation) for a session.
     */
    stopSessionTracking(sessionId: string): void;
    /**
     * Starts a timeout timer for a takeover session.
     * If the timeout expires before acknowledgment, the session is escalated.
     */
    private startTimeoutTimer;
    /**
     * Handles session timeout — escalates or auto-expires.
     */
    private handleSessionTimeout;
    /**
     * Initializes escalation policy for a new session.
     */
    private initializeEscalationPolicy;
    /**
     * Schedules the next escalation check.
     */
    private scheduleEscalationCheck;
    /**
     * Checks if a session needs escalation and performs it if so.
     */
    private checkEscalation;
    /**
     * Escalates a takeover session to the next level.
     */
    private escalateSession;
    /**
     * Gets the next escalation level given the current level.
     */
    private getNextEscalationLevel;
    /**
     * Gets the escalation delay in ms for a given level.
     */
    private getEscalationDelayForLevel;
    /**
     * Acknowledges a takeover session — operator is now actively working.
     */
    acknowledgeSession(sessionId: string, operatorId: string, taskId: string): AckResult;
    /**
     * Gets the acknowledgment status for a session.
     */
    getAcknowledgmentStatus(sessionId: string): TakeoverAckStatus | null;
    /**
     * Extends the acknowledgment deadline for an active session.
     */
    extendAcknowledgment(sessionId: string, additionalMs?: number): AckResult;
    /**
     * C-11: Evict expired session entries to prevent memory leaks.
     */
    evictExpiredSessionEntries(): void;
    /**
     * Clears all active timers. Used during shutdown.
     */
    clearAllTimers(): void;
}
export {};
