export interface ComplianceReportSection {
  readonly title: string;
  readonly lines: readonly string[];
}

export function renderComplianceReportMarkdown(title: string, sections: readonly ComplianceReportSection[]): string {
  return [`# ${title}`, ...sections.flatMap((section) => [``, `## ${section.title}`, ...section.lines])].join("\n");
}

export function renderComplianceReportCsv(sections: readonly ComplianceReportSection[]): string {
  return ["section,line", ...sections.flatMap((section) => section.lines.map((line) => `${section.title},${line}`))].join("\n");
}

export class ComplianceReportRendererService {
  public renderMarkdown(title: string, sections: readonly ComplianceReportSection[]): string {
    return renderComplianceReportMarkdown(title, sections);
  }

  public renderCsv(sections: readonly ComplianceReportSection[]): string {
    return renderComplianceReportCsv(sections);
  }

  public renderJson(title: string, sections: readonly ComplianceReportSection[]): string {
    return JSON.stringify({ title, sections }, null, 2);
  }
}
