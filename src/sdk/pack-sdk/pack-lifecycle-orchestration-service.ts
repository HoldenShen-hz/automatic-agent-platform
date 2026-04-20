import { ValidationError } from "../../platform/contracts/errors.js";
import {
  PackPluginCompatibilityService,
  type LicenseTier,
  type PackCompatibilityReport,
} from "./pack-plugin-compatibility-service.js";
import {
  validateBusinessPackManifest,
  type BusinessPackCapability,
  type BusinessPackManifest,
} from "./pack-manifest.js";

export type BusinessPackLifecycleStage =
  | "development"
  | "testing"
  | "certified"
  | "published"
  | "running"
  | "deprecated"
  | "archived";

export type PackApiChangeType = "initial" | "compatible" | "additive" | "breaking";
export type PackRolloutStrategy = "shadow" | "canary" | "ga";

export interface PackTestReport {
  coveragePercent: number;
  mockTestsPassed: boolean;
  stagingIntegrationPassed: boolean;
  evalPassed: boolean;
  reportRef: string;
  recordedAt: string;
  verdict: "passed" | "failed";
  findings: string[];
}

export interface PackCertificationRecord {
  reviewer: string;
  certificationReportRef: string;
  selectedLicenseTier: LicenseTier;
  pluginIds: string[];
  securityReviewPassed: boolean;
  riskReviewPassed: boolean;
  certifiedAt: string;
  compatibility: PackCompatibilityReport;
  verdict: "certified" | "blocked";
  findings: string[];
}

export interface PackRolloutRecord {
  rolloutId: string;
  strategy: PackRolloutStrategy;
  owner: string;
  rolloutScope: string[];
  createdAt: string;
  activatedAt: string | null;
  status: "ready" | "active" | "blocked";
  findings: string[];
}

export interface PackDeprecationRecord {
  owner: string;
  migrationGuideRef: string;
  effectiveAt: string;
  supportWindowDays: number;
  createdAt: string;
  status: "scheduled" | "active";
}

export interface PackLifecycleRecord {
  packId: string;
  version: string;
  owner: string;
  manifest: BusinessPackManifest;
  lifecycleStage: BusinessPackLifecycleStage;
  createdAt: string;
  updatedAt: string;
  evalDatasetIds: string[];
  apiChange: {
    changeType: PackApiChangeType;
    previousVersion: string | null;
    addedCapabilities: string[];
    removedCapabilities: string[];
    addedContracts: string[];
    removedContracts: string[];
    requiresDeprecationWarnings: boolean;
    deprecationWarningsSatisfied: boolean;
  };
  testing: PackTestReport | null;
  certification: PackCertificationRecord | null;
  rollout: PackRolloutRecord | null;
  deprecation: PackDeprecationRecord | null;
  findings: string[];
}

export interface RegisterBusinessPackInput {
  manifest: BusinessPackManifest;
  owner: string;
  evalDatasetIds?: readonly string[] | undefined;
  previousManifest?: BusinessPackManifest | null | undefined;
  declaredDeprecationWarnings?: number | undefined;
  createdAt?: string | undefined;
}

export interface RecordPackTestingInput {
  packId: string;
  version: string;
  coveragePercent: number;
  mockTestsPassed: boolean;
  stagingIntegrationPassed: boolean;
  evalPassed: boolean;
  reportRef: string;
  recordedAt?: string | undefined;
}

export interface CertifyBusinessPackInput {
  packId: string;
  version: string;
  reviewer: string;
  certificationReportRef: string;
  selectedLicenseTier: LicenseTier;
  pluginIds?: readonly string[] | undefined;
  securityReviewPassed: boolean;
  riskReviewPassed: boolean;
  certifiedAt?: string | undefined;
}

export interface PublishBusinessPackInput {
  packId: string;
  version: string;
  strategy: PackRolloutStrategy;
  owner: string;
  rolloutScope?: readonly string[] | undefined;
  autoActivate?: boolean | undefined;
  publishedAt?: string | undefined;
}

export interface DeprecateBusinessPackInput {
  packId: string;
  version: string;
  owner: string;
  migrationGuideRef: string;
  effectiveAt: string;
  supportWindowDays: number;
  deprecatedAt?: string | undefined;
}

export class PackLifecycleOrchestrationService {
  private readonly records = new Map<string, PackLifecycleRecord>();

  public constructor(
    private readonly compatibility: PackPluginCompatibilityService = new PackPluginCompatibilityService(),
  ) {}

  public registerPack(input: RegisterBusinessPackInput): PackLifecycleRecord {
    const manifest = validateBusinessPackManifest(input.manifest);
    const key = recordKey(manifest.packId, manifest.version);
    if (this.records.has(key)) {
      throw new ValidationError(
        `pack_lifecycle.already_registered:${manifest.packId}@${manifest.version}`,
        `Business pack ${manifest.packId}@${manifest.version} is already registered.`,
      );
    }

    const createdAt = normalizeTimestamp(input.createdAt);
    const apiChange = buildApiChangeSummary(
      input.previousManifest == null ? null : validateBusinessPackManifest(input.previousManifest),
      manifest,
      input.declaredDeprecationWarnings ?? 0,
    );
    const findings = [
      ...(input.evalDatasetIds == null || input.evalDatasetIds.length === 0 ? ["pack_lifecycle.eval_dataset_missing"] : []),
      ...(!apiChange.deprecationWarningsSatisfied ? ["pack_lifecycle.deprecation_warning_missing"] : []),
    ];
    const record: PackLifecycleRecord = {
      packId: manifest.packId,
      version: manifest.version,
      owner: input.owner.trim(),
      manifest,
      lifecycleStage: "development",
      createdAt,
      updatedAt: createdAt,
      evalDatasetIds: [...new Set((input.evalDatasetIds ?? []).map((item) => item.trim()).filter((item) => item.length > 0))],
      apiChange,
      testing: null,
      certification: null,
      rollout: null,
      deprecation: null,
      findings,
    };
    this.records.set(key, record);
    return cloneRecord(record);
  }

  public recordTesting(input: RecordPackTestingInput): PackLifecycleRecord {
    const record = this.getMutableRecord(input.packId, input.version);
    assertLifecycleStage(record, ["development", "testing"]);
    const findings = [
      ...(input.coveragePercent >= 80 ? [] : ["pack_lifecycle.coverage_below_threshold"]),
      ...(input.mockTestsPassed ? [] : ["pack_lifecycle.mock_tests_failed"]),
      ...(input.stagingIntegrationPassed ? [] : ["pack_lifecycle.staging_integration_failed"]),
      ...(input.evalPassed ? [] : ["pack_lifecycle.eval_gate_failed"]),
    ];
    record.testing = {
      coveragePercent: roundPercent(input.coveragePercent),
      mockTestsPassed: input.mockTestsPassed,
      stagingIntegrationPassed: input.stagingIntegrationPassed,
      evalPassed: input.evalPassed,
      reportRef: input.reportRef.trim(),
      recordedAt: normalizeTimestamp(input.recordedAt),
      verdict: findings.length === 0 ? "passed" : "failed",
      findings,
    };
    record.lifecycleStage = "testing";
    record.updatedAt = record.testing.recordedAt;
    record.findings = mergeFindings(record, findings);
    return cloneRecord(record);
  }

  public certifyPack(input: CertifyBusinessPackInput): PackLifecycleRecord {
    const record = this.getMutableRecord(input.packId, input.version);
    assertLifecycleStage(record, ["testing", "certified"]);
    if (record.testing?.verdict !== "passed") {
      throw new ValidationError(
        `pack_lifecycle.testing_not_passed:${record.packId}@${record.version}`,
        `Business pack ${record.packId}@${record.version} requires a passing test report before certification.`,
      );
    }

    const compatibility = this.compatibility.evaluateManifest({
      manifest: record.manifest,
      selectedLicenseTier: input.selectedLicenseTier,
      pluginIds: input.pluginIds,
    });
    const findings = [
      ...(input.securityReviewPassed ? [] : ["pack_lifecycle.security_review_failed"]),
      ...(input.riskReviewPassed ? [] : ["pack_lifecycle.risk_review_failed"]),
      ...(compatibility.verdict === "compatible" ? [] : compatibility.verdict === "license_blocked"
        ? ["pack_lifecycle.license_blocked"]
        : ["pack_lifecycle.compatibility_blocked"]),
      ...compatibility.missingPluginCapabilities.map((capabilityKey) => `pack_lifecycle.missing_plugin:${capabilityKey}`),
      ...compatibility.blockedByLicense.map((capabilityKey) => `pack_lifecycle.license_capability:${capabilityKey}`),
    ];
    const certifiedAt = normalizeTimestamp(input.certifiedAt);
    record.certification = {
      reviewer: input.reviewer.trim(),
      certificationReportRef: input.certificationReportRef.trim(),
      selectedLicenseTier: input.selectedLicenseTier,
      pluginIds: compatibility.selectedPlugins.map((plugin) => plugin.pluginId),
      securityReviewPassed: input.securityReviewPassed,
      riskReviewPassed: input.riskReviewPassed,
      certifiedAt,
      compatibility,
      verdict: findings.length === 0 ? "certified" : "blocked",
      findings,
    };
    record.lifecycleStage = findings.length === 0 ? "certified" : "testing";
    record.updatedAt = certifiedAt;
    record.findings = mergeFindings(record, findings);
    return cloneRecord(record);
  }

  public publishPack(input: PublishBusinessPackInput): PackLifecycleRecord {
    const record = this.getMutableRecord(input.packId, input.version);
    assertLifecycleStage(record, ["certified", "published", "running"]);
    if (record.certification?.verdict !== "certified") {
      throw new ValidationError(
        `pack_lifecycle.not_certified:${record.packId}@${record.version}`,
        `Business pack ${record.packId}@${record.version} must be certified before publication.`,
      );
    }

    const findings = [
      ...(input.strategy === "ga" && record.apiChange.changeType === "breaking" && record.deprecation == null
        ? ["pack_lifecycle.ga_requires_deprecation_notice"]
        : []),
    ];
    const publishedAt = normalizeTimestamp(input.publishedAt);
    record.rollout = {
      rolloutId: buildRolloutId(record.packId, record.version),
      strategy: input.strategy,
      owner: input.owner.trim(),
      rolloutScope: [...new Set((input.rolloutScope ?? ["marketplace_public"]).map((item) => item.trim()).filter((item) => item.length > 0))],
      createdAt: publishedAt,
      activatedAt: findings.length === 0 && input.autoActivate === true ? publishedAt : null,
      status: findings.length > 0 ? "blocked" : input.autoActivate === true ? "active" : "ready",
      findings,
    };
    record.lifecycleStage = record.rollout.status === "active" ? "running" : findings.length > 0 ? "certified" : "published";
    record.updatedAt = publishedAt;
    record.findings = mergeFindings(record, findings);
    return cloneRecord(record);
  }

  public deprecatePack(input: DeprecateBusinessPackInput): PackLifecycleRecord {
    const record = this.getMutableRecord(input.packId, input.version);
    assertLifecycleStage(record, ["certified", "published", "running", "deprecated"]);
    if (input.supportWindowDays < 180) {
      throw new ValidationError(
        `pack_lifecycle.support_window_too_short:${record.packId}@${record.version}`,
        `Business pack ${record.packId}@${record.version} must provide at least 180 days of support during deprecation.`,
      );
    }

    const deprecatedAt = normalizeTimestamp(input.deprecatedAt);
    const effectiveAt = normalizeTimestamp(input.effectiveAt);
    record.deprecation = {
      owner: input.owner.trim(),
      migrationGuideRef: input.migrationGuideRef.trim(),
      effectiveAt,
      supportWindowDays: input.supportWindowDays,
      createdAt: deprecatedAt,
      status: new Date(effectiveAt).getTime() <= new Date(deprecatedAt).getTime() ? "active" : "scheduled",
    };
    record.lifecycleStage = "deprecated";
    record.updatedAt = deprecatedAt;
    record.findings = mergeFindings(record, []);
    return cloneRecord(record);
  }

  public archivePack(packId: string, version: string): PackLifecycleRecord {
    const record = this.getMutableRecord(packId, version);
    if (record.lifecycleStage !== "deprecated") {
      throw new ValidationError(
        `pack_lifecycle.archive_requires_deprecated:${record.packId}@${record.version}`,
        `Business pack ${record.packId}@${record.version} can only be archived from deprecated state.`,
      );
    }
    record.lifecycleStage = "archived";
    record.updatedAt = normalizeTimestamp();
    return cloneRecord(record);
  }

  public getPack(packId: string, version: string): PackLifecycleRecord | null {
    const record = this.records.get(recordKey(packId, version));
    return record == null ? null : cloneRecord(record);
  }

  public listPacks(): PackLifecycleRecord[] {
    return [...this.records.values()]
      .map((record) => cloneRecord(record))
      .sort((left, right) => left.packId.localeCompare(right.packId) || left.version.localeCompare(right.version));
  }

  private getMutableRecord(packId: string, version: string): PackLifecycleRecord {
    const record = this.records.get(recordKey(packId, version));
    if (record == null) {
      throw new ValidationError(
        `pack_lifecycle.not_found:${packId}@${version}`,
        `Business pack ${packId}@${version} was not found.`,
      );
    }
    return record;
  }
}

function buildApiChangeSummary(
  previousManifest: BusinessPackManifest | null,
  candidateManifest: BusinessPackManifest,
  declaredDeprecationWarnings: number,
): PackLifecycleRecord["apiChange"] {
  if (previousManifest == null) {
    return {
      changeType: "initial",
      previousVersion: null,
      addedCapabilities: candidateManifest.capabilities.map((capability) => capability.capabilityKey).sort(),
      removedCapabilities: [],
      addedContracts: uniqueContracts(candidateManifest.capabilities),
      removedContracts: [],
      requiresDeprecationWarnings: false,
      deprecationWarningsSatisfied: true,
    };
  }

  const previousCapabilities = new Map(previousManifest.capabilities.map((capability) => [capability.capabilityKey, capability]));
  const candidateCapabilities = new Map(candidateManifest.capabilities.map((capability) => [capability.capabilityKey, capability]));
  const addedCapabilities = [...candidateCapabilities.keys()].filter((capability) => !previousCapabilities.has(capability)).sort();
  const removedCapabilities = [...previousCapabilities.keys()].filter((capability) => !candidateCapabilities.has(capability)).sort();
  const addedContracts = uniqueContracts(candidateManifest.capabilities).filter((contract) => !uniqueContracts(previousManifest.capabilities).includes(contract));
  const removedContracts = uniqueContracts(previousManifest.capabilities).filter((contract) => !uniqueContracts(candidateManifest.capabilities).includes(contract));

  let changeType: PackApiChangeType = "compatible";
  if (
    previousManifest.domain !== candidateManifest.domain
    || previousManifest.owner !== candidateManifest.owner
    || removedCapabilities.length > 0
    || removedContracts.length > 0
    || hasContractTightening(previousManifest.capabilities, candidateManifest.capabilities)
  ) {
    changeType = "breaking";
  } else if (addedCapabilities.length > 0 || addedContracts.length > 0) {
    changeType = "additive";
  }

  const previousVersion = parseSemver(previousManifest.version);
  const candidateVersion = parseSemver(candidateManifest.version);
  const requiresDeprecationWarnings = changeType === "breaking";
  const deprecationWarningsSatisfied = !requiresDeprecationWarnings
    || (candidateVersion.major > previousVersion.major && declaredDeprecationWarnings >= 2);

  return {
    changeType,
    previousVersion: previousManifest.version,
    addedCapabilities,
    removedCapabilities,
    addedContracts: addedContracts.sort(),
    removedContracts: removedContracts.sort(),
    requiresDeprecationWarnings,
    deprecationWarningsSatisfied,
  };
}

function hasContractTightening(
  previousCapabilities: readonly BusinessPackCapability[],
  candidateCapabilities: readonly BusinessPackCapability[],
): boolean {
  const previous = new Map(previousCapabilities.map((capability) => [capability.capabilityKey, capability.requiredContracts.slice().sort().join("|")]));
  for (const candidate of candidateCapabilities) {
    const previousContracts = previous.get(candidate.capabilityKey);
    if (previousContracts == null) {
      continue;
    }
    if (previousContracts !== candidate.requiredContracts.slice().sort().join("|")) {
      return true;
    }
  }
  return false;
}

function uniqueContracts(capabilities: readonly BusinessPackCapability[]): string[] {
  return [...new Set(capabilities.flatMap((capability) => capability.requiredContracts))].sort();
}

function parseSemver(version: string): { major: number; minor: number; patch: number } {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    throw new ValidationError(`pack_lifecycle.invalid_version:${version}`, `Business pack version ${version} must use semver.`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function assertLifecycleStage(record: PackLifecycleRecord, expected: readonly BusinessPackLifecycleStage[]): void {
  if (!expected.includes(record.lifecycleStage)) {
    throw new ValidationError(
      `pack_lifecycle.invalid_transition:${record.packId}@${record.version}`,
      `Business pack ${record.packId}@${record.version} in stage ${record.lifecycleStage} cannot perform this transition.`,
    );
  }
}

function normalizeTimestamp(value?: string | undefined): string {
  return new Date(value ?? Date.now()).toISOString();
}

function roundPercent(value: number): number {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function buildRolloutId(packId: string, version: string): string {
  return `pack_rollout:${packId}:${version}`;
}

function mergeFindings(record: PackLifecycleRecord, findings: readonly string[]): string[] {
  return [...new Set([
    ...record.findings.filter((finding) =>
      !finding.startsWith("pack_lifecycle.coverage_")
      && !finding.startsWith("pack_lifecycle.mock_tests_")
      && !finding.startsWith("pack_lifecycle.staging_integration_")
      && !finding.startsWith("pack_lifecycle.eval_gate_")
      && !finding.startsWith("pack_lifecycle.security_review_")
      && !finding.startsWith("pack_lifecycle.risk_review_")
      && !finding.startsWith("pack_lifecycle.compatibility_")
      && !finding.startsWith("pack_lifecycle.missing_plugin:")
      && !finding.startsWith("pack_lifecycle.license_")
      && !finding.startsWith("pack_lifecycle.ga_requires_")
    ),
    ...findings,
  ])].sort();
}

function recordKey(packId: string, version: string): string {
  return `${packId}@${version}`;
}

function cloneRecord(record: PackLifecycleRecord): PackLifecycleRecord {
  return JSON.parse(JSON.stringify(record)) as PackLifecycleRecord;
}
