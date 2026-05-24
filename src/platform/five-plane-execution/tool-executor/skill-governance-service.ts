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

import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { nowIso } from "../../contracts/types/ids.js";

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

interface StoredSkill {
  id: string;
  skill_id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  created_at: string;
  updated_at: string;
  lifecycle: string;
  risk_level: string;
  tags_json: string;
  required_tools_json: string;
  required_permissions_json: string;
  cacheable: number;
  cache_ttl_seconds: number;
  execution_count: number;
  success_rate: number;
  avg_duration_ms: number;
}

interface StoredSkillPolicy {
  skill_id: string;
  allow_execution: number;
  require_approval: number;
  max_concurrent_executions: number;
  max_executions_per_hour: number;
  rate_limit_window_ms: number;
  blocked_message: string | null;
}

interface SkillExecutionAuditEntry {
  readonly executionId: string;
  readonly recordedAtMs: number;
}

export function computeSkillHealth(executionCount: number, successRate: number): number {
  if (executionCount === 0) return 0.5; // Neutral for never-executed skills
  return successRate * Math.min(1.0, executionCount / 100);
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function toStoredSkill(row: Record<string, unknown>): StoredSkill {
  return {
    id: String(row.id ?? ""),
    skill_id: String(row.skill_id ?? ""),
    name: String(row.name ?? ""),
    version: String(row.version ?? ""),
    description: String(row.description ?? ""),
    author: String(row.author ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    lifecycle: String(row.lifecycle ?? ""),
    risk_level: String(row.risk_level ?? ""),
    tags_json: String(row.tags_json ?? "[]"),
    required_tools_json: String(row.required_tools_json ?? "[]"),
    required_permissions_json: String(row.required_permissions_json ?? "[]"),
    cacheable: Number(row.cacheable ?? 0),
    cache_ttl_seconds: Number(row.cache_ttl_seconds ?? 0),
    execution_count: Number(row.execution_count ?? 0),
    success_rate: Number(row.success_rate ?? 0),
    avg_duration_ms: Number(row.avg_duration_ms ?? 0),
  };
}

export class SkillGovernanceService {
  private readonly executionAuditBySkillId = new Map<string, SkillExecutionAuditEntry[]>();

  public constructor(private readonly store: AuthoritativeTaskStore) {}

  private withConnection<T>(work: Parameters<AuthoritativeTaskStore["withConnection"]>[0]): T {
    return this.store.withConnection(work) as T;
  }

  /**
   * Validates a skill definition
   */
  public validateSkill(request: ValidateSkillRequest): ValidateSkillResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate skillId format
    if (!/^[a-z][a-z0-9_-]*$/i.test(request.skillId)) {
      errors.push("skillId must be alphanumeric with hyphens/underscores, start with letter");
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+$/.test(request.version)) {
      errors.push("version must be in semver format (e.g., 1.0.0)");
    }

    // Validate name
    if (request.name.length < 3) {
      errors.push("name must be at least 3 characters");
    }
    if (request.name.length > 100) {
      errors.push("name must be at most 100 characters");
    }

    // Validate description
    if (request.description.length < 10) {
      warnings.push("description should be at least 10 characters");
    }
    if (request.description.length > 500) {
      errors.push("description must be at most 500 characters");
    }

    // Validate required tools
    if (request.requiredTools.length === 0) {
      warnings.push("skill has no required tools - it may not do anything");
    }

    // Validate cache settings
    if (request.cacheable && request.cacheTtlSeconds < 60) {
      warnings.push("cacheTtlSeconds less than 60 may be ineffective");
    }
    if (request.cacheTtlSeconds > 86400 * 7) {
      warnings.push("cacheTtlSeconds greater than 7 days may return stale results");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Registers a new skill or updates an existing one
   */
  public registerSkill(metadata: SkillMetadata): boolean {
    const now = nowIso();
    const tagsJson = JSON.stringify(metadata.tags);
    const requiredToolsJson = JSON.stringify(metadata.requiredTools);
    const requiredPermissionsJson = JSON.stringify(metadata.requiredPermissions);

    this.withConnection<void>((connection) => {
      connection.prepare(`
        INSERT INTO skill_registry (
          skill_id, name, version, description, author,
          created_at, updated_at, lifecycle, risk_level,
          tags_json, required_tools_json, required_permissions_json,
          cacheable, cache_ttl_seconds, execution_count,
          success_rate, avg_duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(skill_id) DO UPDATE SET
          version = excluded.version,
          description = excluded.description,
          updated_at = excluded.updated_at,
          lifecycle = excluded.lifecycle,
          risk_level = excluded.risk_level,
          tags_json = excluded.tags_json,
          required_tools_json = excluded.required_tools_json,
          required_permissions_json = excluded.required_permissions_json,
          cacheable = excluded.cacheable,
          cache_ttl_seconds = excluded.cache_ttl_seconds
      `).run(
        metadata.skillId,
        metadata.name,
        metadata.version,
        metadata.description,
        metadata.author,
        metadata.createdAt,
        now,
        metadata.lifecycle,
        metadata.riskLevel,
        tagsJson,
        requiredToolsJson,
        requiredPermissionsJson,
        metadata.cacheable ? 1 : 0,
        metadata.cacheTtlSeconds,
        0,
        0,
        0,
      );
    });

    return true;
  }

  /**
   * Updates skill lifecycle
   */
  public updateLifecycle(request: UpdateSkillLifecycleRequest): boolean {
    const now = nowIso();

    this.withConnection<void>((connection) => {
      connection.prepare(`
        UPDATE skill_registry
        SET lifecycle = ?, updated_at = ?
        WHERE skill_id = ?
      `).run(request.newLifecycle, now, request.skillId);
    });

    return true;
  }

  /**
   * Gets skill execution policy
   */
  public getExecutionPolicy(skillId: string): SkillExecutionPolicy | null {
    const row = this.withConnection<StoredSkillPolicy | undefined>((connection) =>
      connection.prepare(`
        SELECT * FROM skill_execution_policies WHERE skill_id = ?
      `).get(skillId) as StoredSkillPolicy | undefined,
    );

    if (!row || !row.skill_id) {
      return null;
    }

    return {
      skillId: row.skill_id,
      allowExecution: row.allow_execution === 1,
      requireApproval: row.require_approval === 1,
      maxConcurrentExecutions: row.max_concurrent_executions,
      maxExecutionsPerHour: row.max_executions_per_hour,
      rateLimitWindowMs: row.rate_limit_window_ms,
      blockedMessage: row.blocked_message ?? null,
    };
  }

  /**
   * Sets skill execution policy
   */
  public setExecutionPolicy(policy: SkillExecutionPolicy): boolean {
    this.withConnection<void>((connection) => {
      connection.prepare(`
        INSERT INTO skill_execution_policies (
          skill_id, allow_execution, require_approval,
          max_concurrent_executions, max_executions_per_hour,
          rate_limit_window_ms, blocked_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(skill_id) DO UPDATE SET
          allow_execution = excluded.allow_execution,
          require_approval = excluded.require_approval,
          max_concurrent_executions = excluded.max_concurrent_executions,
          max_executions_per_hour = excluded.max_executions_per_hour,
          rate_limit_window_ms = excluded.rate_limit_window_ms,
          blocked_message = excluded.blocked_message
      `).run(
        policy.skillId,
        policy.allowExecution ? 1 : 0,
        policy.requireApproval ? 1 : 0,
        policy.maxConcurrentExecutions,
        policy.maxExecutionsPerHour,
        policy.rateLimitWindowMs,
        policy.blockedMessage ?? null,
      );
    });

    return true;
  }

  /**
   * Authorizes skill execution based on policies and current state
   */
  public authorizeExecution(request: AuthorizeSkillExecutionRequest): AuthorizeSkillExecutionResult {
    const policy = this.getExecutionPolicy(request.skillId);
    const deniedReasons: string[] = [];
    const requiredApprovals: string[] = [];

    if (!policy) {
      return {
        authorized: false,
        policy: null,
        deniedReasons: ["Skill execution policy is not configured"],
        requiredApprovals: [],
      };
    }

    if (!policy.allowExecution) {
      deniedReasons.push(policy.blockedMessage ?? "Skill execution is not allowed");
    }

    if (policy.requireApproval) {
      requiredApprovals.push("skill_execution_approval");
    }

    if (policy.maxExecutionsPerHour > 0) {
      const currentExecutions = this.pruneAndReadRecentExecutions(request.skillId, policy.rateLimitWindowMs, Date.now());
      if (currentExecutions.length >= policy.maxExecutionsPerHour) {
        deniedReasons.push("Skill execution rate limit exceeded");
      }
    }

    const authorized = deniedReasons.length === 0 && requiredApprovals.length === 0;

    if (authorized) {
      this.recordExecutionAttempt(request.skillId, request.executionId, Date.now(), policy.rateLimitWindowMs);
    }

    return {
      authorized,
      policy,
      deniedReasons,
      requiredApprovals,
    };
  }

  /**
   * Records skill execution outcome for metrics
   */
  public recordExecutionOutcome(skillId: string, success: boolean, durationMs: number): void {
    this.pruneAndReadRecentExecutions(skillId, null, Date.now());
    this.withConnection<void>((connection) => {
      connection.prepare(`
        UPDATE skill_registry
        SET
          execution_count = execution_count + 1,
          success_rate = CASE
            WHEN execution_count = 0 THEN ?
            ELSE (success_rate * execution_count + ?) / (execution_count + 1)
          END,
          avg_duration_ms = CASE
            WHEN execution_count = 0 THEN ?
            ELSE (avg_duration_ms * execution_count + ?) / (execution_count + 1)
          END
        WHERE skill_id = ?
      `).run(
        success ? 1.0 : 0.0,
        success ? 1.0 : 0.0,
        durationMs,
        durationMs,
        skillId,
      );
    });
  }

  /**
   * Gets all skills with optional filtering
   */
  public listSkills(options: {
    lifecycle?: SkillLifecycle;
    riskLevel?: SkillRiskLevel;
    tag?: string;
  } = {}): SkillMetadata[] {
    let sql = "SELECT * FROM skill_registry WHERE 1=1";
    const conditions: string[] = [];
    const params: string[] = [];

    if (options.lifecycle) {
      conditions.push("lifecycle = ?");
      params.push(options.lifecycle);
    }
    if (options.riskLevel) {
      conditions.push("risk_level = ?");
      params.push(options.riskLevel);
    }
    if (options.tag) {
      conditions.push("tags_json LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLikePattern(options.tag)}%`);
    }

    if (conditions.length > 0) {
      sql += " AND " + conditions.join(" AND ");
    }

    const rows = this.withConnection<Record<string, unknown>[]>((connection) =>
      connection.prepare(sql).all(...params) as Record<string, unknown>[],
    );

    return rows.map((row) => {
      const stored = toStoredSkill(row);
      return {
        skillId: stored.skill_id,
        name: stored.name,
        version: stored.version,
        description: stored.description,
        author: stored.author,
        createdAt: stored.created_at,
        updatedAt: stored.updated_at,
        lifecycle: stored.lifecycle as SkillLifecycle,
        riskLevel: stored.risk_level as SkillRiskLevel,
        tags: JSON.parse(stored.tags_json) as string[],
        requiredTools: JSON.parse(stored.required_tools_json) as string[],
        requiredPermissions: JSON.parse(stored.required_permissions_json) as string[],
        cacheable: stored.cacheable === 1,
        cacheTtlSeconds: stored.cache_ttl_seconds,
        executionCount: stored.execution_count,
        successRate: stored.success_rate,
        avgDurationMs: stored.avg_duration_ms,
      };
    });
  }

  /**
   * Gets skill by ID
   */
  public getSkill(skillId: string): SkillMetadata | null {
    const skills = this.listSkills({});
    return skills.find((s) => s.skillId === skillId) ?? null;
  }

  /**
   * Gets skill health score
   */
  public getSkillHealth(skillId: string): number {
    const skill = this.getSkill(skillId);
    if (!skill) return 0;
    return computeSkillHealth(skill.executionCount, skill.successRate);
  }

  /**
   * Archives deprecated skills older than specified days
   */
  public archiveOldDeprecatedSkills(olderThanDays: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const cutoffStr = cutoff.toISOString();

    return this.withConnection<number>((connection) => {
      connection.prepare(`
        UPDATE skill_registry
        SET lifecycle = 'archived', updated_at = ?
        WHERE lifecycle = 'deprecated' AND updated_at < ?
      `).run(nowIso(), cutoffStr);
      return 1;
    });
  }

  private pruneAndReadRecentExecutions(
    skillId: string,
    windowMs: number | null,
    nowMs: number,
  ): readonly SkillExecutionAuditEntry[] {
    const existing = this.executionAuditBySkillId.get(skillId) ?? [];
    const retained = windowMs == null || windowMs <= 0
      ? existing
      : existing.filter((entry) => nowMs - entry.recordedAtMs < windowMs);
    if (retained.length === 0) {
      this.executionAuditBySkillId.delete(skillId);
      return [];
    }
    if (retained.length !== existing.length) {
      this.executionAuditBySkillId.set(skillId, retained);
    }
    return retained;
  }

  private recordExecutionAttempt(skillId: string, executionId: string, nowMs: number, windowMs: number): void {
    const retained = [...this.pruneAndReadRecentExecutions(skillId, windowMs, nowMs)];
    if (retained.some((entry) => entry.executionId === executionId)) {
      return;
    }
    retained.push({ executionId, recordedAtMs: nowMs });
    this.executionAuditBySkillId.set(skillId, retained);
  }
}
