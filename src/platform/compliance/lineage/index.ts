import { newId, nowIso } from "../../contracts/types/ids.js";

export type LineageEdgeKind = "derived_from" | "redacted_from" | "encrypted_from" | "released_as" | "erased_by";

export interface DataLineageEdge {
  edgeId: string;
  sourceRef: string;
  targetRef: string;
  kind: LineageEdgeKind;
  actorRef: string;
  policyRef: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export class DataLineageService {
  private readonly edges: DataLineageEdge[] = [];

  public recordEdge(input: {
    sourceRef: string;
    targetRef: string;
    kind: LineageEdgeKind;
    actorRef: string;
    policyRef?: string | null;
    metadata?: Record<string, unknown>;
  }): DataLineageEdge {
    const edge: DataLineageEdge = {
      edgeId: newId("lineage"),
      sourceRef: input.sourceRef,
      targetRef: input.targetRef,
      kind: input.kind,
      actorRef: input.actorRef,
      policyRef: input.policyRef ?? null,
      createdAt: nowIso(),
      metadata: input.metadata ?? {},
    };
    this.edges.push(edge);
    return edge;
  }

  public traceFrom(sourceRef: string): DataLineageEdge[] {
    return this.edges.filter((edge) => edge.sourceRef === sourceRef);
  }

  public traceTo(targetRef: string): DataLineageEdge[] {
    return this.edges.filter((edge) => edge.targetRef === targetRef);
  }

  public listEdges(): DataLineageEdge[] {
    return [...this.edges];
  }
}
