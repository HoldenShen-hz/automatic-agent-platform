export interface CausalLink {
  readonly source: string;
  readonly target: string;
  readonly rationale: string;
  readonly confidence?: number;
}

export function buildCausalChainSummary(links: readonly CausalLink[]): string[] {
  return links.map((item) => `${item.source} -> ${item.target}: ${item.rationale}`);
}

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

export function buildCausalChain(nodes: readonly CausalChainNode[], links: readonly CausalLink[]): CausalChain {
  return Object.freeze({
    nodes: Object.freeze([...nodes]),
    links: Object.freeze([...links]),
    summary: Object.freeze(buildCausalChainSummary(links)),
  });
}
