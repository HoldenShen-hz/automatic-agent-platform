import { newId, nowIso } from "../../contracts/types/ids.js";

export * from "../../stability/stable-release-gate.js";

export type ReleaseArtifactType =
  | "agent"
  | "workflow"
  | "prompt"
  | "tool"
  | "policy"
  | "model"
  | "evaluator"
  | "sandbox_config"
  | "memory_schema";

export interface ReleaseManifestDraft {
  releaseId: string;
  artifactType: ReleaseArtifactType;
  artifactId: string;
  artifactVersion: string;
  dependencies: Record<string, string>;
  evalReportId?: string;
  rollbackPlanId?: string;
  createdBy: string;
  createdAt: string;
}

export function createReleaseManifestDraft(
  input: Omit<ReleaseManifestDraft, "releaseId" | "createdAt"> & {
    releaseId?: string;
    createdAt?: string;
  },
): ReleaseManifestDraft {
  return {
    releaseId: input.releaseId ?? newId("release"),
    artifactType: input.artifactType,
    artifactId: input.artifactId,
    artifactVersion: input.artifactVersion,
    dependencies: { ...input.dependencies },
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? nowIso(),
    ...(input.evalReportId != null ? { evalReportId: input.evalReportId } : {}),
    ...(input.rollbackPlanId != null ? { rollbackPlanId: input.rollbackPlanId } : {}),
  };
}
