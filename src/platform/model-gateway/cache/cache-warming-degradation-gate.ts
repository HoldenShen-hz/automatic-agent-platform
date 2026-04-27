export interface CacheWarmingSignal {
  readonly cacheName: string;
  readonly warmedKeyCount: number;
  readonly requiredKeyCount: number;
  readonly d2Ready: boolean;
  readonly d3Ready: boolean;
}

export interface CacheWarmingGateDecision {
  readonly ready: boolean;
  readonly degradationMode: "ready" | "degradation_unready";
  readonly reasonCodes: readonly string[];
}

export class CacheWarmingDegradationGate {
  public evaluate(signal: CacheWarmingSignal): CacheWarmingGateDecision {
    const reasonCodes: string[] = [];
    if (signal.warmedKeyCount < signal.requiredKeyCount) {
      reasonCodes.push("cache_warming.required_keys_missing");
    }
    if (!signal.d2Ready) {
      reasonCodes.push("cache_warming.d2_unready");
    }
    if (!signal.d3Ready) {
      reasonCodes.push("cache_warming.d3_unready");
    }
    return {
      ready: reasonCodes.length === 0,
      degradationMode: reasonCodes.length === 0 ? "ready" : "degradation_unready",
      reasonCodes,
    };
  }
}
