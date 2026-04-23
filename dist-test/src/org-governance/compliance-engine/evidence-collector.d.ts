export interface ComplianceEvidenceRecord {
    readonly evidenceId: string;
    readonly frameworkId: string;
    readonly controlId: string;
    readonly source: string;
    readonly artifactRef: string;
    readonly collectedAt: string;
}
export declare class ComplianceEvidenceCollector {
    private readonly records;
    collect(input: Omit<ComplianceEvidenceRecord, "evidenceId" | "collectedAt"> & {
        collectedAt?: string;
    }): ComplianceEvidenceRecord;
    list(frameworkId?: string): ComplianceEvidenceRecord[];
}
