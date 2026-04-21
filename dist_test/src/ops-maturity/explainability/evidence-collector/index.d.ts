export interface ExplanationEvidence {
    readonly evidenceId: string;
    readonly category: string;
}
export declare function collectExplanationEvidenceIds(items: readonly ExplanationEvidence[]): string[];
