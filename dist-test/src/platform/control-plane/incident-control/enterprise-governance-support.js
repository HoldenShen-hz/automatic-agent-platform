import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
export function sha256(value) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}
export function readJsonFile(filePath) {
    return JSON.parse(readFileSync(filePath, "utf8"));
}
export function extractPackageName(packagePath) {
    const segments = packagePath.split("node_modules/").filter((segment) => segment.length > 0);
    return segments.at(-1) ?? packagePath;
}
export function detectSourceType(resolvedValue) {
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
export function isPrereleaseVersion(version) {
    return /-(?:alpha|beta|rc|canary|next|preview)/i.test(version);
}
export function summarizeVerdict(hasCritical, hasWarning) {
    if (hasCritical)
        return "fail";
    if (hasWarning)
        return "warning";
    return "pass";
}
export function mapOpsStatusToHandoffStatus(status) {
    if (status === "fail")
        return "blocked";
    if (status === "warning")
        return "warning";
    return "ready";
}
export function selectSloActualValue(report, key) {
    return report.slos.find((item) => item.key === key)?.actualValue ?? 0;
}
export function buildMarkdownReport(report) {
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
//# sourceMappingURL=enterprise-governance-support.js.map