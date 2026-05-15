import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { ArtifactStoreOptions } from "../../five-plane-state-evidence/artifacts/artifact-store.js";
import type {
  ArtifactRef,
  EnterpriseGovernanceReportRecord,
  EnvironmentName,
  IncidentHandoffRecord,
} from "../../contracts/types/domain.js";
import type {
  CveIntelligenceService,
  CveMatchResult,
} from "../iam/cve-intelligence-service.js";
import type { IndustrialOpsProgramReport } from "./industrial-ops-program-service.js";
import type { OperationsGovernanceReport, RunbookSeverity } from "./operations-governance-service.js";
import type {
  SqliteMigrationCompatibilityReport,
} from "../../five-plane-state-evidence/truth/sqlite/sqlite-migration-compatibility.js";
import type {
  SqliteSchemaCompatibilityReport,
} from "../../five-plane-state-evidence/truth/sqlite/sqlite-schema-compatibility-gate.js";

export type EnterpriseGovernanceStatus = "pass" | "warning" | "fail";
export type IncidentHandoffStatus = "ready" | "warning" | "blocked";
export type SupplyChainFindingSeverity = "warning" | "critical";

export interface EnterpriseGovernanceInput {
  environment: EnvironmentName;
  generatedAt?: string;
  taskId?: string;
  shiftOwner?: string;
  dependencyManifestPath?: string;
  dependencyLockfilePath?: string;
}

export interface EnterpriseGovernanceSchemaGateReport {
  checkedAt: string;
  verdict: "pass" | "fail";
  portability: SqliteMigrationCompatibilityReport;
  schemaCompatibility: SqliteSchemaCompatibilityReport;
}

export interface SupplyChainSbomComponent {
  packageName: string;
  packagePath: string;
  version: string;
  direct: boolean;
  dev: boolean;
  license: string | null;
  integrity: string | null;
  resolved: string | null;
  sourceType: "registry" | "file" | "workspace" | "other";
}

export interface SupplyChainExtensionSummary {
  packageId: string;
  extensionId: string;
  packageType: string;
  trustLevel: string;
  lifecycleState: string;
  signatureVerified: boolean;
  reviewRequired: boolean;
}

export interface SupplyChainFinding {
  findingId:
    | "dependency_missing_integrity"
    | "dependency_non_https_source"
    | "dependency_prerelease_version"
    | "dependency_license_missing"
    | "dependency_manifest_unpinned_source"
    | "extension_signature_missing"
    | "extension_review_required"
    | "extension_low_trust_level"
    | "cve_vulnerability_found";
  severity: SupplyChainFindingSeverity;
  packageName: string | null;
  packagePath: string | null;
  detail: string;
  cveId?: string;
  cvssScore?: number | null;
}

export interface SupplyChainSecurityReport {
  scannedAt: string;
  verdict: EnterpriseGovernanceStatus;
  sbomFormat: "npm-package-lock-v3";
  manifestPath: string;
  lockfilePath: string;
  manifestSha256: string;
  lockfileSha256: string;
  directDependencyCount: number;
  packageCount: number;
  extensionPackageCount: number;
  summary: {
    criticalFindingCount: number;
    warningFindingCount: number;
    unsignedExtensionCount: number;
    reviewRequiredExtensionCount: number;
    nonInternalExtensionCount: number;
    cveCriticalCount: number;
    cveHighCount: number;
    cveMediumCount: number;
    cveLowCount: number;
    cveMatchedPackageCount: number;
  };
  components: SupplyChainSbomComponent[];
  extensions: SupplyChainExtensionSummary[];
  findings: SupplyChainFinding[];
  cveReport?: {
    totalCves: number;
    matchedCves: number;
    matches: CveMatchResult[];
  };
}

export interface ApmMetricSample {
  metric: string;
  unit: "count" | "percent" | "milliseconds" | "usd";
  type: "gauge";
  value: number;
  tags: string[];
}

export interface EnterpriseGovernanceApmExportBundle {
  generatedAt: string;
  environment: EnvironmentName;
  otel: {
    resourceAttributes: Record<string, string>;
    metricSamples: ApmMetricSample[];
    incidentEvents: Array<{
      name: string;
      timestamp: string;
      attributes: Record<string, string>;
    }>;
  };
  datadog: {
    series: Array<{
      metric: string;
      type: "gauge";
      points: Array<[number, number]>;
      tags: string[];
      unit: ApmMetricSample["unit"];
    }>;
    events: Array<{
      title: string;
      text: string;
      alertType: "info" | "warning" | "error";
      tags: string[];
    }>;
  };
  grafana: {
    dashboard: {
      uid: string;
      title: string;
      tags: string[];
      panels: Array<{
        id: number;
        title: string;
        metric: string;
        unit: ApmMetricSample["unit"];
        threshold: number | null;
      }>;
    };
    annotations: Array<{
      text: string;
      time: number;
      tags: string[];
    }>;
  };
}

export interface IncidentHandoffPackage {
  handoffId: string;
  createdAt: string;
  environment: EnvironmentName;
  status: IncidentHandoffStatus;
  shiftOwner: string;
  primaryOncall: string;
  secondaryOncall: string;
  activeIncidentId: string | null;
  incidentSeverity: RunbookSeverity | null;
  failingSloKeys: string[];
  warningSloKeys: string[];
  recommendedRunbooks: string[];
  recommendedCommands: string[];
  checklist: string[];
  summaryNotes: string[];
  timelineMarkdown: string | null;
}

export interface EnterpriseGovernanceReport {
  reportId: string;
  generatedAt: string;
  environment: EnvironmentName;
  taskId: string | null;
  shiftOwner: string;
  status: EnterpriseGovernanceStatus;
  summary: {
    overallStatus: EnterpriseGovernanceStatus;
    failingSloCount: number;
    schemaVerdict: EnterpriseGovernanceSchemaGateReport["verdict"];
    supplyChainVerdict: SupplyChainSecurityReport["verdict"];
    incidentHandoffStatus: IncidentHandoffStatus;
    datadogSeriesCount: number;
    grafanaPanelCount: number;
  };
  governanceReport: OperationsGovernanceReport;
  opsProgram: IndustrialOpsProgramReport;
  incidentHandoff: IncidentHandoffPackage;
  schemaGate: EnterpriseGovernanceSchemaGateReport;
  supplyChain: SupplyChainSecurityReport;
  apmExport: EnterpriseGovernanceApmExportBundle;
}

export interface EnterpriseGovernanceRunResult {
  report: EnterpriseGovernanceReport;
  record: EnterpriseGovernanceReportRecord;
  handoffRecord: IncidentHandoffRecord;
}

export interface EnterpriseGovernanceExportResult extends EnterpriseGovernanceRunResult {
  jsonArtifact: ArtifactRef;
  markdownArtifact: ArtifactRef;
}

export interface EnterpriseGovernanceServiceOptions {
  artifactStoreOptions?: ArtifactStoreOptions;
  cveIntelligence?: CveIntelligenceService | null;
}

export interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export interface PackageLockPackage {
  version?: string;
  resolved?: string;
  integrity?: string;
  dev?: boolean;
  license?: string;
}

export interface PackageLockDocument {
  lockfileVersion: number;
  packages?: Record<string, PackageLockPackage>;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function extractPackageName(packagePath: string): string {
  const segments = packagePath.split("node_modules/").filter((segment) => segment.length > 0);
  return segments.at(-1) ?? packagePath;
}

export function detectSourceType(resolvedValue: string | undefined): SupplyChainSbomComponent["sourceType"] {
  if (resolvedValue == null || resolvedValue.length === 0) {
    return "workspace";
  }
  if (resolvedValue.startsWith("https://")) {
    return "registry";
  }
  if (resolvedValue.startsWith("file:")) {
    return "file";
  }
  return "other";
}

export function isPrereleaseVersion(version: string): boolean {
  return /-(?:alpha|beta|rc|canary|next|preview)/i.test(version);
}

export function summarizeVerdict(hasCritical: boolean, hasWarning: boolean): EnterpriseGovernanceStatus {
  if (hasCritical) return "fail";
  if (hasWarning) return "warning";
  return "pass";
}

export function mapOpsStatusToHandoffStatus(status: IndustrialOpsProgramReport["status"]): IncidentHandoffStatus {
  if (status === "fail") return "blocked";
  if (status === "warning") return "warning";
  return "ready";
}

export function selectSloActualValue(report: OperationsGovernanceReport, key: string): number {
  return report.slos.find((item) => item.key === key)?.actualValue ?? 0;
}

export function buildMarkdownReport(report: EnterpriseGovernanceReport): string {
  return [
    "# Enterprise Governance Report",
    "",
    `- Report ID: \`${report.reportId}\``,
    `- Environment: \`${report.environment}\``,
    `- Shift Owner: \`${report.shiftOwner}\``,
    `- Overall Status: \`${report.status}\``,
    `- Incident Handoff Status: \`${report.incidentHandoff.status}\``,
    `- Schema Gate: \`${report.schemaGate.verdict}\``,
    `- Supply Chain: \`${report.supplyChain.verdict}\``,
    "",
    "## Incident Handoff",
    "",
    `- Active Incident: \`${report.incidentHandoff.activeIncidentId ?? "none"}\``,
    `- Primary Oncall: \`${report.incidentHandoff.primaryOncall}\``,
    `- Secondary Oncall: \`${report.incidentHandoff.secondaryOncall}\``,
    ...(report.incidentHandoff.checklist.length > 0
      ? report.incidentHandoff.checklist.map((item) => `- ${item}`)
      : ["- no checklist items"]),
    "",
    "## Schema Compatibility Gate",
    "",
    `- Portability issues: \`${report.schemaGate.portability.issueCount}\``,
    `- Breaking compatibility issues: \`${report.schemaGate.schemaCompatibility.issueCount}\``,
    "",
    "## Supply Chain",
    "",
    `- Package count: \`${report.supplyChain.packageCount}\``,
    `- Critical findings: \`${report.supplyChain.summary.criticalFindingCount}\``,
    `- Warning findings: \`${report.supplyChain.summary.warningFindingCount}\``,
    "",
    "## APM Export",
    "",
    `- Datadog series: \`${report.apmExport.datadog.series.length}\``,
    `- Grafana panels: \`${report.apmExport.grafana.dashboard.panels.length}\``,
    `- OTel metric samples: \`${report.apmExport.otel.metricSamples.length}\``,
  ].join("\n");
}
