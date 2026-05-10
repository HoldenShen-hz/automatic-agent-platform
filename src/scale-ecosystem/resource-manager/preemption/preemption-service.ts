import { choosePreemptionVictim, type PreemptionCandidate } from "./index.js";

export interface PreemptionServiceOptions {
  /** Maximum age of checkpoint to be considered valid (default: 5 minutes) */
  maxCheckpointAgeMs?: number;
  /** Minimum priority threshold - jobs at or below this level are protected (default: 0) */
  minPreemptablePriority?: number;
  /** Jobs above this priority cannot be preempted (default: 100) */
  maxProtectedPriority?: number;
}

export interface PreemptionSelection {
  readonly victim: PreemptionCandidate | null;
  readonly eligibleCandidates: number;
  readonly filteredCount: number;
}

export class PreemptionService {
  private readonly maxCheckpointAgeMs: number;
  private readonly minPreemptablePriority: number;
  private readonly maxProtectedPriority: number;

  public constructor(options: PreemptionServiceOptions = {}) {
    this.maxCheckpointAgeMs = options.maxCheckpointAgeMs ?? 300_000;
    this.minPreemptablePriority = options.minPreemptablePriority ?? 0;
    this.maxProtectedPriority = options.maxProtectedPriority ?? 100;
  }

  /**
   * Select a preemption victim from candidates.
   *
   * @param candidates - List of potential preemption victims
   * @returns Selection result including the chosen victim and diagnostic info
   */
  public selectVictim(candidates: readonly PreemptionCandidate[]): PreemptionSelection {
    const eligibleCandidates = [...candidates].filter((c) => !c.protectedFromPreemption);

    const victim = choosePreemptionVictim(
      candidates,
      this.maxCheckpointAgeMs,
      this.minPreemptablePriority,
      this.maxProtectedPriority,
    );

    return {
      victim,
      eligibleCandidates: eligibleCandidates.length,
      filteredCount: candidates.length - eligibleCandidates.length,
    };
  }

  /** Re-expose static function signature for compatibility */
  public static chooseVictim(
    candidates: readonly PreemptionCandidate[],
    maxCheckpointAgeMs = 300_000,
  ): PreemptionCandidate | null {
    return choosePreemptionVictim(candidates, maxCheckpointAgeMs);
  }
}