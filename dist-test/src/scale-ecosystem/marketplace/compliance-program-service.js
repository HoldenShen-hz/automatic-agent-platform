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
import { ArtifactStore } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
/**
 * Groups namespaces by their residency policy and counts them.
 * Namespaces without a declared residency policy are grouped under "unspecified".
 *
 * @param namespaces - List of data namespace records to group
 * @returns Array of residency summaries sorted alphabetically by policy name
 */
function groupResidency(namespaces) {
    const counts = new Map();
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
function buildMarkdown(report) {
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
    store;
    artifactStore;
    constructor(store, options = {}) {
        this.store = store;
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
    buildReport(input = {}) {
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
    exportReport(input = {}) {
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
//# sourceMappingURL=compliance-program-service.js.map