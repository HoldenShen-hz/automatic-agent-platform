export type SensitiveContentFindingKind = "secret" | "pii";
export type SensitiveContentFindingSeverity = "warning" | "critical";
export interface SensitiveContentFinding {
    code: string;
    kind: SensitiveContentFindingKind;
    severity: SensitiveContentFindingSeverity;
    description: string;
    redactedSample: string;
}
export interface SensitiveContentScanResult {
    findings: SensitiveContentFinding[];
    criticalFindingCount: number;
    blocked: boolean;
}
export declare class SensitiveContentScanner {
    private readonly classifier;
    scanText(content: string): SensitiveContentScanResult;
    scanStructured(value: unknown): SensitiveContentScanResult;
}
