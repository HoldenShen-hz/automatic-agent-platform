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

    const previousSlot = current.deploymentSlot;
    const updatedVersions = versions.map((version) => {
      if (version.versionId === versionId) {
        return { ...version, deploymentSlot: slot };
      }
      if (version.deploymentSlot === slot) {
        return { ...version, deploymentSlot: null };
      }
      return version;
    });

    this.setVersions(agentId, updatedVersions);

    if (previousSlot != null && previousSlot !== slot) {
      this.slotAssignments.delete(`${agentId}:${previousSlot}` as const);
    }
    this.slotAssignments.set(`${agentId}:${slot}` as const, versionId);
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
