/**
 * @fileoverview Agent Version Manager with Blue-Green Deployment
 *
 * Provides:
 * - Multi-version registry for agents (v1, v2, v3 coexisting)
 * - Blue-green deployment slot management
 * - Version stability and deprecation tracking
 * - Version comparison and compatibility checking
 *
 * §61 Agent 生命周期 - Agent 版本管理 + 蓝绿部署
 */
import { z } from "zod";
import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
export const AgentVersionStageSchema = z.enum(["stable", "canary", "beta", "alpha"]);
export const DeploymentSlotSchema = z.enum(["blue", "green"]);
export const AgentVersionDetailSchema = z.object({
    versionId: z.string().min(1),
    agentId: z.string().min(1),
    version: z.string().min(1),
    stage: AgentVersionStageSchema.default("alpha"),
    createdAt: z.string().min(1),
    deprecatedAt: z.string().nullable().default(null),
    stable: z.boolean().default(false),
    deploymentSlot: DeploymentSlotSchema.nullable().default(null),
    changelog: z.string().default(""),
    metrics: z.object({
        totalExecutions: z.number().default(0),
        successRate: z.number().default(0),
        avgDurationMs: z.number().default(0),
    }).default({}),
});
export class AgentVersionManager {
    versions = new Map();
    slotAssignments = new Map();
    registerVersion(detail) {
        const version = {
            ...detail,
            versionId: newId("agentver"),
            createdAt: nowIso(),
        };
        const existing = this.versions.get(detail.agentId) ?? [];
        this.versions.set(detail.agentId, [...existing, version]);
        return version;
    }
    assignDeploymentSlot(agentId, versionId, slot) {
        const versions = this.versions.get(agentId);
        if (!versions)
            return;
        const version = versions.find((v) => v.versionId === versionId);
        if (!version)
            return;
        version.deploymentSlot = slot;
        // If assigning to blue, revoke green (and vice versa)
        if (slot === "blue") {
            versions.forEach((v) => {
                if (v.deploymentSlot === "green")
                    v.deploymentSlot = null;
            });
        }
        else {
            versions.forEach((v) => {
                if (v.deploymentSlot === "blue")
                    v.deploymentSlot = null;
            });
        }
        this.slotAssignments.set(`${agentId}:${slot}`, versionId);
    }
    getActiveSlot(agentId, slot) {
        const versionId = this.slotAssignments.get(`${agentId}:${slot}`);
        if (!versionId)
            return null;
        const versions = this.versions.get(agentId) ?? [];
        return versions.find((v) => v.versionId === versionId) ?? null;
    }
    switchSlot(agentId, targetSlot) {
        const currentSlot = targetSlot === "blue" ? "green" : "blue";
        const currentVersion = this.getActiveSlot(agentId, currentSlot);
        if (!currentVersion)
            return null;
        const allVersions = this.versions.get(agentId) ?? [];
        const latestForSlot = allVersions
            .filter((v) => v.deploymentSlot === null && v.stage !== "alpha")
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        if (latestForSlot) {
            this.assignDeploymentSlot(agentId, latestForSlot.versionId, targetSlot);
            return this.getActiveSlot(agentId, targetSlot);
        }
        return currentVersion;
    }
    listVersions(agentId) {
        return [...(this.versions.get(agentId) ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    getStableVersions(agentId) {
        return this.listVersions(agentId).filter((v) => v.stable);
    }
    deprecateVersion(agentId, versionId) {
        const versions = this.versions.get(agentId);
        if (!versions)
            return false;
        const version = versions.find((v) => v.versionId === versionId);
        if (!version)
            return false;
        version.deprecatedAt = nowIso();
        return true;
    }
    updateMetrics(agentId, versionId, metrics) {
        const versions = this.versions.get(agentId);
        if (!versions)
            return;
        const version = versions.find((v) => v.versionId === versionId);
        if (!version)
            return;
        version.metrics = { ...version.metrics, ...metrics };
    }
}
//# sourceMappingURL=agent-version-manager.js.map