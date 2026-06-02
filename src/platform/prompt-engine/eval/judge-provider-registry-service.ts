import type { JudgeProfileRecord, JudgeProfileStatus } from "./eval-dataset-judge-service.js";
import { DEFAULT_MODEL_METADATA_REGISTRY } from "../../five-plane-control-plane/config-center/model-metadata-registry.js";

export type JudgeIsolationLevel = "cross_provider_required" | "cross_family_preferred" | "same_provider_allowed";

export interface JudgeProviderDescriptor {
  readonly providerId: string;
  readonly provider: string;
  readonly providerFamily: string;
  readonly modelId: string;
  readonly supportedCapabilities: readonly string[];
  readonly maxCostUsd: number;
  readonly trustScore: number;
  readonly latencyTier: "low" | "medium" | "high";
  readonly isolationLevel: JudgeIsolationLevel;
  readonly status: JudgeProfileStatus;
}

interface JudgeProviderCatalogEntry {
  readonly providerId: string;
  readonly provider: string;
  readonly providerFamily: string;
  readonly modelId: string;
  readonly supportedCapabilities: readonly string[];
  readonly maxCostUsd: number;
  readonly trustScore: number;
  readonly latencyTier: JudgeProviderDescriptor["latencyTier"];
  readonly isolationLevel: JudgeIsolationLevel;
}

const DEFAULT_JUDGE_PROVIDER_CATALOG: readonly JudgeProviderCatalogEntry[] = [
  {
    providerId: "judge.openai.gpt-5.4-mini",
    provider: "openai",
    providerFamily: "openai",
    modelId: "gpt-5.4-mini",
    supportedCapabilities: ["llm_judge", "pairwise_rank", "policy_audit"],
    maxCostUsd: 0.15,
    trustScore: 0.92,
    latencyTier: "low",
    isolationLevel: "cross_provider_required",
  },
  {
    providerId: "judge.anthropic.claude-sonnet-4-20250514",
    provider: "anthropic",
    providerFamily: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    supportedCapabilities: ["llm_judge", "safety_review"],
    maxCostUsd: 0.18,
    trustScore: 0.9,
    latencyTier: "medium",
    isolationLevel: "cross_provider_required",
  },
  {
    providerId: "judge.minimax.MiniMax-M1",
    provider: "minimax",
    providerFamily: "minimax",
    modelId: DEFAULT_MODEL_METADATA_REGISTRY.profiles.balanced?.modelId ?? "MiniMax-M1",
    supportedCapabilities: ["llm_judge", "regional_eval"],
    maxCostUsd: 0.1,
    trustScore: 0.82,
    latencyTier: "medium",
    isolationLevel: "cross_family_preferred",
  },
] as const;

export class JudgeProviderRegistryService {
  private readonly descriptors = new Map<string, JudgeProviderDescriptor>();
  private readonly recentSelectionsByCapability = new Map<string, readonly Pick<JudgeProviderDescriptor, "providerId" | "providerFamily">[]>();

  public registerDescriptor(descriptor: JudgeProviderDescriptor): JudgeProviderDescriptor {
    this.descriptors.set(descriptor.providerId, descriptor);
    return descriptor;
  }

  public syncJudgeProfile(
    profile: JudgeProfileRecord,
    overrides: Partial<Pick<JudgeProviderDescriptor, "trustScore" | "latencyTier" | "isolationLevel">> = {},
  ): JudgeProviderDescriptor {
    return this.registerDescriptor({
      providerId: profile.judgeId,
      provider: profile.provider,
      providerFamily: profile.providerFamily,
      modelId: profile.modelId,
      supportedCapabilities: profile.capabilities,
      maxCostUsd: profile.maxCostUsd,
      trustScore: overrides.trustScore ?? 0.8,
      latencyTier: overrides.latencyTier ?? "medium",
      isolationLevel: overrides.isolationLevel ?? "cross_provider_required",
      status: profile.status,
    });
  }

  public registerDefaults(): JudgeProviderDescriptor[] {
    return DEFAULT_JUDGE_PROVIDER_CATALOG.map((entry) => this.registerDescriptor({
      ...entry,
      status: this.resolveDefaultStatus(entry.provider),
    }));
  }

  public listDescriptors(status?: JudgeProfileStatus): JudgeProviderDescriptor[] {
    return [...this.descriptors.values()]
      .filter((descriptor) => status == null || descriptor.status === status)
      .sort((left, right) => right.trustScore - left.trustScore || left.maxCostUsd - right.maxCostUsd || left.providerId.localeCompare(right.providerId));
  }

  public selectDescriptor(input: {
    capability: string;
    candidateProviderFamily?: string | null;
    maxCostUsd?: number | null;
    requireIsolation?: boolean;
  }): JudgeProviderDescriptor | null {
    const requireIsolation = input.requireIsolation ?? true;
    const candidates = this.listDescriptors("ready").filter((descriptor) => {
      if (!descriptor.supportedCapabilities.includes(input.capability)) {
        return false;
      }
      if (input.maxCostUsd != null && descriptor.maxCostUsd > input.maxCostUsd) {
        return false;
      }
      if (!requireIsolation || input.candidateProviderFamily == null) {
        return true;
      }
      if (descriptor.providerFamily !== input.candidateProviderFamily) {
        return true;
      }
      return descriptor.isolationLevel === "same_provider_allowed";
    });
    if (candidates.length === 0) {
      return null;
    }
    const recentSelections = this.recentSelectionsByCapability.get(input.capability) ?? [];
    const repeatedFamilyExists = candidates.some(
      (candidate) => recentSelections.some((recent) => recent.providerFamily === candidate.providerFamily),
    );
    const repeatedProviderExists = candidates.some(
      (candidate) => recentSelections.some((recent) => recent.providerId === candidate.providerId),
    );
    const sortedCandidates = [...candidates].sort((left, right) => {
      const leftPenalty = this.computeSelectionPenalty(left, recentSelections, repeatedFamilyExists, repeatedProviderExists);
      const rightPenalty = this.computeSelectionPenalty(right, recentSelections, repeatedFamilyExists, repeatedProviderExists);
      return leftPenalty - rightPenalty
        || right.trustScore - left.trustScore
        || left.maxCostUsd - right.maxCostUsd
        || left.providerId.localeCompare(right.providerId);
    });
    const selected = sortedCandidates[0] ?? null;
    if (selected != null) {
      this.rememberSelection(input.capability, selected);
    }
    return selected;
  }

  private resolveDefaultStatus(provider: string): JudgeProfileStatus {
    const providerStatus = DEFAULT_MODEL_METADATA_REGISTRY.providers[provider]?.status;
    return providerStatus === "disabled" || providerStatus === "deprecated" ? "disabled" : "ready";
  }

  private computeSelectionPenalty(
    descriptor: JudgeProviderDescriptor,
    recentSelections: readonly Pick<JudgeProviderDescriptor, "providerId" | "providerFamily">[],
    repeatedFamilyExists: boolean,
    repeatedProviderExists: boolean,
  ): number {
    let penalty = 0;
    if (repeatedFamilyExists && recentSelections.some((recent) => recent.providerFamily === descriptor.providerFamily)) {
      penalty += 100;
    }
    if (repeatedProviderExists && recentSelections.some((recent) => recent.providerId === descriptor.providerId)) {
      penalty += 25;
    }
    return penalty;
  }

  private rememberSelection(capability: string, descriptor: JudgeProviderDescriptor): void {
    const current = this.recentSelectionsByCapability.get(capability) ?? [];
    this.recentSelectionsByCapability.set(
      capability,
      [
        { providerId: descriptor.providerId, providerFamily: descriptor.providerFamily },
        ...current.filter((entry) => entry.providerId !== descriptor.providerId),
      ].slice(0, 4),
    );
  }
}
