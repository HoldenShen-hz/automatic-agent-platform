/**
 * Enterprise Governance Service
 *
 * Provides comprehensive enterprise governance reporting that synthesizes
 * operations governance, incident handoffs, schema compatibility, supply chain
 * security, and APM export bundles into a single unified report.
 *
 * This is the top-level governance service for enterprise customers who need
 * a complete view of their deployment health, security posture, and compliance
 * status across all environments.
 *
 * The service produces reports that include:
 * - Operations governance status and SLO compliance
 * - Incident handoff packages for shift transitions
 * - Schema compatibility gates for database migrations
 * - Supply chain security scanning with CVE intelligence
 * - APM export bundles for Datadog, Grafana, and OpenTelemetry
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/admin_console_and_human_takeover_contract.md | Human Takeover Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { EnterpriseGovernanceReportRecord, IncidentHandoffRecord } from "../../contracts/types/domain.js";
import { OperationsGovernanceService } from "./operations-governance-service.js";
import { type EnterpriseGovernanceExportResult, type EnterpriseGovernanceInput, type EnterpriseGovernanceReport, type EnterpriseGovernanceRunResult, type EnterpriseGovernanceServiceOptions } from "./enterprise-governance-support.js";
export type { EnterpriseGovernanceStatus, IncidentHandoffStatus, SupplyChainFindingSeverity, EnterpriseGovernanceInput, EnterpriseGovernanceSchemaGateReport, SupplyChainSbomComponent, SupplyChainExtensionSummary, SupplyChainFinding, SupplyChainSecurityReport, ApmMetricSample, EnterpriseGovernanceApmExportBundle, IncidentHandoffPackage, EnterpriseGovernanceReport, EnterpriseGovernanceRunResult, EnterpriseGovernanceExportResult, EnterpriseGovernanceServiceOptions, } from "./enterprise-governance-support.js";
/**
 * EnterpriseGovernanceService produces comprehensive governance reports.
 * It aggregates data from multiple sources including OperationsGovernanceService,
 * IndustrialOpsProgramService, schema compatibility evaluators, and supply chain scanners.
 */
export declare class EnterpriseGovernanceService {
    private readonly governanceService;
    private readonly store;
    private readonly artifactStore;
    private readonly opsProgramService;
    private readonly cveIntelligence;
    constructor(governanceService: OperationsGovernanceService, store: AuthoritativeTaskStore, options?: EnterpriseGovernanceServiceOptions);
    /**
     * Builds a complete enterprise governance report.
     * Aggregates operations, schema, supply chain, and APM data.
     */
    buildReport(input: EnterpriseGovernanceInput): EnterpriseGovernanceReport;
    /**
     * Runs the report and persists records to the database.
     */
    runReport(input: EnterpriseGovernanceInput): EnterpriseGovernanceRunResult;
    /**
     * Exports the report to artifact storage and persists database records.
     */
    exportReport(input: EnterpriseGovernanceInput): EnterpriseGovernanceExportResult;
    /**
     * Lists historical enterprise governance reports.
     */
    listHistory(limit?: number): EnterpriseGovernanceReportRecord[];
    /**
     * Lists historical incident handoff records.
     */
    listIncidentHandoffs(limit?: number): IncidentHandoffRecord[];
    /**
     * Builds an incident handoff package from the operations program report.
     */
    private buildIncidentHandoffPackage;
    /**
     * Evaluates schema compatibility gates.
     * Checks both migration portability and breaking changes.
     */
    private buildSchemaGateReport;
    /**
     * Builds a supply chain security report by scanning package manifests and lockfiles.
     * Detects missing integrity metadata, non-HTTPS sources, prerelease versions,
     * license issues, and CVE vulnerabilities.
     */
    private buildSupplyChainReport;
    /**
     * Builds an APM export bundle with metrics in multiple provider formats.
     * Includes OpenTelemetry, Datadog, and Grafana formatted data.
     */
    private buildApmExport;
    /**
     * Converts an incident handoff package to a database record.
     */
    private toHandoffRecord;
    /**
     * Converts an enterprise governance report to a database record.
     */
    private toRecord;
    /**
     * Ensures a task exists for artifact storage, creating a system task if needed.
     */
    private ensureArtifactTask;
}
