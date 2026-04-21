/**
 * Compliance Program Service
 *
 * Provides compliance reporting capabilities including program residency summaries,
 * audit export readiness, and control verification. Aggregates tenant, workspace,
 * organization, and namespace data to produce compliance documentation artifacts.
 *
 * @see docs_zh/contracts/billing_contract.md for billing-related compliance requirements
 * @see docs_zh/architecture/00-platform-architecture.md for architecture context
 */
import { type ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { ArtifactRef } from "../../platform/contracts/types/domain.js";
/** Input options for building a compliance report */
export interface ComplianceProgramInput {
    /** Optional ISO timestamp to use as the report generation time */
    generatedAt?: string;
}
/** Summary of namespaces grouped by residency policy */
export interface ComplianceResidencySummary {
    /** The residency policy identifier */
    residencyPolicy: string;
    /** Number of namespaces using this residency policy */
    namespaceCount: number;
}
/** Complete compliance program report containing all compliance data */
export interface ComplianceProgramReport {
    /** Unique identifier for this report */
    reportId: string;
    /** ISO timestamp when the report was generated */
    generatedAt: string;
    /** Total number of tenants in scope */
    tenantCount: number;
    /** Total number of workspaces in scope */
    workspaceCount: number;
    /** Total number of organizations in scope */
    organizationCount: number;
    /** Total number of data namespaces in scope */
    namespaceCount: number;
    /** Namespace counts broken down by residency policy */
    residencySummary: ComplianceResidencySummary[];
    /** Whether audit export can be generated from current data */
    auditExportReady: boolean;
    /** List of compliance controls that must be verified */
    complianceControls: string[];
}
/** Result of exporting a compliance report, including artifact references */
export interface ComplianceProgramExportResult {
    /** The generated compliance report */
    report: ComplianceProgramReport;
    /** Reference to the JSON artifact containing the full report */
    jsonArtifact: ArtifactRef;
    /** Reference to the Markdown artifact containing the human-readable report */
    markdownArtifact: ArtifactRef;
}
/** Configuration options for the ComplianceProgramService */
export interface ComplianceProgramServiceOptions {
    /** Options for the artifact store used to persist reports */
    artifactStoreOptions?: ArtifactStoreOptions;
}
/**
 * Service for generating compliance program reports and exports.
 *
 * This service aggregates data from across the tenant platform to produce
 * compliance documentation that can be used for audit purposes. It verifies
 * that required compliance controls are in place and generates both JSON and
 * Markdown artifact exports.
 */
export declare class ComplianceProgramService {
    private readonly store;
    private readonly artifactStore;
    constructor(store: AuthoritativeTaskStore, options?: ComplianceProgramServiceOptions);
    /**
     * Builds a compliance program report from current system data.
     *
     * Collects counts of tenants, workspaces, organizations, and namespaces,
     * groups namespaces by residency policy, and determines audit export readiness
     * based on whether enterprise capability reports exist or namespaces are present.
     *
     * @param input - Optional generation timestamp and other settings
     * @returns A complete compliance program report
     */
    buildReport(input?: ComplianceProgramInput): ComplianceProgramReport;
    /**
     * Exports a compliance program report as both JSON and Markdown artifacts.
     *
     * Generates the report, persists it as a JSON artifact, and creates a
     * human-readable Markdown version. Both artifacts are stored in the
     * artifact store and references to them are returned.
     *
     * @param input - Optional generation timestamp and other settings
     * @returns The report plus references to the generated artifacts
     */
    exportReport(input?: ComplianceProgramInput): ComplianceProgramExportResult;
}
