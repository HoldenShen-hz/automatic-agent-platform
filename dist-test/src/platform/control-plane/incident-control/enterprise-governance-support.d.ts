import type { ArtifactStoreOptions } from "../../state-evidence/artifacts/artifact-store.js";
import type { ArtifactRef, EnterpriseGovernanceReportRecord, EnvironmentName, IncidentHandoffRecord } from "../../contracts/types/domain.js";
import type { CveIntelligenceService, CveMatchResult } from "../iam/cve-intelligence-service.js";
import type { IndustrialOpsProgramReport } from "./industrial-ops-program-service.js";
import type { OperationsGovernanceReport, RunbookSeverity } from "./operations-governance-service.js";
import type { SqliteMigrationCompatibilityReport } from "../../state-evidence/truth/sqlite/sqlite-migration-compatibility.js";
import type { SqliteSchemaCompatibilityReport } from "../../state-evidence/truth/sqlite/sqlite-schema-compatibility-gate.js";
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
    findingId: "dependency_missing_integrity" | "dependency_non_https_source" | "dependency_prerelease_version" | "dependency_license_missing" | "dependency_manifest_unpinned_source" | "extension_signature_missing" | "extension_review_required" | "extension_low_trust_level" | "cve_vulnerability_found";
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
export declare function sha256(value: string): string;
export declare function readJsonFile<T>(filePath: string): T;
export declare function extractPackageName(packagePath: string): string;
export declare function detectSourceType(resolvedValue: string | undefined): SupplyChainSbomComponent["sourceType"];
export declare function isPrereleaseVersion(version: string): boolean;
export declare function summarizeVerdict(hasCritical: boolean, hasWarning: boolean): EnterpriseGovernanceStatus;
export declare function mapOpsStatusToHandoffStatus(status: IndustrialOpsProgramReport["status"]): IncidentHandoffStatus;
export declare function selectSloActualValue(report: OperationsGovernanceReport, key: string): number;
export declare function buildMarkdownReport(report: EnterpriseGovernanceReport): string;
