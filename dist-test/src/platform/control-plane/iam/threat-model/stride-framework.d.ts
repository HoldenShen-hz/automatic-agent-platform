export declare const STRIDE_CATEGORIES: readonly ["SPOOFING", "TAMPERING", "REPUDIATION", "INFORMATION_DISCLOSURE", "DENIAL_OF_SERVICE", "ELEVATION_OF_PRIVILEGE"];
export type StrideCategory = (typeof STRIDE_CATEGORIES)[number];
export type ResidualRiskLevel = "low" | "medium" | "high";
export interface ThreatEntry {
    threatId: string;
    category: StrideCategory;
    title: string;
    scenario: string;
    mitigations: string[];
    implementationRefs: string[];
    residualRisk: ResidualRiskLevel;
}
export interface ThreatMatrix {
    version: string;
    updatedAt: string;
    owner: string;
    entries: ThreatEntry[];
}
export declare function validateThreatMatrix(matrix: ThreatMatrix): {
    valid: boolean;
    missingCategories: StrideCategory[];
};
export declare function listThreatsByCategory(matrix: ThreatMatrix, category: StrideCategory): ThreatEntry[];
