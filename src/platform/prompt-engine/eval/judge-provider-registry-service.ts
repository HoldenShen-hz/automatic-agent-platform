import type { JudgeProfileRecord, JudgeProfileStatus } from "./eval-dataset-judge-service.js";

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

export class JudgeProviderRegistryService {
  private readonly descriptors = new Map<string, JudgeProviderDescriptor>();

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
    return [
      this.registerDescriptor({
        providerId: "judge.openai.gpt-5.4-mini",
        provider: "openai",
        providerFamily: "openai",
        modelId: "gpt-5.4-mini",
        supportedCapabilities: ["llm_judge", "pairwise_rank", "policy_audit"],
        maxCostUsd: 0.15,
        trustScore: 0.92,
        latencyTier: "low",
        isolationLevel: "cross_provider_required",
        status: "ready",
      }),
      this.registerDescriptor({
        providerId: "judge.anthropic.claude-sonnet",
        provider: "anthropic",
        providerFamily: "anthropic",
        modelId: "claude-sonnet",
        supportedCapabilities: ["llm_judge", "safety_review"],
        maxCostUsd: 0.18,
        trustScore: 0.9,
        latencyTier: "medium",
        isolationLevel: "cross_provider_required",
        status: "ready",
      }),
      this.registerDescriptor({
        providerId: "judge.minimax.m1",
        provider: "minimax",
        providerFamily: "minimax",
        modelId: "m1",
        supportedCapabilities: ["llm_judge", "regional_eval"],
        maxCostUsd: 0.1,
        trustScore: 0.82,
        latencyTier: "medium",
        isolationLevel: "cross_family_preferred",
        status: "ready",
      }),
    ];
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
    return this.listDescriptors("ready").find((descriptor) => {
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
    }) ?? null;
  }
}
