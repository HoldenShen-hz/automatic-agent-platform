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

export class CausalChainBuilder {
  public buildFromEvidence(
    taskId: string,
    evidence: ReadonlyArray<{ readonly id: string; readonly toolName?: string; readonly action?: string }>,
  ): {
    readonly chainId: string;
    readonly taskId: string;
    readonly rootNodeId: string;
    readonly nodes: ReadonlyArray<{
      readonly nodeId: string;
      readonly label: string;
      readonly type: string;
      readonly parentIds: readonly string[];
      readonly evidenceIds: readonly string[];
      readonly metadata: Record<string, unknown>;
    }>;
    readonly metadata: Record<string, unknown>;
  } {
    const nodes = evidence.map((item, index) => ({
      nodeId: `node_${index}`,
      label: item.toolName ?? item.action ?? item.id,
      type: item.action ?? "action",
      parentIds: index === 0 ? [] : [`node_${index - 1}`],
      evidenceIds: [item.id],
      metadata: {},
    }));
    return {
      chainId: `chain_${taskId}`,
      taskId,
      rootNodeId: nodes[0]?.nodeId ?? "node_0",
      nodes,
      metadata: {},
    };
  }
}
