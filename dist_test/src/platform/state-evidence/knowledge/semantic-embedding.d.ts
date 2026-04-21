export declare function tokenizeSemantically(input: string): string[];
export declare function buildSemanticEmbedding(input: string, extraTerms?: readonly string[]): number[] | null;
export declare function semanticEmbeddingId(input: string, extraTerms?: readonly string[]): string | null;
export declare function cosineSimilarity(left: readonly number[] | null, right: readonly number[] | null): number;
