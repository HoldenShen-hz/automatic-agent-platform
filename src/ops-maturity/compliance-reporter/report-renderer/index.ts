export interface ComplianceReportSection {
  readonly title: string;
  readonly lines: readonly string[];
}

export function renderComplianceReportMarkdown(title: string, sections: readonly ComplianceReportSection[]): string {
  return [`# ${title}`, ...sections.flatMap((section) => [``, `## ${section.title}`, ...section.lines])].join("\n");
}
