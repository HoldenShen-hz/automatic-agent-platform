export interface CausalLink {
  readonly source: string;
  readonly target: string;
  readonly rationale: string;
}

export function buildCausalChainSummary(links: readonly CausalLink[]): string[] {
  return links.map((item) => `${item.source} -> ${item.target}: ${item.rationale}`);
}
