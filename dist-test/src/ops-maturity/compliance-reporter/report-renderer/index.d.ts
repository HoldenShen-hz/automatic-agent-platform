export interface ComplianceReportSection {
    readonly title: string;
    readonly lines: readonly string[];
}
export declare function renderComplianceReportMarkdown(title: string, sections: readonly ComplianceReportSection[]): string;
export declare function renderComplianceReportCsv(sections: readonly ComplianceReportSection[]): string;
export declare class ComplianceReportRendererService {
    renderMarkdown(title: string, sections: readonly ComplianceReportSection[]): string;
    renderCsv(sections: readonly ComplianceReportSection[]): string;
    renderJson(title: string, sections: readonly ComplianceReportSection[]): string;
}
