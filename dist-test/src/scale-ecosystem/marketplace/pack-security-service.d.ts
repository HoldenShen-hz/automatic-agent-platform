/**
 * @fileoverview Marketplace Pack Security & Dependency Service
 *
 * Provides:
 * - Automated security scanning for pack publications
 * - Sandbox execution testing before publication approval
 * - Static analysis for vulnerability patterns
 * - Dependency conflict detection with version resolution
 *
 * §55 Marketplace - Automated Security Review + Dependency Conflict Detection
 */
export interface SecurityScanInput {
    packId: string;
    version: string;
    sourceUri: string;
    manifestChecksum: string;
    capabilities: readonly string[];
    permissions: readonly string[];
}
export interface SecurityScanResult {
    scanId: string;
    packId: string;
    version: string;
    status: "passed" | "failed" | "warning";
    issues: SecurityIssue[];
    scannedAt: string;
    scanDurationMs: number;
}
export interface SecurityIssue {
    severity: "critical" | "high" | "medium" | "low" | "info";
    category: "sandbox_violation" | "static_analysis" | "capability_mismatch" | "permission_escalation" | "dependency_issue";
    code: string;
    message: string;
    location?: string;
}
export interface DependencyInfo {
    packId: string;
    version: string;
    capabilities: readonly string[];
}
export interface DependencyConflict {
    conflictingPackId: string;
    conflictingVersion: string;
    conflictType: "capability_overlap" | "permission_conflict" | "api_contract_incompatible";
    details: string;
    resolution?: string;
}
export interface DependencyResolutionResult {
    packId: string;
    version: string;
    resolved: boolean;
    conflicts: DependencyConflict[];
    suggestions: string[];
}
export declare class PackSecurityService {
    runSecurityScan(input: SecurityScanInput): Promise<SecurityScanResult>;
    detectDependencyConflicts(packId: string, version: string, dependencies: readonly DependencyInfo[], existingPacks: readonly DependencyInfo[]): DependencyResolutionResult;
    private runSandboxTest;
    private validateManifestChecksum;
    private runStaticAnalysis;
    private checkCapabilitySafety;
}
