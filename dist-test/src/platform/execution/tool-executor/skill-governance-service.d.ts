/**
 * Skill Governance Service
 *
 * Provides governance for skill lifecycle, permissions, and execution policies.
 * Manages skill registry, skill validation, and execution authorization.
 *
 * Features:
 * - Skill registry management
 * - Skill lifecycle (draft -> active -> deprecated -> archived)
 * - Skill execution authorization
 * - Skill versioning policies
 * - Skill dependency validation
 */
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
export type SkillLifecycle = "draft" | "active" | "deprecated" | "archived";
export type SkillRiskLevel = "low" | "medium" | "high" | "critical";
export interface SkillMetadata {
    skillId: string;
    name: string;
    version: string;
    description: string;
    author: string;
    createdAt: string;
    updatedAt: string;
    lifecycle: SkillLifecycle;
    riskLevel: SkillRiskLevel;
    tags: readonly string[];
    requiredTools: readonly string[];
    requiredPermissions: readonly string[];
    cacheable: boolean;
    cacheTtlSeconds: number;
    executionCount: number;
    successRate: number;
    avgDurationMs: number;
}
export interface SkillExecutionPolicy {
    skillId: string;
    allowExecution: boolean;
    requireApproval: boolean;
    maxConcurrentExecutions: number;
    maxExecutionsPerHour: number;
    rateLimitWindowMs: number;
    blockedMessage: string | null;
}
export interface AuthorizeSkillExecutionRequest {
    skillId: string;
    skillVersion: string;
    sessionId: string;
    executionId: string;
    requestedTools: readonly string[];
}
export interface AuthorizeSkillExecutionResult {
    authorized: boolean;
    policy: SkillExecutionPolicy | null;
    deniedReasons: string[];
    requiredApprovals: string[];
}
export interface ValidateSkillRequest {
    skillId: string;
    version: string;
    name: string;
    description: string;
    requiredTools: readonly string[];
    cacheable: boolean;
    cacheTtlSeconds: number;
}
export interface ValidateSkillResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export interface UpdateSkillLifecycleRequest {
    skillId: string;
    newLifecycle: SkillLifecycle;
    reason: string;
}
export declare function computeSkillHealth(executionCount: number, successRate: number): number;
export declare class SkillGovernanceService {
    private readonly store;
    constructor(store: AuthoritativeTaskStore);
    private withConnection;
    /**
     * Validates a skill definition
     */
    validateSkill(request: ValidateSkillRequest): ValidateSkillResult;
    /**
     * Registers a new skill or updates an existing one
     */
    registerSkill(metadata: SkillMetadata): boolean;
    /**
     * Updates skill lifecycle
     */
    updateLifecycle(request: UpdateSkillLifecycleRequest): boolean;
    /**
     * Gets skill execution policy
     */
    getExecutionPolicy(skillId: string): SkillExecutionPolicy | null;
    /**
     * Sets skill execution policy
     */
    setExecutionPolicy(policy: SkillExecutionPolicy): boolean;
    /**
     * Authorizes skill execution based on policies and current state
     */
    authorizeExecution(request: AuthorizeSkillExecutionRequest): AuthorizeSkillExecutionResult;
    /**
     * Records skill execution outcome for metrics
     */
    recordExecutionOutcome(skillId: string, success: boolean, durationMs: number): void;
    /**
     * Gets all skills with optional filtering
     */
    listSkills(options?: {
        lifecycle?: SkillLifecycle;
        riskLevel?: SkillRiskLevel;
        tag?: string;
    }): SkillMetadata[];
    /**
     * Gets skill by ID
     */
    getSkill(skillId: string): SkillMetadata | null;
    /**
     * Gets skill health score
     */
    getSkillHealth(skillId: string): number;
    /**
     * Archives deprecated skills older than specified days
     */
    archiveOldDeprecatedSkills(olderThanDays: number): number;
}
