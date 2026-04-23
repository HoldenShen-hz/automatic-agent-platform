/**
 * @fileoverview Cross-Region Deployment Service
 *
 * Provides:
 * - Multi-region topology management
 * - Cross-region routing with health-aware selection
 * - Traffic weight management
 * - Region failover and health monitoring
 * - Cross-region replication coordination
 *
 * @see docs_zh/contracts/multi_region_deployment_contract.md
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
// ── DDL ──────────────────────────────────────────────────────────────
export const CROSS_REGION_DDL = `
CREATE TABLE IF NOT EXISTS regions (
  region_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 100,
  weight INTEGER NOT NULL DEFAULT 100,
  latency_ms REAL,
  health_score REAL NOT NULL DEFAULT 100,
  max_concurrency INTEGER NOT NULL DEFAULT 1000,
  current_load INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  last_health_check_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_regions_status ON regions(status);

CREATE TABLE IF NOT EXISTS region_topologies (
  topology_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  regions_json TEXT NOT NULL,
  default_routing_strategy TEXT NOT NULL DEFAULT 'latency_based',
  failover_region_id TEXT,
  active_region_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_topologies_active ON region_topologies(active_region_id);

CREATE TABLE IF NOT EXISTS traffic_weights (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL,
  weight INTEGER NOT NULL,
  effective_at TEXT NOT NULL,
  expires_at TEXT,
  FOREIGN KEY (region_id) REFERENCES regions(region_id)
);
CREATE INDEX IF NOT EXISTS idx_traffic_weights_region ON traffic_weights(region_id, effective_at);

CREATE TABLE IF NOT EXISTS region_health_checks (
  check_id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms REAL,
  health_score REAL NOT NULL,
  error_message TEXT,
  checked_at TEXT NOT NULL,
  FOREIGN KEY (region_id) REFERENCES regions(region_id)
);
CREATE INDEX IF NOT EXISTS idx_health_checks_region ON region_health_checks(region_id, checked_at);

CREATE TABLE IF NOT EXISTS failover_plans (
  plan_id TEXT PRIMARY KEY,
  source_region_id TEXT NOT NULL,
  target_region_id TEXT NOT NULL,
  cause TEXT NOT NULL,
  initiated_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  steps_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_failover_plans_region ON failover_plans(source_region_id);
`;
export class CrossRegionDeploymentService {
    db;
    defaultRoutingStrategy;
    latencyThresholdMs;
    minHealthScoreForTraffic;
    constructor(db, options) {
        this.db = db;
        this.defaultRoutingStrategy = options?.defaultRoutingStrategy ?? "latency_based";
        this.latencyThresholdMs = options?.latencyThresholdMs ?? 500;
        this.minHealthScoreForTraffic = options?.minHealthScoreForTraffic ?? 50;
    }
    // ── Region Management ───────────────────────────────────────────────
    registerRegion(region) {
        const now = nowIso();
        const fullRegion = {
            ...region,
            lastHealthCheckAt: now,
            createdAt: now,
            updatedAt: now,
        };
        this.db.connection
            .prepare(`INSERT OR REPLACE INTO regions
         (region_id, name, endpoint, status, priority, weight, latency_ms, health_score, max_concurrency, current_load, metadata_json, last_health_check_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(fullRegion.regionId, fullRegion.name, fullRegion.endpoint, fullRegion.status, fullRegion.priority, fullRegion.weight, fullRegion.latencyMs, fullRegion.healthScore, fullRegion.maxConcurrency, fullRegion.currentLoad, fullRegion.metadata ? JSON.stringify(fullRegion.metadata) : null, fullRegion.lastHealthCheckAt, fullRegion.createdAt, fullRegion.updatedAt);
        return fullRegion;
    }
    getRegion(regionId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM regions WHERE region_id = ?`)
            .get(regionId);
        return row ? this.mapRegion(row) : null;
    }
    listRegions(status) {
        if (status) {
            return this.db.connection
                .prepare(`SELECT * FROM regions WHERE status = ? ORDER BY priority ASC`)
                .all(status).map((r) => this.mapRegion(r));
        }
        return this.db.connection
            .prepare(`SELECT * FROM regions ORDER BY priority ASC`)
            .all().map((r) => this.mapRegion(r));
    }
    updateRegionHealth(check) {
        const now = nowIso();
        this.db.connection
            .prepare(`UPDATE regions SET
         status = ?, latency_ms = ?, health_score = ?, last_health_check_at = ?, updated_at = ?
         WHERE region_id = ?`)
            .run(check.status, check.latencyMs, check.healthScore, check.checkedAt, now, check.regionId);
        this.db.connection
            .prepare(`INSERT INTO region_health_checks (check_id, region_id, status, latency_ms, health_score, error_message, checked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(check.checkId, check.regionId, check.status, check.latencyMs, check.healthScore, check.errorMessage, check.checkedAt);
    }
    updateRegionStatus(regionId, status) {
        const now = nowIso();
        this.db.connection
            .prepare(`UPDATE regions SET status = ?, updated_at = ? WHERE region_id = ?`)
            .run(status, now, regionId);
        return this.getRegion(regionId);
    }
    setRegionWeight(regionId, weight, effectiveAt, expiresAt) {
        const id = newId("tweight");
        const effective = effectiveAt ?? nowIso();
        this.db.connection
            .prepare(`INSERT INTO traffic_weights (id, region_id, weight, effective_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`)
            .run(id, regionId, weight, effective, expiresAt ?? null);
    }
    getEffectiveWeights() {
        const now = nowIso();
        const rows = this.db.connection
            .prepare(`SELECT * FROM traffic_weights
         WHERE effective_at <= ? AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY effective_at DESC`)
            .all(now, now);
        return rows.map((r) => ({
            regionId: String(r.region_id),
            weight: Number(r.weight),
            effectiveAt: String(r.effective_at),
            expiresAt: r.expires_at ? String(r.expires_at) : null,
        }));
    }
    // ── Topology Management ───────────────────────────────────────────
    createTopology(topology) {
        const now = nowIso();
        const fullTopology = {
            ...topology,
            createdAt: now,
            updatedAt: now,
        };
        this.db.connection
            .prepare(`INSERT INTO region_topologies
         (topology_id, name, description, regions_json, default_routing_strategy, failover_region_id, active_region_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(fullTopology.topologyId, fullTopology.name, fullTopology.description, JSON.stringify(fullTopology.regions), fullTopology.defaultRoutingStrategy, fullTopology.failoverRegionId, fullTopology.activeRegionId, fullTopology.createdAt, fullTopology.updatedAt);
        return fullTopology;
    }
    getTopology(topologyId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM region_topologies WHERE topology_id = ?`)
            .get(topologyId);
        return row ? this.mapTopology(row) : null;
    }
    listTopologies() {
        return this.db.connection
            .prepare(`SELECT * FROM region_topologies ORDER BY created_at DESC`)
            .all().map((r) => this.mapTopology(r));
    }
    setActiveRegion(topologyId, regionId) {
        const now = nowIso();
        this.db.connection
            .prepare(`UPDATE region_topologies SET active_region_id = ?, updated_at = ? WHERE topology_id = ?`)
            .run(regionId, now, topologyId);
        return this.getTopology(topologyId);
    }
    // ── Routing ────────────────────────────────────────────────────────
    selectRegion(context = {}) {
        const regions = this.listRegions("active");
        if (regions.length === 0) {
            return {
                selectedRegionId: "",
                routingStrategy: this.defaultRoutingStrategy,
                reasonCode: "no_active_regions",
                allRegionEvaluations: [],
                fallbackUsed: false,
            };
        }
        const evaluations = regions.map((region) => this.evaluateRegion(region, context));
        const eligibleRegions = evaluations.filter((e) => e.eligible);
        if (eligibleRegions.length === 0) {
            // Fall back to any active region
            const fallback = evaluations[0];
            return {
                selectedRegionId: fallback.regionId,
                routingStrategy: this.defaultRoutingStrategy,
                reasonCode: "fallback_no_eligible",
                allRegionEvaluations: evaluations,
                fallbackUsed: true,
            };
        }
        // Sort by score and select best
        eligibleRegions.sort((a, b) => {
            if ((b.score ?? 0) !== (a.score ?? 0)) {
                return (b.score ?? 0) - (a.score ?? 0);
            }
            return a.latencyMs !== null && b.latencyMs !== null ? a.latencyMs - b.latencyMs : 0;
        });
        const selected = eligibleRegions[0];
        return {
            selectedRegionId: selected.regionId,
            routingStrategy: this.defaultRoutingStrategy,
            reasonCode: selected.reasonCode,
            allRegionEvaluations: evaluations,
            fallbackUsed: false,
        };
    }
    evaluateRegion(region, context) {
        // Check basic eligibility
        if (region.status !== "active") {
            return {
                regionId: region.regionId,
                eligible: false,
                score: null,
                reasonCode: `region_status_${region.status}`,
                latencyMs: region.latencyMs,
                healthScore: region.healthScore,
            };
        }
        if (region.healthScore < this.minHealthScoreForTraffic) {
            return {
                regionId: region.regionId,
                eligible: false,
                score: null,
                reasonCode: "health_score_too_low",
                latencyMs: region.latencyMs,
                healthScore: region.healthScore,
            };
        }
        if (region.currentLoad >= region.maxConcurrency) {
            return {
                regionId: region.regionId,
                eligible: false,
                score: null,
                reasonCode: "at_capacity",
                latencyMs: region.latencyMs,
                healthScore: region.healthScore,
            };
        }
        // Calculate score based on routing strategy
        let score = 100;
        // Latency penalty
        if (region.latencyMs !== null && region.latencyMs > this.latencyThresholdMs) {
            score -= ((region.latencyMs - this.latencyThresholdMs) / this.latencyThresholdMs) * 30;
        }
        // Health score contribution
        score *= region.healthScore / 100;
        // Load penalty
        const loadRatio = region.currentLoad / region.maxConcurrency;
        score *= (1 - loadRatio * 0.3);
        // Preferred region bonus
        if (context.preferredRegionId && region.regionId === context.preferredRegionId) {
            score += 20;
        }
        return {
            regionId: region.regionId,
            eligible: true,
            score: Math.max(0, score),
            reasonCode: "eligible",
            latencyMs: region.latencyMs,
            healthScore: region.healthScore,
        };
    }
    // ── Failover ──────────────────────────────────────────────────────
    initiateFailover(sourceRegionId, cause, targetRegionId) {
        const sourceRegion = this.getRegion(sourceRegionId);
        if (!sourceRegion)
            return null;
        // Determine target region
        let target = targetRegionId ? this.getRegion(targetRegionId) : null;
        if (!target) {
            // Find best available region
            const regions = this.listRegions("active").filter((r) => r.regionId !== sourceRegionId);
            if (regions.length === 0)
                return null;
            regions.sort((a, b) => (b.healthScore * (1 - b.currentLoad / b.maxConcurrency)) - (a.healthScore * (1 - a.currentLoad / a.maxConcurrency)));
            target = regions[0];
        }
        const planId = newId("foplan");
        const now = nowIso();
        const steps = [
            { stepId: newId("fostep"), stepType: "drain_traffic", status: "pending", completedAt: null, errorMessage: null },
            { stepId: newId("fostep"), stepType: "verify_target", status: "pending", completedAt: null, errorMessage: null },
            { stepId: newId("fostep"), stepType: "switch_primary", status: "pending", completedAt: null, errorMessage: null },
            { stepId: newId("fostep"), stepType: "update_routing", status: "pending", completedAt: null, errorMessage: null },
            { stepId: newId("fostep"), stepType: "verify_failover", status: "pending", completedAt: null, errorMessage: null },
        ];
        const plan = {
            planId,
            sourceRegionId,
            targetRegionId: target.regionId,
            cause,
            initiatedAt: now,
            completedAt: null,
            status: "pending",
            steps,
        };
        this.db.connection
            .prepare(`INSERT INTO failover_plans (plan_id, source_region_id, target_region_id, cause, initiated_at, completed_at, status, steps_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(plan.planId, plan.sourceRegionId, plan.targetRegionId, plan.cause, plan.initiatedAt, plan.completedAt, plan.status, JSON.stringify(plan.steps));
        return plan;
    }
    completeFailoverStep(planId, stepType, success, errorMessage) {
        const now = nowIso();
        const row = this.db.connection
            .prepare(`SELECT steps_json FROM failover_plans WHERE plan_id = ?`)
            .get(planId);
        if (!row)
            return false;
        const steps = JSON.parse(row.steps_json);
        const step = steps.find((s) => s.stepType === stepType);
        if (!step)
            return false;
        step.status = success ? "completed" : "failed";
        step.completedAt = now;
        step.errorMessage = errorMessage ?? null;
        // Check if all steps are done
        const allDone = steps.every((s) => s.status === "completed" || s.status === "skipped");
        const anyFailed = steps.some((s) => s.status === "failed");
        if (allDone) {
            this.db.connection
                .prepare(`UPDATE failover_plans SET status = 'completed', completed_at = ?, steps_json = ? WHERE plan_id = ?`)
                .run(now, JSON.stringify(steps), planId);
        }
        else if (anyFailed) {
            this.db.connection
                .prepare(`UPDATE failover_plans SET status = 'failed', steps_json = ? WHERE plan_id = ?`)
                .run(JSON.stringify(steps), planId);
        }
        else {
            // Mark next pending step as in_progress
            const nextPending = steps.find((s) => s.status === "pending");
            if (nextPending) {
                nextPending.status = "in_progress";
            }
            this.db.connection
                .prepare(`UPDATE failover_plans SET status = 'in_progress', steps_json = ? WHERE plan_id = ?`)
                .run(JSON.stringify(steps), planId);
        }
        return true;
    }
    getFailoverPlan(planId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM failover_plans WHERE plan_id = ?`)
            .get(planId);
        if (!row)
            return null;
        return {
            planId: String(row.plan_id),
            sourceRegionId: String(row.source_region_id),
            targetRegionId: String(row.target_region_id),
            cause: String(row.cause),
            initiatedAt: String(row.initiated_at),
            completedAt: row.completed_at ? String(row.completed_at) : null,
            status: String(row.status),
            steps: JSON.parse(row.steps_json),
        };
    }
    getActiveFailoverPlans() {
        return this.db.connection
            .prepare(`SELECT * FROM failover_plans WHERE status IN ('pending', 'in_progress') ORDER BY initiated_at DESC`)
            .all().map((r) => ({
            planId: String(r.plan_id),
            sourceRegionId: String(r.source_region_id),
            targetRegionId: String(r.target_region_id),
            cause: String(r.cause),
            initiatedAt: String(r.initiated_at),
            completedAt: r.completed_at ? String(r.completed_at) : null,
            status: String(r.status),
            steps: JSON.parse(r.steps_json),
        }));
    }
    // ── Health Monitoring ─────────────────────────────────────────────
    recordRegionHealth(record) {
        const checkId = newId("rhc");
        this.updateRegionHealth({ ...record, checkId });
    }
    getRegionHealthHistory(regionId, limit = 100) {
        return this.db.connection
            .prepare(`SELECT * FROM region_health_checks WHERE region_id = ? ORDER BY checked_at DESC LIMIT ?`)
            .all(regionId, limit).map((r) => ({
            checkId: String(r.check_id),
            regionId: String(r.region_id),
            status: String(r.status),
            latencyMs: r.latency_ms,
            healthScore: Number(r.health_score),
            errorMessage: r.error_message,
            checkedAt: String(r.checked_at),
        }));
    }
    // ── Helpers ───────────────────────────────────────────────────────
    mapRegion(row) {
        return {
            regionId: String(row.region_id),
            name: String(row.name),
            endpoint: String(row.endpoint),
            status: String(row.status),
            priority: Number(row.priority),
            weight: Number(row.weight),
            latencyMs: row.latency_ms,
            healthScore: Number(row.health_score),
            maxConcurrency: Number(row.max_concurrency),
            currentLoad: Number(row.current_load),
            metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
            lastHealthCheckAt: String(row.last_health_check_at),
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
        };
    }
    mapTopology(row) {
        return {
            topologyId: String(row.topology_id),
            name: String(row.name),
            description: row.description ? String(row.description) : "",
            regions: JSON.parse(row.regions_json),
            defaultRoutingStrategy: String(row.default_routing_strategy),
            failoverRegionId: row.failover_region_id ? String(row.failover_region_id) : null,
            activeRegionId: String(row.active_region_id),
            createdAt: String(row.created_at),
            updatedAt: String(row.updated_at),
        };
    }
}
//# sourceMappingURL=cross-region-deployment-service.js.map