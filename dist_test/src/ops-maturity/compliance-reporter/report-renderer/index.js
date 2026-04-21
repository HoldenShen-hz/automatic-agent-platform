export function renderComplianceReportMarkdown(title, sections) {
    return [`# ${title}`, ...sections.flatMap((section) => [``, `## ${section.title}`, ...section.lines])].join("\n");
}
//# sourceMappingURL=index.js.map