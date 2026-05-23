export const PLATFORM_VALIDATION_SCORECARD_WEIGHTS = {
  functionalCorrectness: 20,
  runtimeReliability: 15,
  stateReplayConsistency: 15,
  securityTenantIam: 15,
  evidenceResearchQuality: 10,
  extensionRuntimeSafety: 10,
  observabilityRunbookReadiness: 10,
  costBudgetAttribution: 5,
} as const;

export type PlatformValidationScorecardDimension =
  keyof typeof PLATFORM_VALIDATION_SCORECARD_WEIGHTS;

export interface PlatformValidationGateResult {
  readonly gateId: string;
  readonly severity: "P0" | "P1" | "P2" | "P3";
  readonly status: "passed" | "failed" | "waived";
  readonly waiver?: {
    readonly owner: string;
    readonly expiry: string;
    readonly auditRef: string;
  };
}

export interface PlatformValidationScorecardInput {
  readonly dimensionRatios: Readonly<
    Record<PlatformValidationScorecardDimension, number>
  >;
  readonly gates: readonly PlatformValidationGateResult[];
  readonly registryClosurePassed: boolean;
  readonly evidenceBundleVerified: boolean;
  readonly projectionRebuildDiff: number;
  readonly researchMissionSloPassed: boolean;
  readonly externalSignoffRefs?: readonly string[];
}

export interface PlatformValidationScorecard {
  readonly score: number;
  readonly decision: "pass" | "conditional_pass" | "fail";
  readonly blockers: readonly string[];
  readonly weightedDimensions: Readonly<
    Record<PlatformValidationScorecardDimension, number>
  >;
}

export interface PlatformMissionSloProfile {
  readonly missionType: "research" | "code_agent" | "ops";
  readonly evidenceCoverageTarget: number;
  readonly toolReceiptCoverageTarget: number;
  readonly budgetAttributionCoverageTarget: number;
  readonly harnessCompletionTarget: number;
  readonly hitlSlaMs: number;
  readonly recoveryRtoMs: number;
  readonly projectionLagP95Ms: number;
  readonly apiAvailabilityTarget: number;
}

export interface PlatformMissionSloMeasurement {
  readonly evidenceCoverage: number;
  readonly toolReceiptCoverage: number;
  readonly budgetAttributionCoverage: number;
  readonly harnessCompletion: number;
  readonly hitlSlaMs: number;
  readonly recoveryRtoMs: number;
  readonly projectionLagP95Ms: number;
  readonly apiAvailability: number;
}

export interface PlatformMissionSloEvaluation {
  readonly missionType: PlatformMissionSloProfile["missionType"];
  readonly passed: boolean;
  readonly checks: ReadonlyArray<{
    readonly name:
      | "evidence_coverage"
      | "tool_receipt_coverage"
      | "budget_attribution_coverage"
      | "harness_completion"
      | "hitl_sla"
      | "recovery_rto"
      | "projection_lag_p95"
      | "api_availability";
    readonly operator: ">=" | "<=";
    readonly actual: number;
    readonly target: number;
    readonly passed: boolean;
  }>;
}

export interface PlatformCapacityValidationReport {
  readonly profiles: readonly PlatformCapacityProfileResult[];
  readonly soakCommand: string;
  readonly passed: boolean;
}

export interface PlatformCapacityProfileResult {
  readonly profile:
    | "smoke"
    | "pilot"
    | "stress"
    | "soak"
    | "spike"
    | "backpressure";
  readonly targetConcurrentTasks: number;
  readonly evidenceKind:
    | "bounded_harness"
    | "stable_soak"
    | "queue_backpressure";
  readonly passed: boolean;
}

export function buildPlatformValidationScorecard(
  input: PlatformValidationScorecardInput,
): PlatformValidationScorecard {
  const weightedDimensions = Object.fromEntries(
    Object.entries(PLATFORM_VALIDATION_SCORECARD_WEIGHTS).map(
      ([dimension, weight]) => [
        dimension,
        roundRatio(
          input.dimensionRatios[
            dimension as PlatformValidationScorecardDimension
          ],
        ) * weight,
      ],
    ),
  ) as Record<PlatformValidationScorecardDimension, number>;
  const score = Number(
    Object.values(weightedDimensions)
      .reduce((total, value) => total + value, 0)
      .toFixed(2),
  );
  const blockers = buildFreezeBlockers(input);
  const p1WaiversValid = input.gates
    .filter((gate) => gate.severity === "P1" && gate.status === "waived")
    .every((gate) => gate.waiver != null);
  const openP1 = input.gates.some(
    (gate) => gate.severity === "P1" && gate.status === "failed",
  );
  const onlyConditionalScore = score >= 85 && score < 90;
  const decision =
    blockers.length > 0 || openP1 || !p1WaiversValid || score < 85
      ? "fail"
      : onlyConditionalScore ||
          input.gates.some(
            (gate) => gate.severity === "P2" && gate.status === "waived",
          )
        ? "conditional_pass"
        : "pass";

  return {
    score,
    decision,
    blockers,
    weightedDimensions,
  };
}

export function buildCapacityValidationReport(input: {
  readonly smokePassed: boolean;
  readonly pilotPassed: boolean;
  readonly stressPassed: boolean;
  readonly soakPassed: boolean;
  readonly spikePassed: boolean;
  readonly backpressurePassed: boolean;
}): PlatformCapacityValidationReport {
  const profiles: PlatformCapacityProfileResult[] = [
    profile("smoke", 10, "bounded_harness", input.smokePassed),
    profile("pilot", 50, "bounded_harness", input.pilotPassed),
    profile("stress", 200, "bounded_harness", input.stressPassed),
    profile("soak", 200, "stable_soak", input.soakPassed),
    profile("spike", 2_000, "queue_backpressure", input.spikePassed),
    profile(
      "backpressure",
      200,
      "queue_backpressure",
      input.backpressurePassed,
    ),
  ];
  return {
    profiles,
    soakCommand: "npm run soak:stable",
    passed: profiles.every((item) => item.passed),
  };
}

export function evaluatePlatformMissionSlo(
  profile: PlatformMissionSloProfile,
  measurement: PlatformMissionSloMeasurement,
): PlatformMissionSloEvaluation {
  const checks: PlatformMissionSloEvaluation["checks"] = [
    passAtLeast(
      "evidence_coverage",
      measurement.evidenceCoverage,
      profile.evidenceCoverageTarget,
    ),
    passAtLeast(
      "tool_receipt_coverage",
      measurement.toolReceiptCoverage,
      profile.toolReceiptCoverageTarget,
    ),
    passAtLeast(
      "budget_attribution_coverage",
      measurement.budgetAttributionCoverage,
      profile.budgetAttributionCoverageTarget,
    ),
    passAtLeast(
      "harness_completion",
      measurement.harnessCompletion,
      profile.harnessCompletionTarget,
    ),
    passAtMost("hitl_sla", measurement.hitlSlaMs, profile.hitlSlaMs),
    passAtMost("recovery_rto", measurement.recoveryRtoMs, profile.recoveryRtoMs),
    passAtMost(
      "projection_lag_p95",
      measurement.projectionLagP95Ms,
      profile.projectionLagP95Ms,
    ),
    passAtLeast(
      "api_availability",
      measurement.apiAvailability,
      profile.apiAvailabilityTarget,
    ),
  ];
  return {
    missionType: profile.missionType,
    passed: checks.every((check) => check.passed),
    checks,
  };
}

function buildFreezeBlockers(
  input: PlatformValidationScorecardInput,
): string[] {
  const blockers: string[] = [];
  if (
    input.gates.some(
      (gate) => gate.severity === "P0" && gate.status !== "passed",
    )
  ) {
    blockers.push("freeze.p0_gate_open");
  }
  if (!input.registryClosurePassed) {
    blockers.push("freeze.registry_closure_missing");
  }
  if (!input.evidenceBundleVerified) {
    blockers.push("freeze.evidence_bundle_unverified");
  }
  if (input.projectionRebuildDiff !== 0) {
    blockers.push("freeze.projection_rebuild_diff");
  }
  if (!input.researchMissionSloPassed) {
    blockers.push("freeze.research_slo_failed");
  }
  if ((input.externalSignoffRefs?.length ?? 0) === 0) {
    blockers.push("freeze.external_signoff_missing");
  }
  return blockers;
}

function profile(
  profileName: PlatformCapacityProfileResult["profile"],
  targetConcurrentTasks: number,
  evidenceKind: PlatformCapacityProfileResult["evidenceKind"],
  passed: boolean,
): PlatformCapacityProfileResult {
  return {
    profile: profileName,
    targetConcurrentTasks,
    evidenceKind,
    passed,
  };
}

function passAtLeast(
  name:
    | "evidence_coverage"
    | "tool_receipt_coverage"
    | "budget_attribution_coverage"
    | "harness_completion"
    | "api_availability",
  actual: number,
  target: number,
) {
  return {
    name,
    operator: ">=" as const,
    actual,
    target,
    passed: actual >= target,
  };
}

function passAtMost(
  name: "hitl_sla" | "recovery_rto" | "projection_lag_p95",
  actual: number,
  target: number,
) {
  return {
    name,
    operator: "<=" as const,
    actual,
    target,
    passed: actual <= target,
  };
}

function roundRatio(value: number): number {
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}
