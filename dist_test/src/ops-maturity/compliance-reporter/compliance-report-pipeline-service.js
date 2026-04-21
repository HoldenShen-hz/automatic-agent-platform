import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { mapEvidenceByType } from "./evidence-mapper/index.js";
import { renderComplianceReportMarkdown } from "./report-renderer/index.js";
import { findComplianceTemplate } from "./template-registry/index.js";
export class ComplianceReportPipelineService {
    templates;
    accessLog = new Map();
    constructor(templates) {
        this.templates = templates;
    }
    generate(request) {
        const template = findComplianceTemplate(this.templates, request.templateId);
        if (template == null) {
            throw new Error(`compliance_report.template_not_found:${request.templateId}`);
        }
        const evidenceMap = mapEvidenceByType(request.evidence);
        const missingEvidenceTypes = template.requiredEvidenceTypes
            .filter((evidenceType) => (evidenceMap[evidenceType] ?? []).length === 0);
        const sections = this.buildSections(template, evidenceMap, missingEvidenceTypes);
        return {
            artifactId: newId("compliance_report"),
            templateId: template.templateId,
            framework: template.framework,
            reportType: template.reportType,
            version: template.version,
            status: missingEvidenceTypes.length === 0 ? "complete" : "partial",
            missingEvidenceTypes,
            evidenceMap,
            markdown: renderComplianceReportMarkdown(`${template.framework} ${template.reportType} report`, sections),
            readOnly: true,
            generatedAt: request.generatedAt ?? nowIso(),
            generatedBy: request.requestedBy,
        };
    }
    recordReadAccess(artifact, accessorId, accessedAt = nowIso()) {
        const receipt = {
            artifactId: artifact.artifactId,
            accessorId,
            accessMode: "read_only",
            accessedAt,
        };
        this.accessLog.set(artifact.artifactId, [...(this.accessLog.get(artifact.artifactId) ?? []), receipt]);
        return receipt;
    }
    getAccessLog(artifactId) {
        return [...(this.accessLog.get(artifactId) ?? [])];
    }
    buildSections(template, evidenceMap, missingEvidenceTypes) {
        const coverageLines = template.requiredEvidenceTypes.map((evidenceType) => {
            const evidenceIds = evidenceMap[evidenceType] ?? [];
            return evidenceIds.length > 0
                ? `${evidenceType}: ${evidenceIds.join(", ")}`
                : `${evidenceType}: MISSING`;
        });
        const gapLines = missingEvidenceTypes.length === 0
            ? ["All required evidence types are present."]
            : missingEvidenceTypes.map((item) => `Gap: missing required evidence type ${item}`);
        return [
            {
                title: "Template",
                lines: [
                    `template_id=${template.templateId}`,
                    `framework=${template.framework}`,
                    `report_type=${template.reportType}`,
                    `version=${template.version}`,
                ],
            },
            {
                title: "Evidence Coverage",
                lines: coverageLines,
            },
            {
                title: "Completeness",
                lines: gapLines,
            },
        ];
    }
}
//# sourceMappingURL=compliance-report-pipeline-service.js.map