import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import {
  buildClaimEvidenceGraph,
  type CitationClaim,
  type ClaimEvidenceGraph,
  verifyCitations,
} from "../../../domains/knowledge-base/citation-verifier.js";
import {
  evaluatePolicyAdherence,
  type PolicyAdherenceCase,
  type PolicyAdherenceReport,
} from "../../../domains/customer-service/policy-adherence-evaluator.js";
import {
  isPlainObject,
  parseLimitedYaml,
  toObjectArray,
} from "../../../domains/governance/division-loader-support.js";
import {
  LeadershipClaimConfigRegistry,
  type FamilyLeadershipReadiness,
} from "./leadership-claim-config-registry.js";
import {
  evaluatePatchGate,
  type PatchGateCheckInput,
  type PatchGateReport,
} from "./patch-gate.js";

export type P0PilotDivisionId = "coding" | "knowledge-base" | "customer-service";
export type P0PilotFamilyId = "engineering" | "knowledge-research" | "enterprise-ops";
export type P0PilotEvidenceVerdict = "insufficient_evidence" | "mvp_ready" | "leadership_ready";
export type P0PilotRoiConfidence = "insufficient" | "low" | "medium" | "high";
export type P0PilotBenchmarkComparison = "gte" | "lte";
export type P0PilotRedTeamOutcome = "blocked" | "mitigated" | "escaped";
export type P0PilotRedTeamSeverity = "low" | "medium" | "high" | "critical";
export type P0PilotThresholdStatus = "pass" | "fail";

export interface P0PilotEvidenceRunnerOptions {
  readonly platformRoot?: string;
  readonly configRoot?: string;
  readonly inputRoot?: string;
  readonly outputRoot?: string;
  readonly now?: Date;
}

export interface CodingEvalCase extends PatchGateCheckInput {
  readonly caseId: string;
  readonly humanEditDistance?: number | null;
  readonly prDrafted?: boolean;
}

export interface KnowledgeEvalCase {
  readonly caseId: string;
  readonly claims: readonly CitationClaim[];
}

export interface CustomerServiceEvalCase extends PolicyAdherenceCase {}

export interface P0PilotRedTeamCaseResult {
  readonly caseId: string;
  readonly severity: P0PilotRedTeamSeverity;
  readonly outcome: P0PilotRedTeamOutcome;
  readonly benchmarkId?: string | null;
  readonly evidenceRefs?: readonly string[];
}

export interface P0PilotRoiSample {
  readonly sampleId: string;
  readonly baselineDurationMinutes: number;
  readonly assistedDurationMinutes: number;
  readonly baselineCostUsd: number;
  readonly assistedCostUsd: number;
  readonly baselineQualityScore: number;
  readonly assistedQualityScore: number;
  readonly baselineRiskScore: number;
  readonly assistedRiskScore: number;
}

export interface P0PilotBenchmarkComparisonResult {
  readonly benchmarkId: string;
  readonly metricId: string;
  readonly internalValue: number;
  readonly externalBaselineValue: number;
  readonly comparison: P0PilotBenchmarkComparison;
  readonly evidenceRefs?: readonly string[];
}

export interface P0PilotObservationRecord {
  readonly observationId: string;
  readonly status: "completed" | "abandoned" | "needs_followup";
  readonly humanApproved?: boolean;
  readonly evidenceLinked?: boolean;
}

export interface P0PilotObservationMetadata {
  readonly policyTestCount?: number;
  readonly staleDocChecksAutomated?: boolean;
  readonly staleDocChecksCompleted?: boolean;
  readonly note?: string;
}

export interface P0PilotObservationInput {
  readonly observations: readonly P0PilotObservationRecord[];
  readonly metadata?: P0PilotObservationMetadata;
}

export interface P0PilotEvalSection {
  readonly caseCount: number;
  readonly passRate: number;
  readonly passed: boolean;
  readonly details: Record<string, unknown>;
}

export interface P0PilotRedTeamSection {
  readonly caseCount: number;
  readonly criticalEscapedCount: number;
  readonly escapedCount: number;
  readonly blockedCount: number;
  readonly mitigatedCount: number;
  readonly passed: boolean;
}

export interface P0PilotRoiSection {
  readonly sampleCount: number;
  readonly minimumSampleSize: number;
  readonly confidence: P0PilotRoiConfidence;
  readonly averageTimeSavedMinutes: number;
  readonly averageCostDeltaUsd: number;
  readonly averageQualityDelta: number;
  readonly averageRiskDelta: number;
  readonly passed: boolean;
}

export interface P0PilotBenchmarkCheckResult {
  readonly benchmarkId: string;
  readonly metricId: string;
  readonly comparison: P0PilotBenchmarkComparison;
  readonly internalValue: number;
  readonly externalBaselineValue: number;
  readonly passed: boolean;
  readonly delta: number;
}

export interface P0PilotBenchmarkSection {
  readonly comparisonCount: number;
  readonly passedComparisonCount: number;
  readonly passed: boolean;
  readonly validationErrors: readonly string[];
  readonly comparisons: readonly P0PilotBenchmarkCheckResult[];
}

export interface P0PilotObservationSection {
  readonly totalObservationCount: number;
  readonly completedObservationCount: number;
  readonly humanApprovedObservationCount: number;
  readonly evidenceLinkedObservationCount: number;
  readonly metadata: P0PilotObservationMetadata;
}

export interface P0PilotThresholdCheck {
  readonly label: string;
  readonly requirement: string;
  readonly observed: number | string | boolean;
  readonly status: P0PilotThresholdStatus;
}

export interface P0PilotThresholdSection {
  readonly mvp: readonly P0PilotThresholdCheck[];
  readonly leadership: readonly P0PilotThresholdCheck[];
  readonly mvpPassed: boolean;
  readonly leadershipPassed: boolean;
}

export interface P0PilotEvidencePackage {
  readonly generatedAt: string;
  readonly divisionId: P0PilotDivisionId;
  readonly familyId: P0PilotFamilyId;
  readonly familyDisplayName: string;
  readonly readinessStatus: string;
  readonly targetClaimLevel: string;
  readonly eval: P0PilotEvalSection;
  readonly redTeam: P0PilotRedTeamSection;
  readonly roi: P0PilotRoiSection;
  readonly benchmark: P0PilotBenchmarkSection;
  readonly pilot: P0PilotObservationSection;
  readonly thresholds: P0PilotThresholdSection;
  readonly verdict: {
    readonly status: P0PilotEvidenceVerdict;
    readonly evalPassed: boolean;
    readonly redTeamPassed: boolean;
    readonly roiPassed: boolean;
    readonly benchmarkPassed: boolean;
  };
}

export interface P0PilotArtifactReport {
  readonly divisionId: P0PilotDivisionId;
  readonly familyId: P0PilotFamilyId;
  readonly status: P0PilotEvidenceVerdict;
  readonly outputDir: string;
  readonly jsonPath: string;
  readonly markdownPath: string;
  readonly report: P0PilotEvidencePackage;
}

export interface P0PilotAggregateReport {
  readonly generatedAt: string;
  readonly divisionCount: number;
  readonly summary: {
    readonly leadershipReadyCount: number;
    readonly mvpReadyCount: number;
    readonly insufficientEvidenceCount: number;
  };
  readonly artifacts: readonly P0PilotArtifactReport[];
}

interface KnowledgeEvalCaseReport {
  readonly caseId: string;
  readonly verification: ReturnType<typeof verifyCitations>;
  readonly graph: ClaimEvidenceGraph;
}

interface ThresholdObservation {
  readonly count: number;
  readonly automated: boolean;
}

const DEFAULT_INPUT_ROOT_SEGMENTS = ["data", "pilot-evidence-inputs"] as const;
const DEFAULT_OUTPUT_ROOT_SEGMENTS = ["artifacts", "validation", "p0-pilot-evidence"] as const;

const FAMILY_BY_DIVISION: Record<P0PilotDivisionId, P0PilotFamilyId> = {
  coding: "engineering",
  "knowledge-base": "knowledge-research",
  "customer-service": "enterprise-ops",
};

function resolvePlatformRoot(platformRoot?: string): string {
  return platformRoot ?? process.env.AA_PLATFORM_ROOT ?? process.cwd();
}

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`pilot_evidence.input_missing:${path}`);
    }
    throw error;
  }
}

function readYamlObject(path: string): Record<string, unknown> {
  const parsed = parseLimitedYaml(readFileSync(path, "utf8"), path);
  return isPlainObject(parsed) ? parsed : {};
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function ensureArray<T>(value: unknown, fieldName: string): readonly T[] {
  if (Array.isArray(value)) {
    return value as readonly T[];
  }
  throw new Error(`pilot_evidence.invalid_array:${fieldName}`);
}

function expectPlainObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (isPlainObject(value)) {
    return value;
  }
  throw new Error(`pilot_evidence.invalid_object:${fieldName}`);
}

function expectString(value: unknown, fieldName: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  throw new Error(`pilot_evidence.invalid_string:${fieldName}`);
}

function expectBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  throw new Error(`pilot_evidence.invalid_boolean:${fieldName}`);
}

function expectNumber(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  throw new Error(`pilot_evidence.invalid_number:${fieldName}`);
}

function expectOptionalFiniteNumber(value: unknown, fieldName: string): number | null | undefined {
  if (value == null) {
    return value as null | undefined;
  }
  return expectNumber(value, fieldName);
}

function expectStringArray(value: unknown, fieldName: string): readonly string[] {
  return ensureArray<unknown>(value, fieldName).map((entry, index) => expectString(entry, `${fieldName}[${index}]`));
}

function expectOptionalStringArray(value: unknown, fieldName: string): readonly string[] | undefined {
  if (value == null) {
    return undefined;
  }
  return expectStringArray(value, fieldName);
}

function expectEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string,
): T {
  const candidate = expectString(value, fieldName);
  if ((allowed as readonly string[]).includes(candidate)) {
    return candidate as T;
  }
  throw new Error(`pilot_evidence.invalid_enum:${fieldName}:${candidate}`);
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function compareBenchmark(
  comparison: P0PilotBenchmarkComparison,
  internalValue: number,
  externalBaselineValue: number,
): boolean {
  return comparison === "gte"
    ? internalValue >= externalBaselineValue
    : internalValue <= externalBaselineValue;
}

function inferRoiConfidence(sampleCount: number, minimumSampleSize: number): P0PilotRoiConfidence {
  if (sampleCount < Math.max(1, Math.ceil(minimumSampleSize / 2))) {
    return "insufficient";
  }
  if (sampleCount < minimumSampleSize) {
    return "low";
  }
  if (sampleCount < minimumSampleSize * 2) {
    return "medium";
  }
  return "high";
}

function extractThresholdMinimum(requirement: string): number | null {
  const match = /^>=\s*(\d+)$/u.exec(requirement.trim());
  return match == null ? null : Number(match[1]);
}

function evaluateThresholdRequirement(requirement: string, observation: ThresholdObservation): P0PilotThresholdCheck["status"] {
  const trimmed = requirement.trim();
  if (trimmed === "required") {
    return observation.count > 0 ? "pass" : "fail";
  }
  if (trimmed === "automated") {
    return observation.automated ? "pass" : "fail";
  }
  if (trimmed === "100%") {
    return observation.count >= 100 ? "pass" : "fail";
  }
  if (trimmed === "0") {
    return observation.count === 0 ? "pass" : "fail";
  }
  const minimum = extractThresholdMinimum(trimmed);
  if (minimum != null) {
    return observation.count >= minimum ? "pass" : "fail";
  }
  return "fail";
}

function buildThresholdObservation(
  familyId: P0PilotFamilyId,
  label: string,
  input: {
    readonly evalCaseCount: number;
    readonly redTeamCaseCount: number;
    readonly completedObservationCount: number;
    readonly evidenceLinkedObservationCount: number;
    readonly metadata: P0PilotObservationMetadata;
  },
): ThresholdObservation {
  if (familyId === "engineering") {
    if (label === "Internal SWE-style tasks") {
      return { count: input.evalCaseCount, automated: false };
    }
    if (label === "AWI red-team cases") {
      return { count: input.redTeamCaseCount, automated: false };
    }
    if (label === "Real pilot PRs") {
      return { count: input.completedObservationCount, automated: false };
    }
  }
  if (familyId === "knowledge-research") {
    if (label === "Citation evaluation cases") {
      return { count: input.evalCaseCount, automated: false };
    }
    if (label === "Experiment-linked conclusions") {
      return { count: input.evidenceLinkedObservationCount, automated: false };
    }
    if (label === "Stale doc checks") {
      return {
        count: input.metadata.staleDocChecksCompleted === true || input.metadata.staleDocChecksAutomated === true ? 1 : 0,
        automated: input.metadata.staleDocChecksAutomated === true,
      };
    }
  }
  if (familyId === "enterprise-ops") {
    if (label === "Tau-style cases") {
      return { count: input.evalCaseCount, automated: false };
    }
    if (label === "Policy tests") {
      return { count: toFiniteNumber(input.metadata.policyTestCount, 0), automated: false };
    }
    if (label === "Pilot tasks") {
      return { count: input.completedObservationCount, automated: false };
    }
  }
  return { count: 0, automated: false };
}

function buildThresholdChecks(
  family: FamilyLeadershipReadiness,
  input: {
    readonly evalCaseCount: number;
    readonly redTeamCaseCount: number;
    readonly completedObservationCount: number;
    readonly evidenceLinkedObservationCount: number;
    readonly metadata: P0PilotObservationMetadata;
  },
): P0PilotThresholdSection {
  const convert = (thresholds: readonly { label: string; requirement: string }[]) =>
    thresholds.map((threshold) => {
      const observation = buildThresholdObservation(
        family.familyId as P0PilotFamilyId,
        threshold.label,
        input,
      );
      return {
        label: threshold.label,
        requirement: threshold.requirement,
        observed: threshold.requirement.trim() === "automated"
          ? observation.automated
          : threshold.requirement.trim() === "required"
            ? observation.count > 0
            : observation.count,
        status: evaluateThresholdRequirement(threshold.requirement, observation),
      } satisfies P0PilotThresholdCheck;
    });

  const mvp = convert(family.mvpThresholds);
  const leadership = convert(family.leadershipThresholds);
  return {
    mvp,
    leadership,
    mvpPassed: mvp.every((entry) => entry.status === "pass"),
    leadershipPassed: leadership.every((entry) => entry.status === "pass"),
  };
}

function validateCitationClaims(value: unknown, fieldName: string): readonly CitationClaim[] {
  return ensureArray<unknown>(value, fieldName).map((entry, index) => {
    const object = expectPlainObject(entry, `${fieldName}[${index}]`);
    return {
      claimId: expectString(object.claimId, `${fieldName}[${index}].claimId`),
      text: expectString(object.text, `${fieldName}[${index}].text`),
      citationId: object.citationId == null ? null : expectString(object.citationId, `${fieldName}[${index}].citationId`),
      sourceId: object.sourceId == null ? null : expectString(object.sourceId, `${fieldName}[${index}].sourceId`),
      supported: expectBoolean(object.supported, `${fieldName}[${index}].supported`),
      sourceDate: object.sourceDate == null ? null : expectString(object.sourceDate, `${fieldName}[${index}].sourceDate`),
    } satisfies CitationClaim;
  });
}

function validateCodingEvalCases(value: unknown, fieldName: string): readonly CodingEvalCase[] {
  return ensureArray<unknown>(value, fieldName).map((entry, index) => {
    const object = expectPlainObject(entry, `${fieldName}[${index}]`);
    const evidenceRefs = expectOptionalStringArray(object.evidenceRefs, `${fieldName}[${index}].evidenceRefs`);
    const humanEditDistance = expectOptionalFiniteNumber(object.humanEditDistance, `${fieldName}[${index}].humanEditDistance`);
    const prDrafted = object.prDrafted == null ? undefined : expectBoolean(object.prDrafted, `${fieldName}[${index}].prDrafted`);
    return {
      caseId: expectString(object.caseId, `${fieldName}[${index}].caseId`),
      patchApplied: expectBoolean(object.patchApplied, `${fieldName}[${index}].patchApplied`),
      targetedTestsPassed: expectBoolean(object.targetedTestsPassed, `${fieldName}[${index}].targetedTestsPassed`),
      p2pPreserved: expectBoolean(object.p2pPreserved, `${fieldName}[${index}].p2pPreserved`),
      changedPaths: expectStringArray(object.changedPaths, `${fieldName}[${index}].changedPaths`),
      generatedCommands: expectStringArray(object.generatedCommands, `${fieldName}[${index}].generatedCommands`),
      secretFindings: expectStringArray(object.secretFindings, `${fieldName}[${index}].secretFindings`),
      ...(evidenceRefs == null ? {} : { evidenceRefs }),
      ...(humanEditDistance === undefined ? {} : { humanEditDistance }),
      ...(prDrafted === undefined ? {} : { prDrafted }),
    } satisfies CodingEvalCase;
  });
}

function validateKnowledgeEvalCases(value: unknown, fieldName: string): readonly KnowledgeEvalCase[] {
  return ensureArray<unknown>(value, fieldName).map((entry, index) => {
    const object = expectPlainObject(entry, `${fieldName}[${index}]`);
    return {
      caseId: expectString(object.caseId, `${fieldName}[${index}].caseId`),
      claims: validateCitationClaims(object.claims, `${fieldName}[${index}].claims`),
    } satisfies KnowledgeEvalCase;
  });
}

function validateCustomerServiceEvalCases(value: unknown, fieldName: string): readonly CustomerServiceEvalCase[] {
  return ensureArray<unknown>(value, fieldName).map((entry, index) => {
    const object = expectPlainObject(entry, `${fieldName}[${index}]`);
    return {
      caseId: expectString(object.caseId, `${fieldName}[${index}].caseId`),
      policyMatched: expectBoolean(object.policyMatched, `${fieldName}[${index}].policyMatched`),
      toolArgumentsValid: expectBoolean(object.toolArgumentsValid, `${fieldName}[${index}].toolArgumentsValid`),
      handoffCorrect: expectBoolean(object.handoffCorrect, `${fieldName}[${index}].handoffCorrect`),
      requiresHitl: expectBoolean(object.requiresHitl, `${fieldName}[${index}].requiresHitl`),
      hitlApproved: expectBoolean(object.hitlApproved, `${fieldName}[${index}].hitlApproved`),
    } satisfies CustomerServiceEvalCase;
  });
}

function loadDivisionEvalCases(
  path: string,
  divisionId: P0PilotDivisionId,
): readonly CodingEvalCase[] | readonly KnowledgeEvalCase[] | readonly CustomerServiceEvalCase[] {
  const parsed = readJsonFile(path);
  if (!isPlainObject(parsed)) {
    throw new Error(`pilot_evidence.invalid_eval_payload:${divisionId}`);
  }
  if (divisionId === "coding") {
    return validateCodingEvalCases(parsed.cases, `${divisionId}.eval.cases`);
  }
  if (divisionId === "knowledge-base") {
    return validateKnowledgeEvalCases(parsed.cases, `${divisionId}.eval.cases`);
  }
  return validateCustomerServiceEvalCases(parsed.cases, `${divisionId}.eval.cases`);
}

function loadRedTeamCases(path: string): readonly P0PilotRedTeamCaseResult[] {
  const parsed = readJsonFile(path);
  if (!isPlainObject(parsed)) {
    throw new Error("pilot_evidence.invalid_redteam_payload");
  }
  return ensureArray<unknown>(parsed.cases, "redteam.cases").map((entry, index) => {
    const object = expectPlainObject(entry, `redteam.cases[${index}]`);
    const benchmarkId = object.benchmarkId == null ? null : expectString(object.benchmarkId, `redteam.cases[${index}].benchmarkId`);
    const evidenceRefs = expectOptionalStringArray(object.evidenceRefs, `redteam.cases[${index}].evidenceRefs`);
    return {
      caseId: expectString(object.caseId, `redteam.cases[${index}].caseId`),
      severity: expectEnumValue(object.severity, ["low", "medium", "high", "critical"], `redteam.cases[${index}].severity`),
      outcome: expectEnumValue(object.outcome, ["blocked", "mitigated", "escaped"], `redteam.cases[${index}].outcome`),
      ...(benchmarkId == null ? {} : { benchmarkId }),
      ...(evidenceRefs == null ? {} : { evidenceRefs }),
    } satisfies P0PilotRedTeamCaseResult;
  });
}

function loadRoiSamples(path: string): readonly P0PilotRoiSample[] {
  const parsed = readJsonFile(path);
  if (!isPlainObject(parsed)) {
    throw new Error("pilot_evidence.invalid_roi_payload");
  }
  return ensureArray<unknown>(parsed.samples, "roi.samples").map((entry, index) => {
    const object = expectPlainObject(entry, `roi.samples[${index}]`);
    return {
      sampleId: expectString(object.sampleId, `roi.samples[${index}].sampleId`),
      baselineDurationMinutes: expectNumber(object.baselineDurationMinutes, `roi.samples[${index}].baselineDurationMinutes`),
      assistedDurationMinutes: expectNumber(object.assistedDurationMinutes, `roi.samples[${index}].assistedDurationMinutes`),
      baselineCostUsd: expectNumber(object.baselineCostUsd, `roi.samples[${index}].baselineCostUsd`),
      assistedCostUsd: expectNumber(object.assistedCostUsd, `roi.samples[${index}].assistedCostUsd`),
      baselineQualityScore: expectNumber(object.baselineQualityScore, `roi.samples[${index}].baselineQualityScore`),
      assistedQualityScore: expectNumber(object.assistedQualityScore, `roi.samples[${index}].assistedQualityScore`),
      baselineRiskScore: expectNumber(object.baselineRiskScore, `roi.samples[${index}].baselineRiskScore`),
      assistedRiskScore: expectNumber(object.assistedRiskScore, `roi.samples[${index}].assistedRiskScore`),
    } satisfies P0PilotRoiSample;
  });
}

function loadBenchmarkComparisons(path: string): readonly P0PilotBenchmarkComparisonResult[] {
  const parsed = readJsonFile(path);
  if (!isPlainObject(parsed)) {
    throw new Error("pilot_evidence.invalid_benchmark_payload");
  }
  return ensureArray<unknown>(parsed.comparisons, "benchmark.comparisons").map((entry, index) => {
    const object = expectPlainObject(entry, `benchmark.comparisons[${index}]`);
    const evidenceRefs = expectOptionalStringArray(object.evidenceRefs, `benchmark.comparisons[${index}].evidenceRefs`);
    return {
      benchmarkId: expectString(object.benchmarkId, `benchmark.comparisons[${index}].benchmarkId`),
      metricId: expectString(object.metricId, `benchmark.comparisons[${index}].metricId`),
      internalValue: expectNumber(object.internalValue, `benchmark.comparisons[${index}].internalValue`),
      externalBaselineValue: expectNumber(object.externalBaselineValue, `benchmark.comparisons[${index}].externalBaselineValue`),
      comparison: expectEnumValue(object.comparison, ["gte", "lte"], `benchmark.comparisons[${index}].comparison`),
      ...(evidenceRefs == null ? {} : { evidenceRefs }),
    } satisfies P0PilotBenchmarkComparisonResult;
  });
}

function loadPilotObservations(path: string): P0PilotObservationInput {
  const parsed = readJsonFile(path);
  if (!isPlainObject(parsed)) {
    throw new Error("pilot_evidence.invalid_pilot_payload");
  }
  const metadata = parsed.metadata == null ? {} : expectPlainObject(parsed.metadata, "pilot.metadata");
  return {
    observations: ensureArray<unknown>(parsed.observations, "pilot.observations").map((entry, index) => {
      const object = expectPlainObject(entry, `pilot.observations[${index}]`);
      const humanApproved = object.humanApproved == null ? undefined : expectBoolean(object.humanApproved, `pilot.observations[${index}].humanApproved`);
      const evidenceLinked = object.evidenceLinked == null ? undefined : expectBoolean(object.evidenceLinked, `pilot.observations[${index}].evidenceLinked`);
      return {
        observationId: expectString(object.observationId, `pilot.observations[${index}].observationId`),
        status: expectEnumValue(object.status, ["completed", "abandoned", "needs_followup"], `pilot.observations[${index}].status`),
        ...(humanApproved === undefined ? {} : { humanApproved }),
        ...(evidenceLinked === undefined ? {} : { evidenceLinked }),
      } satisfies P0PilotObservationRecord;
    }),
    metadata: {
      ...(metadata.policyTestCount == null ? {} : { policyTestCount: expectNumber(metadata.policyTestCount, "pilot.metadata.policyTestCount") }),
      ...(metadata.staleDocChecksAutomated == null ? {} : { staleDocChecksAutomated: expectBoolean(metadata.staleDocChecksAutomated, "pilot.metadata.staleDocChecksAutomated") }),
      ...(metadata.staleDocChecksCompleted == null ? {} : { staleDocChecksCompleted: expectBoolean(metadata.staleDocChecksCompleted, "pilot.metadata.staleDocChecksCompleted") }),
      ...(metadata.note == null ? {} : { note: expectString(metadata.note, "pilot.metadata.note") }),
    },
  };
}

function buildCodingEvalSection(cases: readonly CodingEvalCase[]): P0PilotEvalSection {
  const reports = cases.map((entry) => evaluatePatchGate(entry));
  const passCount = reports.filter((report) => report.allowed).length;
  const averageHumanEditDistance = average(
    cases
      .map((entry) => entry.humanEditDistance)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
  );
  const prDraftRate = average(cases.map((entry) => entry.prDrafted === true ? 1 : 0));
  return {
    caseCount: cases.length,
    passRate: round(cases.length === 0 ? 0 : passCount / cases.length),
    passed: cases.length > 0 && passCount === cases.length,
    details: {
      passCount,
      failedCaseIds: cases.filter((_, index) => !reports[index]?.allowed).map((entry) => entry.caseId),
      averageHumanEditDistance: round(averageHumanEditDistance),
      prDraftRate: round(prDraftRate),
      patchGateReports: reports satisfies readonly PatchGateReport[],
    },
  };
}

function buildKnowledgeEvalSection(cases: readonly KnowledgeEvalCase[], now: Date): P0PilotEvalSection {
  const reports: KnowledgeEvalCaseReport[] = cases.map((entry) => ({
    caseId: entry.caseId,
    verification: verifyCitations(entry.claims, now),
    graph: buildClaimEvidenceGraph(entry.claims),
  }));
  const coverage = average(reports.map((entry) => entry.verification.citationCoverage));
  const correctness = average(reports.map((entry) => entry.verification.citationCorrectness));
  const staleSourceCount = reports.reduce((sum, entry) => sum + entry.verification.staleSourceCount, 0);
  const unsupportedClaimCount = reports.reduce((sum, entry) => sum + entry.verification.unsupportedClaimCount, 0);
  const passed = cases.length > 0
    && coverage >= 0.95
    && correctness >= 0.95
    && staleSourceCount === 0
    && unsupportedClaimCount === 0;
  return {
    caseCount: cases.length,
    passRate: round(passed ? 1 : average(reports.map((entry) => {
      const verification = entry.verification;
      const components = [
        verification.citationCoverage >= 0.95,
        verification.citationCorrectness >= 0.95,
        verification.staleSourceCount === 0,
        verification.unsupportedClaimCount === 0,
      ];
      return components.filter(Boolean).length / components.length;
    }))),
    passed,
    details: {
      averageCitationCoverage: round(coverage),
      averageCitationCorrectness: round(correctness),
      staleSourceCount,
      unsupportedClaimCount,
      caseReports: reports,
    },
  };
}

function buildCustomerServiceEvalSection(cases: readonly CustomerServiceEvalCase[]): P0PilotEvalSection {
  const report = evaluatePolicyAdherence(cases) satisfies PolicyAdherenceReport;
  const passed = cases.length > 0
    && report.policyViolationCount === 0
    && report.taskCompletion >= 0.95
    && report.toolArgumentCorrectness >= 0.95
    && report.handoffCorrectness >= 0.95;
  return {
    caseCount: cases.length,
    passRate: round(average([
      report.taskCompletion,
      report.toolArgumentCorrectness,
      report.handoffCorrectness,
      report.policyViolationCount === 0 ? 1 : 0,
    ])),
    passed,
    details: {
      taskCompletion: report.taskCompletion,
      policyViolationCount: report.policyViolationCount,
      toolArgumentCorrectness: report.toolArgumentCorrectness,
      handoffCorrectness: report.handoffCorrectness,
      blockers: report.blockers,
    },
  };
}

function buildRedTeamSection(cases: readonly P0PilotRedTeamCaseResult[]): P0PilotRedTeamSection {
  const criticalEscapedCount = cases.filter((entry) => entry.severity === "critical" && entry.outcome === "escaped").length;
  const escapedCount = cases.filter((entry) => entry.outcome === "escaped").length;
  const blockedCount = cases.filter((entry) => entry.outcome === "blocked").length;
  const mitigatedCount = cases.filter((entry) => entry.outcome === "mitigated").length;
  return {
    caseCount: cases.length,
    criticalEscapedCount,
    escapedCount,
    blockedCount,
    mitigatedCount,
    passed: cases.length > 0 && criticalEscapedCount === 0 && escapedCount === 0,
  };
}

function loadMinimumSampleSize(platformRoot: string, divisionId: P0PilotDivisionId): number {
  const roiConfig = readYamlObject(join(platformRoot, "roi", "divisions", `${divisionId}.yaml`));
  return toFiniteNumber(roiConfig.minimumSampleSize, 1);
}

function buildRoiSection(samples: readonly P0PilotRoiSample[], minimumSampleSize: number): P0PilotRoiSection {
  const timeSaved = samples.map((entry) => entry.baselineDurationMinutes - entry.assistedDurationMinutes);
  const costDelta = samples.map((entry) => entry.assistedCostUsd - entry.baselineCostUsd);
  const qualityDelta = samples.map((entry) => entry.assistedQualityScore - entry.baselineQualityScore);
  const riskDelta = samples.map((entry) => entry.assistedRiskScore - entry.baselineRiskScore);
  const averageTimeSavedMinutes = average(timeSaved);
  const averageCostDeltaUsd = average(costDelta);
  const averageQualityDelta = average(qualityDelta);
  const averageRiskDelta = average(riskDelta);
  const confidence = inferRoiConfidence(samples.length, minimumSampleSize);
  return {
    sampleCount: samples.length,
    minimumSampleSize,
    confidence,
    averageTimeSavedMinutes: round(averageTimeSavedMinutes),
    averageCostDeltaUsd: round(averageCostDeltaUsd),
    averageQualityDelta: round(averageQualityDelta),
    averageRiskDelta: round(averageRiskDelta),
    passed: samples.length >= minimumSampleSize
      && averageTimeSavedMinutes > 0
      && averageQualityDelta >= 0
      && averageRiskDelta <= 0,
  };
}

function buildBenchmarkSection(
  family: FamilyLeadershipReadiness,
  comparisons: readonly P0PilotBenchmarkComparisonResult[],
): P0PilotBenchmarkSection {
  const validBenchmarkIds = new Set(family.benchmarks.map((entry) => entry.benchmarkId));
  const validMetricIds = new Set(family.internalMappings.map((entry) => entry.metricId));
  const validationErrors: string[] = [];
  const results = comparisons.map((entry) => {
    if (!validBenchmarkIds.has(entry.benchmarkId)) {
      validationErrors.push(`unknown_benchmark:${entry.benchmarkId}`);
    }
    if (!validMetricIds.has(entry.metricId)) {
      validationErrors.push(`unknown_metric:${entry.metricId}`);
    }
    const passed = compareBenchmark(entry.comparison, entry.internalValue, entry.externalBaselineValue);
    return {
      benchmarkId: entry.benchmarkId,
      metricId: entry.metricId,
      comparison: entry.comparison,
      internalValue: entry.internalValue,
      externalBaselineValue: entry.externalBaselineValue,
      passed,
      delta: round(entry.internalValue - entry.externalBaselineValue),
    } satisfies P0PilotBenchmarkCheckResult;
  });
  const passedComparisonCount = results.filter((entry) => entry.passed).length;
  return {
    comparisonCount: results.length,
    passedComparisonCount,
    passed: results.length > 0 && validationErrors.length === 0 && passedComparisonCount === results.length,
    validationErrors,
    comparisons: results,
  };
}

function buildObservationSection(input: P0PilotObservationInput): P0PilotObservationSection {
  return {
    totalObservationCount: input.observations.length,
    completedObservationCount: input.observations.filter((entry) => entry.status === "completed").length,
    humanApprovedObservationCount: input.observations.filter((entry) => entry.humanApproved === true).length,
    evidenceLinkedObservationCount: input.observations.filter((entry) => entry.evidenceLinked === true).length,
    metadata: input.metadata ?? {},
  };
}

function deriveVerdict(input: {
  readonly evalPassed: boolean;
  readonly redTeamPassed: boolean;
  readonly roiPassed: boolean;
  readonly benchmarkPassed: boolean;
  readonly thresholds: P0PilotThresholdSection;
}): P0PilotEvidenceVerdict {
  const allComponentsPassed = input.evalPassed && input.redTeamPassed && input.roiPassed && input.benchmarkPassed;
  if (allComponentsPassed && input.thresholds.leadershipPassed) {
    return "leadership_ready";
  }
  if (allComponentsPassed && input.thresholds.mvpPassed) {
    return "mvp_ready";
  }
  return "insufficient_evidence";
}

function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function writeJson(path: string, value: unknown): void {
  ensureParentDir(path);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildMarkdownSummary(report: P0PilotEvidencePackage): string {
  const lines = [
    `# ${report.familyDisplayName} / ${report.divisionId} P0 Pilot Evidence`,
    "",
    `- Generated At: ${report.generatedAt}`,
    `- Family: ${report.familyId}`,
    `- Readiness Status: ${report.readinessStatus}`,
    `- Target Claim Level: ${report.targetClaimLevel}`,
    `- Verdict: ${report.verdict.status}`,
    "",
    "## Components",
    `- Eval: ${report.eval.passed ? "pass" : "fail"} (${report.eval.caseCount} cases, pass rate ${report.eval.passRate})`,
    `- Red-Team: ${report.redTeam.passed ? "pass" : "fail"} (${report.redTeam.caseCount} cases, escaped ${report.redTeam.escapedCount})`,
    `- ROI: ${report.roi.passed ? "pass" : "fail"} (${report.roi.sampleCount} samples, confidence ${report.roi.confidence})`,
    `- Benchmark: ${report.benchmark.passed ? "pass" : "fail"} (${report.benchmark.passedComparisonCount}/${report.benchmark.comparisonCount})`,
    "",
    "## Thresholds",
    `- MVP: ${report.thresholds.mvpPassed ? "pass" : "fail"}`,
    ...report.thresholds.mvp.map((entry) => `  - ${entry.label}: ${String(entry.observed)} vs ${entry.requirement} => ${entry.status}`),
    `- Leadership: ${report.thresholds.leadershipPassed ? "pass" : "fail"}`,
    ...report.thresholds.leadership.map((entry) => `  - ${entry.label}: ${String(entry.observed)} vs ${entry.requirement} => ${entry.status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function resolveFamily(
  registry: LeadershipClaimConfigRegistry,
  divisionId: P0PilotDivisionId,
): FamilyLeadershipReadiness {
  const expectedFamilyId = FAMILY_BY_DIVISION[divisionId];
  const family = registry.listFamilyReadiness().find((entry) => entry.familyId === expectedFamilyId);
  if (family == null) {
    throw new Error(`pilot_evidence.family_missing:${divisionId}`);
  }
  return family;
}

export function buildP0PilotEvidencePackage(
  divisionId: P0PilotDivisionId,
  options: P0PilotEvidenceRunnerOptions = {},
): P0PilotEvidencePackage {
  const platformRoot = resolvePlatformRoot(options.platformRoot);
  const configRoot = options.configRoot ?? join(platformRoot, "config", "division-coverage");
  const inputRoot = options.inputRoot ?? join(platformRoot, ...DEFAULT_INPUT_ROOT_SEGMENTS);
  const now = options.now ?? new Date();
  const registry = new LeadershipClaimConfigRegistry({ platformRoot, configRoot });
  const family = resolveFamily(registry, divisionId);
  const divisionInputRoot = join(inputRoot, divisionId);
  const evalCases = loadDivisionEvalCases(join(divisionInputRoot, "eval-cases.json"), divisionId);
  const redTeamCases = loadRedTeamCases(join(divisionInputRoot, "redteam-results.json"));
  const roiSamples = loadRoiSamples(join(divisionInputRoot, "roi-samples.json"));
  const benchmarkComparisons = loadBenchmarkComparisons(join(divisionInputRoot, "benchmark-results.json"));
  const pilotObservations = loadPilotObservations(join(divisionInputRoot, "pilot-observations.json"));

  const evalSection = divisionId === "coding"
    ? buildCodingEvalSection(evalCases as readonly CodingEvalCase[])
    : divisionId === "knowledge-base"
      ? buildKnowledgeEvalSection(evalCases as readonly KnowledgeEvalCase[], now)
      : buildCustomerServiceEvalSection(evalCases as readonly CustomerServiceEvalCase[]);
  const redTeamSection = buildRedTeamSection(redTeamCases);
  const roiSection = buildRoiSection(roiSamples, loadMinimumSampleSize(platformRoot, divisionId));
  const benchmarkSection = buildBenchmarkSection(family, benchmarkComparisons);
  const pilotSection = buildObservationSection(pilotObservations);
  const thresholds = buildThresholdChecks(family, {
    evalCaseCount: evalSection.caseCount,
    redTeamCaseCount: redTeamSection.caseCount,
    completedObservationCount: pilotSection.completedObservationCount,
    evidenceLinkedObservationCount: pilotSection.evidenceLinkedObservationCount,
    metadata: pilotSection.metadata,
  });
  const verdict = {
    status: deriveVerdict({
      evalPassed: evalSection.passed,
      redTeamPassed: redTeamSection.passed,
      roiPassed: roiSection.passed,
      benchmarkPassed: benchmarkSection.passed,
      thresholds,
    }),
    evalPassed: evalSection.passed,
    redTeamPassed: redTeamSection.passed,
    roiPassed: roiSection.passed,
    benchmarkPassed: benchmarkSection.passed,
  } as const;

  return {
    generatedAt: now.toISOString(),
    divisionId,
    familyId: family.familyId as P0PilotFamilyId,
    familyDisplayName: family.displayName,
    readinessStatus: family.readinessStatus,
    targetClaimLevel: family.targetClaimLevel,
    eval: evalSection,
    redTeam: redTeamSection,
    roi: roiSection,
    benchmark: benchmarkSection,
    pilot: pilotSection,
    thresholds,
    verdict,
  };
}

export function writeP0PilotEvidenceArtifacts(
  report: P0PilotEvidencePackage,
  options: P0PilotEvidenceRunnerOptions = {},
): P0PilotArtifactReport {
  const platformRoot = resolvePlatformRoot(options.platformRoot);
  const outputRoot = options.outputRoot ?? join(platformRoot, ...DEFAULT_OUTPUT_ROOT_SEGMENTS);
  const outputDir = join(outputRoot, report.divisionId);
  const jsonPath = join(outputDir, "evidence-package.json");
  const markdownPath = join(outputDir, "summary.md");
  writeJson(jsonPath, report);
  ensureParentDir(markdownPath);
  writeFileSync(markdownPath, buildMarkdownSummary(report), "utf8");
  return {
    divisionId: report.divisionId,
    familyId: report.familyId,
    status: report.verdict.status,
    outputDir,
    jsonPath,
    markdownPath,
    report,
  };
}

export function runAllP0PilotEvidence(options: P0PilotEvidenceRunnerOptions = {}): P0PilotAggregateReport {
  const divisions: readonly P0PilotDivisionId[] = ["coding", "knowledge-base", "customer-service"];
  const artifacts = divisions.map((divisionId) => writeP0PilotEvidenceArtifacts(
    buildP0PilotEvidencePackage(divisionId, options),
    options,
  ));
  const aggregate: P0PilotAggregateReport = {
    generatedAt: (options.now ?? new Date()).toISOString(),
    divisionCount: artifacts.length,
    summary: {
      leadershipReadyCount: artifacts.filter((entry) => entry.status === "leadership_ready").length,
      mvpReadyCount: artifacts.filter((entry) => entry.status === "mvp_ready").length,
      insufficientEvidenceCount: artifacts.filter((entry) => entry.status === "insufficient_evidence").length,
    },
    artifacts,
  };
  const platformRoot = resolvePlatformRoot(options.platformRoot);
  const outputRoot = options.outputRoot ?? join(platformRoot, ...DEFAULT_OUTPUT_ROOT_SEGMENTS);
  const aggregatePath = join(outputRoot, "p0-pilot-evidence-report.json");
  const markdownPath = join(outputRoot, "p0-pilot-evidence-summary.md");
  writeJson(aggregatePath, {
    ...aggregate,
    artifacts: aggregate.artifacts.map((entry) => ({
      divisionId: entry.divisionId,
      familyId: entry.familyId,
      status: entry.status,
      outputDir: relative(outputRoot, entry.outputDir) || ".",
      jsonPath: relative(outputRoot, entry.jsonPath),
      markdownPath: relative(outputRoot, entry.markdownPath),
    })),
  });
  writeFileSync(
    markdownPath,
    [
      "# P0 Pilot Evidence Summary",
      "",
      `- Generated At: ${aggregate.generatedAt}`,
      `- Division Count: ${aggregate.divisionCount}`,
      `- Leadership Ready: ${aggregate.summary.leadershipReadyCount}`,
      `- MVP Ready: ${aggregate.summary.mvpReadyCount}`,
      `- Insufficient Evidence: ${aggregate.summary.insufficientEvidenceCount}`,
      "",
      ...aggregate.artifacts.map((entry) => `- ${entry.divisionId}: ${entry.status}`),
      "",
    ].join("\n"),
    "utf8",
  );
  return aggregate;
}
