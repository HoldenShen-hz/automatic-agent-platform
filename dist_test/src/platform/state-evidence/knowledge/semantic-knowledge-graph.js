function edgeId(fromNodeId, toNodeId, relation) {
    return `${relation}:${fromNodeId}:${toNodeId}`;
}
export class SemanticKnowledgeGraph {
    nodes = new Map();
    edges = new Map();
    adjacencyByNodeId = new Map();
    chunkByKnowledgeRef = new Map();
    keywordToChunkIds = new Map();
    chunkToKeywordIds = new Map();
    replace(records) {
        this.nodes.clear();
        this.edges.clear();
        this.adjacencyByNodeId.clear();
        this.chunkByKnowledgeRef.clear();
        this.keywordToChunkIds.clear();
        this.chunkToKeywordIds.clear();
        for (const record of records) {
            this.upsertRecord(record);
        }
    }
    upsertRecord(record) {
        const namespaceNodeId = `namespace:${record.document.namespace}`;
        this.nodes.set(namespaceNodeId, {
            nodeId: namespaceNodeId,
            nodeType: "namespace",
            label: record.document.namespace,
            namespace: record.document.namespace,
            knowledgeRef: null,
        });
        const documentNodeId = `document:${record.document.documentId}`;
        this.nodes.set(documentNodeId, {
            nodeId: documentNodeId,
            nodeType: "document",
            label: record.document.title,
            namespace: record.document.namespace,
            knowledgeRef: null,
        });
        this.addEdge(namespaceNodeId, documentNodeId, "contains", 1);
        const chunkNodeIds = [];
        for (const chunk of record.chunks) {
            const chunkNodeId = `chunk:${chunk.chunkId}`;
            chunkNodeIds.push(chunkNodeId);
            this.nodes.set(chunkNodeId, {
                nodeId: chunkNodeId,
                nodeType: "chunk",
                label: chunk.summary,
                namespace: chunk.namespace,
                knowledgeRef: `knowledge:${chunk.chunkId}`,
            });
            this.chunkByKnowledgeRef.set(`knowledge:${chunk.chunkId}`, chunkNodeId);
            this.addEdge(documentNodeId, chunkNodeId, "contains", 1);
            const keywordIds = new Set();
            for (const keyword of chunk.keywords) {
                const normalizedKeyword = keyword.trim().toLowerCase();
                if (normalizedKeyword.length === 0) {
                    continue;
                }
                const keywordNodeId = `keyword:${normalizedKeyword}`;
                this.nodes.set(keywordNodeId, {
                    nodeId: keywordNodeId,
                    nodeType: "keyword",
                    label: normalizedKeyword,
                    namespace: chunk.namespace,
                    knowledgeRef: null,
                });
                this.addEdge(chunkNodeId, keywordNodeId, "contains", 1);
                const chunkIds = this.keywordToChunkIds.get(normalizedKeyword) ?? new Set();
                for (const relatedChunkId of chunkIds) {
                    if (relatedChunkId === chunkNodeId) {
                        continue;
                    }
                    this.addUndirectedEdge(chunkNodeId, relatedChunkId, "shared_keyword", 1);
                }
                chunkIds.add(chunkNodeId);
                this.keywordToChunkIds.set(normalizedKeyword, chunkIds);
                keywordIds.add(keywordNodeId);
            }
            this.chunkToKeywordIds.set(chunkNodeId, keywordIds);
        }
        for (let index = 1; index < chunkNodeIds.length; index++) {
            this.addUndirectedEdge(chunkNodeIds[index - 1], chunkNodeIds[index], "same_document", 1);
        }
    }
    findChunkKnowledgeRefsByKeyword(keyword, namespace) {
        const chunkIds = this.keywordToChunkIds.get(keyword.trim().toLowerCase());
        if (!chunkIds) {
            return [];
        }
        return [...chunkIds]
            .map((chunkNodeId) => this.nodes.get(chunkNodeId))
            .filter((node) => node != null && node.nodeType === "chunk")
            .filter((node) => namespace == null || node.namespace === namespace)
            .map((node) => node.knowledgeRef)
            .filter((knowledgeRef) => knowledgeRef != null);
    }
    getChunkConnections(knowledgeRef) {
        const chunkNodeId = this.chunkByKnowledgeRef.get(knowledgeRef);
        if (!chunkNodeId) {
            return null;
        }
        const node = this.nodes.get(chunkNodeId);
        if (!node) {
            return null;
        }
        const keywordIds = this.chunkToKeywordIds.get(chunkNodeId) ?? new Set();
        return {
            knowledgeRef,
            namespace: node.namespace,
            keywords: [...keywordIds]
                .map((keywordNodeId) => this.nodes.get(keywordNodeId)?.label ?? null)
                .filter((keyword) => keyword != null)
                .sort(),
            sharedKeywordRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "shared_keyword"),
            sameDocumentRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "same_document"),
        };
    }
    inspect(input = {}) {
        const limit = Math.max(1, input.limit ?? 20);
        const selectedNodeIds = new Set();
        if (input.knowledgeRef) {
            const chunkNodeId = this.chunkByKnowledgeRef.get(input.knowledgeRef);
            if (chunkNodeId) {
                selectedNodeIds.add(chunkNodeId);
                this.collectAdjacent(chunkNodeId, selectedNodeIds, limit);
            }
        }
        if (input.keyword) {
            const keywordNodeId = `keyword:${input.keyword.trim().toLowerCase()}`;
            if (this.nodes.has(keywordNodeId)) {
                selectedNodeIds.add(keywordNodeId);
                this.collectAdjacent(keywordNodeId, selectedNodeIds, limit);
            }
        }
        if (input.namespace) {
            const namespaceNodeId = `namespace:${input.namespace}`;
            if (this.nodes.has(namespaceNodeId)) {
                selectedNodeIds.add(namespaceNodeId);
                this.collectAdjacent(namespaceNodeId, selectedNodeIds, limit);
            }
        }
        if (selectedNodeIds.size === 0) {
            for (const node of this.nodes.values()) {
                if (input.namespace != null && node.namespace !== input.namespace && node.nodeType !== "namespace") {
                    continue;
                }
                selectedNodeIds.add(node.nodeId);
                if (selectedNodeIds.size >= limit) {
                    break;
                }
            }
        }
        const nodes = [...selectedNodeIds]
            .map((nodeId) => this.nodes.get(nodeId))
            .filter((node) => node != null)
            .slice(0, limit);
        const nodeIdSet = new Set(nodes.map((node) => node.nodeId));
        const edges = [...this.edges.values()]
            .filter((edge) => nodeIdSet.has(edge.fromNodeId) && nodeIdSet.has(edge.toNodeId))
            .slice(0, limit * 2);
        return { nodes, edges };
    }
    collectAdjacent(rootNodeId, collected, limit) {
        for (const edge of this.edges.values()) {
            if (collected.size >= limit) {
                return;
            }
            if (edge.fromNodeId === rootNodeId) {
                collected.add(edge.toNodeId);
            }
            else if (edge.toNodeId === rootNodeId) {
                collected.add(edge.fromNodeId);
            }
        }
    }
    collectChunkKnowledgeRefs(chunkNodeId, relation) {
        return [...(this.adjacencyByNodeId.get(chunkNodeId) ?? [])]
            .filter((edge) => edge.relation === relation)
            .map((edge) => this.nodes.get(edge.toNodeId))
            .filter((node) => node != null && node.nodeType === "chunk")
            .map((node) => node.knowledgeRef)
            .filter((knowledgeRef) => knowledgeRef != null)
            .sort();
    }
    addUndirectedEdge(fromNodeId, toNodeId, relation, weight) {
        this.addEdge(fromNodeId, toNodeId, relation, weight);
        this.addEdge(toNodeId, fromNodeId, relation, weight);
    }
    addEdge(fromNodeId, toNodeId, relation, weight) {
        const id = edgeId(fromNodeId, toNodeId, relation);
        this.edges.set(id, {
            edgeId: id,
            fromNodeId,
            toNodeId,
            relation,
            weight,
        });
        const adjacency = this.adjacencyByNodeId.get(fromNodeId) ?? [];
        adjacency.push(this.edges.get(id));
        this.adjacencyByNodeId.set(fromNodeId, adjacency);
    }
}
//# sourceMappingURL=semantic-knowledge-graph.js.map