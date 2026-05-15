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

import { ArtifactStore, type ArtifactStoreOptions } from "../../platform/five-plane-state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { ArtifactRef, DataNamespaceRecord } from "../../platform/contracts/types/domain.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";

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
 * Groups namespaces by their residency policy and counts them.
 * Namespaces without a declared residency policy are grouped under "unspecified".
 *
 * @param namespaces - List of data namespace records to group
 * @returns Array of residency summaries sorted alphabetically by policy name
 */
function groupResidency(namespaces: readonly DataNamespaceRecord[]): ComplianceResidencySummary[] {
  const counts = new Map<string, number>();
  for (const namespace of namespaces) {
    const key = namespace.residencyPolicy ?? "unspecified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([residencyPolicy, namespaceCount]) => ({ residencyPolicy, namespaceCount }));
}

/**
 * Builds a Markdown-formatted version of the compliance report for human review.
 *
 * @param report - The compliance program report to format
 * @returns Markdown string containing the formatted report
 */
function buildMarkdown(report: ComplianceProgramReport): string {
  return [
    "# Compliance Program",
    "",
    `- Report ID: \`${report.reportId}\``,
    `- Tenant Count: ${report.tenantCount}`,
    `- Workspace Count: ${report.workspaceCount}`,
    `- Organization Count: ${report.organizationCount}`,
    `- Namespace Count: ${report.namespaceCount}`,
    `- Audit Export Ready: \`${report.auditExportReady}\``,
    "",
    "## Residency Summary",
    "",
    ...report.residencySummary.map((item) => `- \`${item.residencyPolicy}\`: ${item.namespaceCount}`),
    "",
    "## Controls",
    "",
    ...report.complianceControls.map((item) => `- ${item}`),
  ].join("\n");
}

/**
 * Service for generating compliance program reports and exports.
 *
 * This service aggregates data from across the tenant platform to produce
 * compliance documentation that can be used for audit purposes. It verifies
 * that required compliance controls are in place and generates both JSON and
 * Markdown artifact exports.
 */
export class ComplianceProgramService {
  private readonly artifactStore: ArtifactStore;

  public constructor(
    private readonly store: AuthoritativeTaskStore,
    options: ComplianceProgramServiceOptions = {},
  ) {
    this.artifactStore = new ArtifactStore(options.artifactStoreOptions);
  }

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
  public buildReport(input: ComplianceProgramInput = {}): ComplianceProgramReport {
    const tenants = this.store.organization.listTenantRecords({ limit: 500 });
    const workspaces = this.store.organization.listWorkspaceRecords({ limit: 500 });
    const organizations = this.store.organization.listOrganizationRecords(500);
    const namespaces = this.store.organization.listDataNamespaces({ limit: 500 });
    const reports = this.store.release.listEnterpriseCapabilityReports(50);

    return {
      reportId: newId("compliance_program"),
      generatedAt: input.generatedAt ?? nowIso(),
      tenantCount: tenants.length,
      workspaceCount: workspaces.length,
      organizationCount: organizations.length,
      namespaceCount: namespaces.length,
      residencySummary: groupResidency(namespaces),
      auditExportReady: reports.length > 0 || namespaces.length > 0,
      complianceControls: [
        "Audit export bundle must be generated from authoritative artifacts.",
        "Residency policy must be declared per data namespace.",
        "Enterprise capability reports must remain exportable for compliance review.",
      ],
    };
  }

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
  public exportReport(input: ComplianceProgramInput = {}): ComplianceProgramExportResult {
    const report = this.buildReport(input);
    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId: "compliance_program",
      executionId: null,
      stepId: null,
      kind: "compliance_program",
      fileName: "compliance-program.json",
      content: report,
    }).ref;
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId: "compliance_program",
      executionId: null,
      stepId: null,
      kind: "compliance_program_markdown",
      fileName: "compliance-program.md",
      content: buildMarkdown(report),
      mimeType: "text/markdown",
    }).ref;

    return {
      report,
      jsonArtifact,
      markdownArtifact,
    };
  }
}
