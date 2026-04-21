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
import { nowIso } from "../../contracts/types/ids.js";
export function computeSkillHealth(executionCount, successRate) {
    if (executionCount === 0)
        return 0.5; // Neutral for never-executed skills
    return successRate * Math.min(1.0, executionCount / 100);
}
export class SkillGovernanceService {
    store;
    constructor(store) {
        this.store = store;
    }
    withConnection(work) {
        return this.store.withConnection(work);
    }
    /**
     * Validates a skill definition
     */
    validateSkill(request) {
        const errors = [];
        const warnings = [];
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
    registerSkill(metadata) {
        const now = nowIso();
        const tagsJson = JSON.stringify(metadata.tags);
        const requiredToolsJson = JSON.stringify(metadata.requiredTools);
        const requiredPermissionsJson = JSON.stringify(metadata.requiredPermissions);
        this.withConnection((connection) => {
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
      `).run(metadata.skillId, metadata.name, metadata.version, metadata.description, metadata.author, metadata.createdAt, now, metadata.lifecycle, metadata.riskLevel, tagsJson, requiredToolsJson, requiredPermissionsJson, metadata.cacheable ? 1 : 0, metadata.cacheTtlSeconds, 0, 0, 0);
        });
        return true;
    }
    /**
     * Updates skill lifecycle
     */
    updateLifecycle(request) {
        const now = nowIso();
        this.withConnection((connection) => {
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
    getExecutionPolicy(skillId) {
        const row = this.withConnection((connection) => connection.prepare(`
        SELECT * FROM skill_execution_policies WHERE skill_id = ?
      `).get(skillId));
        if (!row || !row.skill_id) {
            // Return default policy
            return {
                skillId,
                allowExecution: true,
                requireApproval: false,
                maxConcurrentExecutions: 5,
                maxExecutionsPerHour: 100,
                rateLimitWindowMs: 3600000,
                blockedMessage: null,
            };
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
    setExecutionPolicy(policy) {
        this.withConnection((connection) => {
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
      `).run(policy.skillId, policy.allowExecution ? 1 : 0, policy.requireApproval ? 1 : 0, policy.maxConcurrentExecutions, policy.maxExecutionsPerHour, policy.rateLimitWindowMs, policy.blockedMessage ?? null);
        });
        return true;
    }
    /**
     * Authorizes skill execution based on policies and current state
     */
    authorizeExecution(request) {
        const policy = this.getExecutionPolicy(request.skillId);
        const deniedReasons = [];
        const requiredApprovals = [];
        if (!policy) {
            // No policy means allow with default restrictions
            return {
                authorized: true,
                policy: this.getExecutionPolicy(request.skillId),
                deniedReasons: [],
                requiredApprovals: [],
            };
        }
        if (!policy.allowExecution) {
            deniedReasons.push(policy.blockedMessage ?? "Skill execution is not allowed");
        }
        if (policy.requireApproval) {
            requiredApprovals.push("skill_execution_approval");
        }
        // Check rate limiting (simplified - would need execution history in real impl)
        // For now, just check if authorized so far
        const authorized = deniedReasons.length === 0 && requiredApprovals.length === 0;
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
    recordExecutionOutcome(skillId, success, durationMs) {
        this.withConnection((connection) => {
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
      `).run(success ? 1.0 : 0.0, success ? 1.0 : 0.0, durationMs, durationMs, skillId);
        });
    }
    /**
     * Gets all skills with optional filtering
     */
    listSkills(options = {}) {
        let sql = "SELECT * FROM skill_registry WHERE 1=1";
        const conditions = [];
        const params = [];
        if (options.lifecycle) {
            conditions.push("lifecycle = ?");
            params.push(options.lifecycle);
        }
        if (options.riskLevel) {
            conditions.push("risk_level = ?");
            params.push(options.riskLevel);
        }
        if (options.tag) {
            conditions.push("tags_json LIKE ?");
            params.push(`%${options.tag}%`);
        }
        if (conditions.length > 0) {
            sql += " AND " + conditions.join(" AND ");
        }
        const rows = this.withConnection((connection) => connection.prepare(sql).all(...params));
        return rows.map((row) => ({
            skillId: row.skill_id,
            name: row.name,
            version: row.version,
            description: row.description,
            author: row.author,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lifecycle: row.lifecycle,
            riskLevel: row.risk_level,
            tags: JSON.parse(row.tags_json),
            requiredTools: JSON.parse(row.required_tools_json),
            requiredPermissions: JSON.parse(row.required_permissions_json),
            cacheable: row.cacheable === 1,
            cacheTtlSeconds: row.cache_ttl_seconds,
            executionCount: row.execution_count,
            successRate: row.success_rate,
            avgDurationMs: row.avg_duration_ms,
        }));
    }
    /**
     * Gets skill by ID
     */
    getSkill(skillId) {
        const skills = this.listSkills({});
        return skills.find((s) => s.skillId === skillId) ?? null;
    }
    /**
     * Gets skill health score
     */
    getSkillHealth(skillId) {
        const skill = this.getSkill(skillId);
        if (!skill)
            return 0;
        return computeSkillHealth(skill.executionCount, skill.successRate);
    }
    /**
     * Archives deprecated skills older than specified days
     */
    archiveOldDeprecatedSkills(olderThanDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);
        const cutoffStr = cutoff.toISOString();
        return this.withConnection((connection) => {
            connection.prepare(`
        UPDATE skill_registry
        SET lifecycle = 'archived', updated_at = ?
        WHERE lifecycle = 'deprecated' AND updated_at < ?
      `).run(nowIso(), cutoffStr);
            return 1;
        });
    }
}
//# sourceMappingURL=skill-governance-service.js.map