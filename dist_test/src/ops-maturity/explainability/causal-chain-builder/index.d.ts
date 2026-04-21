export interface CausalLink {
    readonly source: string;
    readonly target: string;
    readonly rationale: string;
}
export declare function buildCausalChainSummary(links: readonly CausalLink[]): string[];
