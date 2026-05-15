import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
import { normalizeSandboxMode, type SandboxModeLike } from "../../five-plane-control-plane/iam/sandbox-policy.js";

export interface PackCatalogEntry {
  readonly packId: string;
  readonly name: string;
  readonly version: string;
  readonly domainId: string;
  readonly description: string;
  readonly lifecycleStage: "draft" | "review" | "approved" | "published" | "deprecated" | "archived";
  readonly sandboxTier: SandboxModeLike;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly riskCount: number;
  readonly dependencyCount: number;
  readonly pluginCount: number;
  readonly toolBundleCount: number;
}

export interface CreatePackCatalogInput {
  readonly packId: string;
  readonly name: string;
  readonly version: string;
  readonly domainId: string;
  readonly description?: string;
  readonly createdBy: string;
  readonly sandboxTier?: PackCatalogEntry["sandboxTier"];
  readonly riskCount?: number;
  readonly dependencyCount?: number;
  readonly pluginCount?: number;
  readonly toolBundleCount?: number;
}

export class PackCatalogService {
  private readonly packs = new Map<string, PackCatalogEntry>();

  public createPack(input: CreatePackCatalogInput): PackCatalogEntry {
    if (this.packs.has(input.packId)) {
      throw new ValidationError("pack.already_exists", `Pack ${input.packId} already exists.`, {
        details: { packId: input.packId },
      });
    }

    const now = nowIso();
    const record: PackCatalogEntry = {
      packId: input.packId,
      name: input.name,
      version: input.version,
      domainId: input.domainId,
      description: input.description ?? "",
      lifecycleStage: "draft",
      sandboxTier: normalizeSandboxMode(input.sandboxTier),
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
      riskCount: input.riskCount ?? 0,
      dependencyCount: input.dependencyCount ?? 0,
      pluginCount: input.pluginCount ?? 0,
      toolBundleCount: input.toolBundleCount ?? 0,
    };
    this.packs.set(record.packId, record);
    return record;
  }

  public getPack(packId: string): PackCatalogEntry | null {
    return this.packs.get(packId) ?? null;
  }

  public listPacks(limit = 50): PackCatalogEntry[] {
    return [...this.packs.values()]
      .sort((left, right) => {
        const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
        if (byCreatedAt !== 0) return byCreatedAt;
        return [...this.packs.keys()].indexOf(right.packId) - [...this.packs.keys()].indexOf(left.packId);
      })
      .slice(0, Math.max(0, limit));
  }
}
