export declare const UNIFIED_SEVERITIES: readonly ["SEV1", "SEV2", "SEV3", "SEV4"];
export type UnifiedSeverity = (typeof UNIFIED_SEVERITIES)[number];
export interface UnifiedSeveritySla {
    acknowledgeWithinMinutes: number;
    mitigateWithinMinutes: number;
    ownerExpectation: string;
}
export declare const UNIFIED_SEVERITY_SLA: Record<UnifiedSeverity, UnifiedSeveritySla>;
export type ObservabilitySeverity = "info" | "warning" | "critical" | "emergency";
export type AlertingSeverity = "info" | "warning" | "critical" | "page";
export type RunbookSeverity = "P0" | "P1" | "P2" | "P3";
export type DiagnosticSeverity = "info" | "warning" | "critical";
export declare function anomalySeverityToUnifiedSeverity(severity: ObservabilitySeverity): UnifiedSeverity;
export declare function alertSeverityToUnifiedSeverity(severity: AlertingSeverity): UnifiedSeverity;
export declare function runbookSeverityToUnifiedSeverity(severity: RunbookSeverity): UnifiedSeverity;
export declare function diagnosticSeverityToUnifiedSeverity(severity: DiagnosticSeverity): UnifiedSeverity;
