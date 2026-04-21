import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { listActiveAgents, isValidLifecycleTransition, } from "./agent-registry/index.js";
import { shouldPromoteCanary, getNextCanaryStage, calculateTrafficSplit, } from "./canary-controller/index.js";
import { canRetireAgent, } from "./retirement/index.js";
import { resolveLatestAgentVersion, compareSemver, } from "./version-manager/index.js";
export class AgentLifecycleService {
    agents = new Map();
    versions = new Map();
    canaryProgress = new Map();
    registerAgent(definition) {
        this.agents.set(definition.agentId, definition);
        return definition;
    }
    addVersion(version) {
        this.requireAgent(version.agentId);
        this.versions.set(version.agentId, [...(this.versions.get(version.agentId) ?? []), version]);
        return version;
    }
    listActive() {
        const agents = [...this.agents.values()];
        const activeIds = new Set(listActiveAgents(agents).map((item) => item.agentId));
        return agents.filter((item) => activeIds.has(item.agentId));
    }
    /**
     * Transitions agent to a new lifecycle state.
     * Validates transition per §61.3 state machine.
     */
    transition(agentId, toState, changedAt = nowIso()) {
        const agent = this.requireAgent(agentId);
        const fromState = agent.lifecycleState;
        if (!isValidLifecycleTransition(fromState, toState)) {
            return {
                allowed: false,
                fromState,
                toState,
                reason: `Invalid transition from ${fromState} to ${toState}`,
            };
        }
        const updated = {
            ...agent,
            lifecycleState: toState,
            updatedAt: changedAt,
        };
        this.agents.set(agentId, updated);
        return { allowed: true, fromState, toState };
    }
    /**
     * Advances canary to next stage or promotes to active.
     * Per §61.4 traffic splitting.
     */
    advanceCanary(agentId, progress, changedAt = nowIso()) {
        const agent = this.requireAgent(agentId);
        if (agent.lifecycleState !== "canary") {
            throw new Error(`agent_lifecycle.invalid_state:${agentId}:${agent.lifecycleState}`);
        }
        // Check if should promote to active
        if (shouldPromoteCanary(progress)) {
            const updated = {
                ...agent,
                lifecycleState: "active",
                updatedAt: changedAt,
            };
            this.agents.set(agentId, updated);
            this.canaryProgress.delete(agentId);
            return {
                agentId,
                fromState: "canary",
                toState: "active",
                versionId: agent.currentVersionId,
                changedAt,
                reasonCodes: ["agent_lifecycle.canary_promoted"],
            };
        }
        // Advance to next canary stage
        const nextStage = getNextCanaryStage(progress.rolloutPercent);
        if (nextStage !== null) {
            // Store progress for traffic splitting
            this.canaryProgress.set(agentId, progress);
        }
        return {
            agentId,
            fromState: "canary",
            toState: "canary",
            versionId: agent.currentVersionId,
            changedAt,
            reasonCodes: ["agent_lifecycle.canary_stage_advanced"],
        };
    }
    /**
     * Gets current traffic split for canary agent.
     */
    getCanaryTrafficSplit(agentId) {
        const progress = this.canaryProgress.get(agentId);
        if (!progress)
            return null;
        return calculateTrafficSplit(progress.currentStage);
    }
    promoteCanary(agentId, progress, changedAt = nowIso()) {
        const agent = this.requireAgent(agentId);
        if (agent.lifecycleState !== "canary") {
            throw new Error(`agent_lifecycle.invalid_state:${agentId}:${agent.lifecycleState}`);
        }
        if (!shouldPromoteCanary(progress)) {
            throw new Error(`agent_lifecycle.canary_not_ready:${agentId}`);
        }
        const updated = {
            ...agent,
            lifecycleState: "active",
            updatedAt: changedAt,
        };
        this.agents.set(agentId, updated);
        this.canaryProgress.delete(agentId);
        return {
            agentId,
            fromState: "canary",
            toState: "active",
            versionId: updated.currentVersionId,
            changedAt,
            reasonCodes: ["agent_lifecycle.canary_promoted"],
        };
    }
    rollback(agentId, rolledBackAt = nowIso()) {
        const agent = this.requireAgent(agentId);
        const versions = this.requireVersions(agentId);
        const currentVersionId = agent.currentVersionId;
        const sorted = [...versions].sort((left, right) => compareSemver(right.semver, left.semver));
        const fallback = sorted.find((item) => item.versionId !== currentVersionId);
        if (fallback == null) {
            throw new Error(`agent_lifecycle.rollback_target_not_found:${agentId}`);
        }
        this.agents.set(agentId, {
            ...agent,
            currentVersionId: fallback.versionId,
            lifecycleState: "staging",
            updatedAt: rolledBackAt,
        });
        return {
            agentId,
            fromVersionId: currentVersionId,
            toVersionId: fallback.versionId,
            rolledBackAt,
        };
    }
    retire(plan, now = nowIso()) {
        const agent = this.requireAgent(plan.agentId);
        if (!canRetireAgent(plan, now)) {
            throw new Error(`agent_lifecycle.retirement_not_ready:${plan.agentId}`);
        }
        this.agents.set(plan.agentId, {
            ...agent,
            lifecycleState: "deprecated",
            updatedAt: now,
        });
        return {
            agentId: plan.agentId,
            fromState: agent.lifecycleState,
            toState: "deprecated",
            versionId: agent.currentVersionId,
            changedAt: now,
            reasonCodes: ["agent_lifecycle.deprecated"],
        };
    }
    archive(agentId, archivedAt = nowIso()) {
        const agent = this.requireAgent(agentId);
        if (agent.lifecycleState !== "deprecated") {
            throw new Error(`agent_lifecycle.can_only_archive_from_deprecated:${agentId}`);
        }
        this.agents.set(agentId, {
            ...agent,
            lifecycleState: "archived",
            updatedAt: archivedAt,
        });
        return {
            agentId,
            fromState: "deprecated",
            toState: "archived",
            versionId: agent.currentVersionId,
            changedAt: archivedAt,
            reasonCodes: ["agent_lifecycle.archived"],
        };
    }
    bindTask(agentId, taskId, boundAt = nowIso()) {
        const agent = this.requireAgent(agentId);
        if (agent.lifecycleState === "archived" || agent.lifecycleState === "deprecated") {
            throw new Error(`agent_lifecycle.binding_forbidden:${agentId}:${agent.lifecycleState}`);
        }
        const latestVersion = resolveLatestAgentVersion(this.requireVersions(agentId));
        if (latestVersion == null) {
            throw new Error(`agent_lifecycle.version_not_found:${agentId}`);
        }
        return {
            bindingId: newId("agent_binding"),
            agentId,
            taskId,
            versionId: agent.currentVersionId || latestVersion.versionId,
            boundAt,
        };
    }
    getAgent(agentId) {
        return this.agents.get(agentId) ?? null;
    }
    getLatestVersion(agentId) {
        const latestVersionId = resolveLatestAgentVersion(this.versions.get(agentId) ?? [])?.versionId ?? null;
        return (this.versions.get(agentId) ?? []).find((item) => item.versionId === latestVersionId) ?? null;
    }
    getAllVersions(agentId) {
        return this.versions.get(agentId) ?? [];
    }
    getCanaryProgress(agentId) {
        return this.canaryProgress.get(agentId) ?? null;
    }
    requireAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (agent == null) {
            throw new Error(`agent_lifecycle.agent_not_found:${agentId}`);
        }
        return agent;
    }
    requireVersions(agentId) {
        const versions = this.versions.get(agentId) ?? [];
        if (versions.length === 0) {
            throw new Error(`agent_lifecycle.version_not_found:${agentId}`);
        }
        return versions;
    }
}
//# sourceMappingURL=agent-lifecycle-service.js.map