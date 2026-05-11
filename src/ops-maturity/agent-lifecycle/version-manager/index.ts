import { z } from "zod";
export {
  AgentVersionManager,
  AgentVersionDetailSchema,
  AgentVersionStageSchema,
  DeploymentSlotSchema,
} from "./agent-version-manager.js";
export type {
  AgentVersionConflict,
  AgentVersionDetail,
  AgentVersionStage,
  DeploymentSlot,
} from "./agent-version-manager.js";

/**
 * Component snapshot for version tracking.
 * As defined in architecture doc §61.2.
 */
export const ComponentSnapshotSchema = z.object({
  packVersion: z.string().min(1),
  promptBundleVersion: z.string().min(1),
  modelBindingHash: z.string().min(1),
  trustProfileHash: z.string().min(1),
  triggerSetHash: z.string().min(1),
  autonomyConfigHash: z.string().min(1),
});

/**
 * Agent version snapshot - immutable record of agent components at a point in time.
 * As defined in architecture doc §61.2.
 */
export const AgentVersionSchema = z.object({
  versionId: z.string().min(1),
  agentId: z.string().min(1),
  semver: z.string().min(1),
  componentSnapshot: ComponentSnapshotSchema,
  createdAt: z.string().min(1),
  createdBy: z.string().min(1),
  releaseNote: z.string().default(""),
});

export type AgentVersion = z.infer<typeof AgentVersionSchema>;

export function resolveLatestAgentVersion(versions: readonly AgentVersion[]): AgentVersion | null {
  if (!versions || versions.length === 0) return null;
  return [...versions]
    .map((v, i) => ({ version: v, index: i }))
    .sort((left, right) => {
      const leftTime = left.version.createdAt ?? left.version.agentId ?? "";
      const rightTime = right.version.createdAt ?? right.version.agentId ?? "";
      const timeCmp = rightTime.localeCompare(leftTime);
      if (timeCmp !== 0) return timeCmp;
      return right.index - left.index;
    })[0]?.version ?? null;
}

/**
 * Parses a semver string into components.
 */
export function parseSemver(semver: string): { major: number; minor: number; patch: number } | null {
  const match = semver.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
  };
}

/**
 * Compares two semver strings.
 * Returns negative if left < right, 0 if equal, positive if left > right.
 */
export function compareSemver(left: string, right: string): number {
  const leftParsed = parseSemver(left);
  const rightParsed = parseSemver(right);
  if (leftParsed === null || rightParsed === null) return 0;

  if (leftParsed.major !== rightParsed.major) {
    return leftParsed.major - rightParsed.major;
  }
  if (leftParsed.minor !== rightParsed.minor) {
    return leftParsed.minor - rightParsed.minor;
  }
  return leftParsed.patch - rightParsed.patch;
}
