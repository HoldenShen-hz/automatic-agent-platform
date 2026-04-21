export interface EvidenceReference {
    readonly evidenceId: string;
    readonly evidenceType: string;
}
export declare function mapEvidenceByType(items: readonly EvidenceReference[]): Record<string, string[]>;
