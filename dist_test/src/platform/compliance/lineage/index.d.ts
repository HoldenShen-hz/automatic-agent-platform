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
export declare class DataLineageService {
    private readonly edges;
    recordEdge(input: {
        sourceRef: string;
        targetRef: string;
        kind: LineageEdgeKind;
        actorRef: string;
        policyRef?: string | null;
        metadata?: Record<string, unknown>;
    }): DataLineageEdge;
    traceFrom(sourceRef: string): DataLineageEdge[];
    traceTo(targetRef: string): DataLineageEdge[];
    listEdges(): DataLineageEdge[];
}
