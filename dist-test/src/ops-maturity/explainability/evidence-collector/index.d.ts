export interface ExplanationEvidence {
    readonly evidenceId: string;
    readonly category: string;
    readonly sourceRef?: string;
    readonly excerpt?: string;
}
export declare function collectExplanationEvidenceIds(items: readonly ExplanationEvidence[]): string[];
export interface ExplanationEvidenceBundle {
    readonly evidenceIds: readonly string[];
    readonly groupedByCategory: Readonly<Record<string, readonly ExplanationEvidence[]>>;
}
export declare function collectExplanationEvidence(items: readonly ExplanationEvidence[]): ExplanationEvidenceBundle;
