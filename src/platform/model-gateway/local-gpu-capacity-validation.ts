export interface LocalGpuCapacityInput {
  readonly gpuId: string;
  readonly gpuModel: "L40S" | string;
  readonly totalMemoryGb: number;
  readonly reservedMemoryGb: number;
  readonly modelMemoryGb: number;
  readonly embeddingQueueDepth: number;
  readonly rerankerQueueDepth: number;
  readonly embeddingQueueLimit: number;
  readonly rerankerQueueLimit: number;
  readonly remoteFallbackAvailable: boolean;
  readonly oomObserved: boolean;
  readonly unloadPolicyEnabled: boolean;
}

export interface LocalGpuCapacityReport {
  readonly gpuId: string;
  readonly admitted: boolean;
  readonly memoryWatermarkRatio: number;
  readonly memoryWatermarkAlert: boolean;
  readonly embeddingQueueIsolated: boolean;
  readonly rerankerQueueIsolated: boolean;
  readonly oomRecoveryAction: "unload_and_fallback" | "fallback" | "none";
  readonly providerDecision: "local" | "remote_fallback" | "deny";
  readonly reasonCodes: readonly string[];
  readonly evidenceFields: readonly string[];
}

export function validateLocalGpuCapacity(
  input: LocalGpuCapacityInput,
): LocalGpuCapacityReport {
  const usedMemoryGb = input.reservedMemoryGb + input.modelMemoryGb;
  const memoryWatermarkRatio =
    input.totalMemoryGb <= 0 ? 1 : usedMemoryGb / input.totalMemoryGb;
  const memoryWithinAdmission = memoryWatermarkRatio < 0.9;
  const l40sCapacityKnown =
    input.gpuModel === "L40S" && input.totalMemoryGb >= 40;
  const embeddingQueueIsolated =
    input.embeddingQueueDepth <= input.embeddingQueueLimit;
  const rerankerQueueIsolated =
    input.rerankerQueueDepth <= input.rerankerQueueLimit;
  const oomRecoveryAction = input.oomObserved
    ? input.unloadPolicyEnabled && input.remoteFallbackAvailable
      ? "unload_and_fallback"
      : input.remoteFallbackAvailable
        ? "fallback"
        : "none"
    : "none";
  const reasonCodes: string[] = [];
  if (!l40sCapacityKnown) {
    reasonCodes.push("gpu.l40s_capacity_unknown");
  }
  if (!memoryWithinAdmission) {
    reasonCodes.push("gpu.memory_watermark_exceeded");
  }
  if (!embeddingQueueIsolated) {
    reasonCodes.push("gpu.embedding_queue_saturated");
  }
  if (!rerankerQueueIsolated) {
    reasonCodes.push("gpu.reranker_queue_saturated");
  }
  if (input.oomObserved && oomRecoveryAction === "none") {
    reasonCodes.push("gpu.oom_unrecovered");
  }

  const admitted =
    l40sCapacityKnown &&
    memoryWithinAdmission &&
    embeddingQueueIsolated &&
    rerankerQueueIsolated &&
    (!input.oomObserved || oomRecoveryAction !== "none");
  const providerDecision = admitted
    ? "local"
    : input.remoteFallbackAvailable
      ? "remote_fallback"
      : "deny";
  return {
    gpuId: input.gpuId,
    admitted,
    memoryWatermarkRatio,
    memoryWatermarkAlert: memoryWatermarkRatio >= 0.9,
    embeddingQueueIsolated,
    rerankerQueueIsolated,
    oomRecoveryAction,
    providerDecision,
    reasonCodes,
    evidenceFields: [
      "admission",
      "memory_watermark",
      "queue_isolation",
      "oom_recovery",
      "unload_policy",
      "provider_fallback",
    ],
  };
}
