import { newId, nowIso } from "../../contracts/types/ids.js";
export class DataLineageService {
    edges = [];
    recordEdge(input) {
        const edge = {
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
    traceFrom(sourceRef) {
        return this.edges.filter((edge) => edge.sourceRef === sourceRef);
    }
    traceTo(targetRef) {
        return this.edges.filter((edge) => edge.targetRef === targetRef);
    }
    listEdges() {
        return [...this.edges];
    }
}
//# sourceMappingURL=index.js.map