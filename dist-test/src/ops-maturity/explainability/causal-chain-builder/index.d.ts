export interface CausalLink {
    readonly source: string;
    readonly target: string;
    readonly rationale: string;
    readonly confidence?: number;
}
export declare function buildCausalChainSummary(links: readonly CausalLink[]): string[];
export interface CausalChainNode {
    readonly nodeId: string;
    readonly title: string;
    readonly category: "signal" | "decision" | "action" | "outcome";
}
export interface CausalChain {
    readonly nodes: readonly CausalChainNode[];
    readonly links: readonly CausalLink[];
    readonly summary: readonly string[];
}
export declare function buildCausalChain(nodes: readonly CausalChainNode[], links: readonly CausalLink[]): CausalChain;
