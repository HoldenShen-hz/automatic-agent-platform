export function determineRcGateMode(env?: Record<string, string | undefined>): "observe" | "enforce";

export function isReleaseBlockingPath(path: string): boolean;

export function loadReleaseGateOverrides(rootDir?: string): {
  path: string;
  overrides: Array<{
    overrideId: string;
    blockerIds: string[];
    owner: string;
    expiry: string;
    reason: string;
    riskAcceptance: string;
    followUpIssue: string;
    approvedAt: string | null;
  }>;
  invalidOverrides: Array<{
    overrideId: string | null;
    blockerIds?: string[];
    reason?: string;
  }>;
};

export function applyReleaseGateOverrides(
  releaseBlockers: {
    gateMode: "observe" | "enforce";
    blockerCount: number;
    blockers: Array<Record<string, unknown>>;
    observeOnlyBlockers: string[];
    enforcedBlockers: string[];
    status: "pass" | "fail";
  },
  overrideLedger: ReturnType<typeof loadReleaseGateOverrides>,
  gateMode: "observe" | "enforce",
  now?: Date,
): Record<string, unknown>;

export function countP0AlertsWithoutRunbooks(rootDir?: string): number;

export function countUnsignedEvidenceBundleIssues(
  rootDir?: string,
  stepResults?: Array<{ id: string; ok: boolean | null }>,
  reportPhase?: string,
): number;

export function collectReleaseBlockersFromArtifacts(
  rootDir?: string,
  options?: {
    reportPhase?: string;
    stepResults?: Array<{ id: string; ok: boolean | null }>;
  },
): Array<Record<string, unknown>>;

export function buildRcCheckReport(
  results: Array<{ id: string; required: boolean; ok: boolean | null }>,
  options?: Record<string, unknown>,
): Record<string, unknown>;
