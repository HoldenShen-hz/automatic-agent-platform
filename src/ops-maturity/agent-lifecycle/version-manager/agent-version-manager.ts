/**
 * @fileoverview Agent Version Manager with Blue-Green Deployment
 *
 * Provides:
 * - Multi-version registry for agents (v1, v2, v3 coexisting)
 * - Blue-green deployment slot management
 * - Version stability and deprecation tracking
 * - Version comparison and compatibility checking
 *
 * §61 Agent Lifecycle - Agent Version Management + Blue-Green Deployment
 */

import { z } from "zod";
import { newId, nowIso } from "../../../platform/contracts/types/ids.js";

export const AgentVersionStageSchema = z.enum(["stable", "canary", "beta", "alpha"]);
export const DeploymentSlotSchema = z.enum(["blue", "green"]);

export type AgentVersionStage = z.infer<typeof AgentVersionStageSchema>;
export type DeploymentSlot = z.infer<typeof DeploymentSlotSchema>;

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

export type AgentVersionDetail = z.infer<typeof AgentVersionDetailSchema>;

export interface AgentVersionConflict {
  agentId: string;
  conflictingVersions: string[];
  reason: string;
}

function newestFirst(versions: readonly AgentVersionDetail[]): AgentVersionDetail[] {
  return versions
    .map((version, index) => ({ version, index }))
    .sort((left, right) => {
      const createdAtOrder = right.version.createdAt.localeCompare(left.version.createdAt);
      return createdAtOrder !== 0 ? createdAtOrder : right.index - left.index;
    })
    .map((entry) => entry.version);
}

export class AgentVersionManager {
  private readonly versions = new Map<string, AgentVersionDetail[]>();
  private readonly slotAssignments = new Map<string, string>();

  private setVersions(agentId: string, versions: readonly AgentVersionDetail[]): void {
    this.versions.set(agentId, [...versions]);
  }

  public registerVersion(detail: Omit<AgentVersionDetail, "versionId" | "createdAt">): AgentVersionDetail {
    const version = AgentVersionDetailSchema.parse({
      ...detail,
      versionId: newId("agentver"),
      createdAt: nowIso(),
    });

    const existing = this.versions.get(detail.agentId) ?? [];
    this.setVersions(detail.agentId, [...existing, version]);
    if (version.deploymentSlot != null) {
      this.slotAssignments.set(`${version.agentId}:${version.deploymentSlot}` as const, version.versionId);
    }

    return version;
  }

  public assignDeploymentSlot(agentId: string, versionId: string, slot: DeploymentSlot): void {
    const versions = this.versions.get(agentId);
    if (!versions) return;

    const current = versions.find((version) => version.versionId === versionId);
    if (!current) return;

    // Check if this version is already in the target slot - no-op if already assigned
    if (current.deploymentSlot === slot) return;

    // Blue-green mutual exclusion: a version can only occupy one slot at a time.
    // If this version is in the opposite slot, revoke it first before assigning to new slot.
    const oppositeSlot = slot === "blue" ? "green" : "blue";
    if (current.deploymentSlot === oppositeSlot) {
      // Evict from opposite slot to maintain mutual exclusion
      const updatedVersions = versions.map((v) =>
        v.versionId === versionId ? { ...v, deploymentSlot: slot } : v,
      );
      this.setVersions(agentId, updatedVersions);
      this.slotAssignments.delete(`${agentId}:${oppositeSlot}` as const);
      this.slotAssignments.set(`${agentId}:${slot}` as const, versionId);
      return;
    }

    // For blue-green zero-downtime: allow both slots to be active during transition.
    // Do NOT evict the existing occupant - both slots can be active simultaneously.
    const updatedVersions = versions.map((version) => {
      if (version.versionId === versionId) {
        return { ...version, deploymentSlot: slot };
      }
      return version;
    });

    this.setVersions(agentId, updatedVersions);
    this.slotAssignments.set(`${agentId}:${slot}` as const, versionId);
  }

  /**
   * Revokes a version from its slot, allowing the slot to be reclaimed by the next assignDeploymentSlot.
   * Supports zero-downtime blue-green: only evicts if the version is currently slotted.
   */
  public revokeSlot(agentId: string, versionId: string): void {
    const versions = this.versions.get(agentId);
    if (!versions) return;

    const version = versions.find((v) => v.versionId === versionId);
    if (!version || !version.deploymentSlot) return;

    const slot = version.deploymentSlot;
    const updatedVersions = versions.map((v) =>
      v.versionId === versionId ? { ...v, deploymentSlot: null } : v,
    );

    this.setVersions(agentId, updatedVersions);
    const slotKey = `${agentId}:${slot}` as const;
    if (this.slotAssignments.get(slotKey) === versionId) {
      this.slotAssignments.delete(slotKey);
    }
  }

  /**
   * Performs a blue-green switch: promotes the latest eligible version to the target slot.
   * Both slots remain active during the transition window for zero-downtime.
   * Use revokeSlot on the old version to complete the transition.
   *
   * Eligible candidates are versions that are:
   * - Currently in the opposite slot (being phased out), OR
   * - Unslotted (new versions available for deployment)
   * Always skips alpha-stage versions.
   */
  public blueGreenSwitch(agentId: string, targetSlot: DeploymentSlot): AgentVersionDetail | null {
    const currentSlot = targetSlot === "blue" ? "green" : "blue";
    const currentVersion = this.getActiveSlot(agentId, currentSlot);

    const allVersions = this.versions.get(agentId) ?? [];
    // Find eligible candidate: in opposite slot or unslotted, never alpha stage
    const candidate = newestFirst(allVersions).find(
      (v) => v.stage !== "alpha" && (v.deploymentSlot === currentSlot || v.deploymentSlot === null),
    );

    if (candidate) {
      this.assignDeploymentSlot(agentId, candidate.versionId, targetSlot);
      return this.getActiveSlot(agentId, targetSlot);
    }

    return this.getActiveSlot(agentId, targetSlot) ?? currentVersion;
  }

  public getActiveSlot(agentId: string, slot: DeploymentSlot): AgentVersionDetail | null {
    const versionId = this.slotAssignments.get(`${agentId}:${slot}` as const);
    if (!versionId) return null;

    const versions = this.versions.get(agentId) ?? [];
    return versions.find((v) => v.versionId === versionId) ?? null;
  }

  public switchSlot(agentId: string, targetSlot: DeploymentSlot): AgentVersionDetail | null {
    const currentSlot = targetSlot === "blue" ? "green" : "blue";
    const currentVersion = this.getActiveSlot(agentId, currentSlot);

    const allVersions = this.versions.get(agentId) ?? [];
    const latestForSlot = newestFirst(allVersions).find((v) => v.deploymentSlot === null && v.stage !== "alpha");

    if (latestForSlot) {
      this.assignDeploymentSlot(agentId, latestForSlot.versionId, targetSlot);
      return this.getActiveSlot(agentId, targetSlot);
    }

    return this.getActiveSlot(agentId, targetSlot) ?? currentVersion;
  }

  public listVersions(agentId: string): AgentVersionDetail[] {
    return newestFirst(this.versions.get(agentId) ?? []);
  }

  public getStableVersions(agentId: string): AgentVersionDetail[] {
    return this.listVersions(agentId).filter((v) => v.stable);
  }

  public deprecateVersion(agentId: string, versionId: string): boolean {
    const versions = this.versions.get(agentId);
    if (!versions) return false;

    const hasVersion = versions.some((version) => version.versionId === versionId);
    if (!hasVersion) return false;

    this.setVersions(
      agentId,
      versions.map((version) =>
        version.versionId === versionId
          ? { ...version, deprecatedAt: nowIso() }
          : version),
    );
    return true;
  }

  public updateMetrics(agentId: string, versionId: string, metrics: Partial<AgentVersionDetail["metrics"]>): void {
    const versions = this.versions.get(agentId);
    if (!versions) return;

    const hasVersion = versions.some((version) => version.versionId === versionId);
    if (!hasVersion) return;

    this.setVersions(
      agentId,
      versions.map((version) =>
        version.versionId === versionId
          ? { ...version, metrics: { ...version.metrics, ...metrics } }
          : version),
    );
  }
}
