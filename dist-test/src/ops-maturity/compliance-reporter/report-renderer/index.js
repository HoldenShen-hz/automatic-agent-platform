export function renderComplianceReportMarkdown(title, sections) {
    return [`# ${title}`, ...sections.flatMap((section) => [``, `## ${section.title}`, ...section.lines])].join("\n");
}
export function renderComplianceReportCsv(sections) {
    return ["section,line", ...sections.flatMap((section) => section.lines.map((line) => `${section.title},${line}`))].join("\n");
}
export class ComplianceReportRendererService {
    renderMarkdown(title, sections) {
        return renderComplianceReportMarkdown(title, sections);
    }
    renderCsv(sections) {
        return renderComplianceReportCsv(sections);
    }
    renderJson(title, sections) {
        return JSON.stringify({ title, sections }, null, 2);
    }
}
//# sourceMappingURL=index.js.map