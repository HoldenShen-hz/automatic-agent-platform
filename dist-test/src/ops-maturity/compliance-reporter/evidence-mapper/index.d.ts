export interface EvidenceReference {
    readonly evidenceId: string;
    readonly evidenceType: string;
}
export interface EvidenceCoverageSummary {
    readonly coverageRatio: number;
    readonly coveredTypes: readonly string[];
    readonly missingTypes: readonly string[];
}
export declare function mapEvidenceByType(items: readonly EvidenceReference[]): Record<string, string[]>;
export declare function findMissingEvidenceTypes(items: readonly EvidenceReference[], requiredTypes: readonly string[]): string[];
export declare class EvidenceMapperService {
    map(items: readonly EvidenceReference[]): Record<string, string[]>;
    summarizeCoverage(items: readonly EvidenceReference[], requiredTypes: readonly string[]): EvidenceCoverageSummary;
}
