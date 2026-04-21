export interface ComplianceReportSection {
    readonly title: string;
    readonly lines: readonly string[];
}
export declare function renderComplianceReportMarkdown(title: string, sections: readonly ComplianceReportSection[]): string;
