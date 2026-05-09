import type { ArchivedKnowledgeRecord } from "./archive/knowledge-archive.js";

/**
 * Node types in the knowledge graph.
 * R8-11 FIX: Extended to include entity and trust node types.
 */
export type KnowledgeGraphNodeType =
  | "namespace"
  | "document"
  | "chunk"
  | "keyword"
  | "entity"        // R8-11: Entity node for semantic relationships
  | "concept"      // R8-11: Concept node for abstract ideas
  | "trust_root";  // R8-11: Trust anchor node for trust propagation

/**
 * Edge types in the knowledge graph.
 * R8-11 FIX: Extended from 3 to include entity relations and trust propagation.
 *
 * Edge categories:
 * - Containment: contains, same_document
 * - Similarity: shared_keyword
 * - Entity relations (R8-11): relates_to, specializes, generalizes, implies
 * - Trust propagation (R8-11): trusts, verified_by, derived_from
 */
export type KnowledgeGraphEdgeType =
  // Original containment edges
  | "contains"
  | "shared_keyword"
  | "same_document"
  // R8-11: Entity relation edges
  | "relates_to"        // General relationship between entities
  | "specializes"       // Entity is a specialization of another
  | "generalizes"       // Entity is a generalization of another
  | "implies"           // Entity implies or leads to another
  // R8-11: Trust propagation edges
  | "trusts"            // Trust relationship (A trusts B)
  | "verified_by"       // Entity verified by evidence/source
  | "derived_from"      // Knowledge derived from source
  | "confirms"          // Confirms or corroborates another entity
  // R13-07: Learned edge types for learning pipeline integration
  | "learned_from"      // Knowledge learned from evidence/source
  | "failure_pattern"   // Edge marks a failure pattern node
  | "causal_relationship"; // Causal relationship between nodes

export interface KnowledgeGraphNode {
  nodeId: string;
  nodeType: KnowledgeGraphNodeType;
  label: string;
  namespace: string | null;
  knowledgeRef: string | null;
}

export interface KnowledgeGraphEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: KnowledgeGraphEdgeType;
  weight: number;
}

export interface KnowledgeGraphInspection {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export interface KnowledgeGraphChunkConnections {
  knowledgeRef: string;
  namespace: string | null;
  keywords: string[];
  sharedKeywordRefs: string[];
  sameDocumentRefs: string[];
  // R8-11: Entity relation connections
  relatedEntityRefs: string[];
  specializesRefs: string[];
  generalizesRefs: string[];
  impliesRefs: string[];
  // R8-11: Trust propagation connections
  trustRefs: string[];
  verifiedByRefs: string[];
  derivedFromRefs: string[];
  // R13-07: Learned edge connections
  learnedFromRefs: string[];
  failurePatternRefs: string[];
  causalRelationshipRefs: string[];
}

function edgeId(fromNodeId: string, toNodeId: string, relation: KnowledgeGraphEdgeType): string {
  return `${relation}:${fromNodeId}:${toNodeId}`;
}

export class SemanticKnowledgeGraph {
  private readonly nodes = new Map<string, KnowledgeGraphNode>();
  private readonly edges = new Map<string, KnowledgeGraphEdge>();
  private readonly adjacencyByNodeId = new Map<string, KnowledgeGraphEdge[]>();
  private readonly chunkByKnowledgeRef = new Map<string, string>();
  private readonly keywordToChunkIds = new Map<string, Set<string>>();
  private readonly chunkToKeywordIds = new Map<string, Set<string>>();

  public replace(records: readonly ArchivedKnowledgeRecord[]): void {
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

  public upsertRecord(record: ArchivedKnowledgeRecord): void {
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

    const chunkNodeIds: string[] = [];
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

      const keywordIds = new Set<string>();
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
        const chunkIds = this.keywordToChunkIds.get(normalizedKeyword) ?? new Set<string>();
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
      this.addUndirectedEdge(chunkNodeIds[index - 1]!, chunkNodeIds[index]!, "same_document", 1);
    }
  }

  public findChunkKnowledgeRefsByKeyword(keyword: string, namespace?: string): string[] {
    const chunkIds = this.keywordToChunkIds.get(keyword.trim().toLowerCase());
    if (!chunkIds) {
      return [];
    }
    return [...chunkIds]
      .map((chunkNodeId) => this.nodes.get(chunkNodeId))
      .filter((node): node is KnowledgeGraphNode => node != null && node.nodeType === "chunk")
      .filter((node) => namespace == null || node.namespace === namespace)
      .map((node) => node.knowledgeRef)
      .filter((knowledgeRef): knowledgeRef is string => knowledgeRef != null);
  }

  public getChunkConnections(knowledgeRef: string): KnowledgeGraphChunkConnections | null {
    const chunkNodeId = this.chunkByKnowledgeRef.get(knowledgeRef);
    if (!chunkNodeId) {
      return null;
    }
    const node = this.nodes.get(chunkNodeId);
    if (!node) {
      return null;
    }
    const keywordIds = this.chunkToKeywordIds.get(chunkNodeId) ?? new Set<string>();
    return {
      knowledgeRef,
      namespace: node.namespace,
      keywords: [...keywordIds]
        .map((keywordNodeId) => this.nodes.get(keywordNodeId)?.label ?? null)
        .filter((keyword): keyword is string => keyword != null)
        .sort(),
      sharedKeywordRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "shared_keyword"),
      sameDocumentRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "same_document"),
      // R8-11: Entity relation connections
      relatedEntityRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "relates_to"),
      specializesRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "specializes"),
      generalizesRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "generalizes"),
      impliesRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "implies"),
      // R8-11: Trust propagation connections
      trustRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "trusts"),
      verifiedByRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "verified_by"),
      derivedFromRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "derived_from"),
      // R13-07: Learned edge connections
      learnedFromRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "learned_from"),
      failurePatternRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "failure_pattern"),
      causalRelationshipRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "causal_relationship"),
    };
  }

  public inspect(input: {
    namespace?: string;
    knowledgeRef?: string;
    keyword?: string;
    limit?: number;
  } = {}): KnowledgeGraphInspection {
    const limit = Math.max(1, input.limit ?? 20);
    const selectedNodeIds = new Set<string>();

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
      .filter((node): node is KnowledgeGraphNode => node != null)
      .slice(0, limit);
    const nodeIdSet = new Set(nodes.map((node) => node.nodeId));
    const edges = [...this.edges.values()]
      .filter((edge) => nodeIdSet.has(edge.fromNodeId) && nodeIdSet.has(edge.toNodeId))
      .slice(0, limit * 2);

    return { nodes, edges };
  }

  private collectAdjacent(rootNodeId: string, collected: Set<string>, limit: number): void {
    const queue: string[] = [rootNodeId];
    const visited = new Set<string>(queue);

    while (queue.length > 0 && collected.size < limit) {
      const currentNodeId = queue.shift()!;
      for (const edge of this.edges.values()) {
        if (collected.size >= limit) {
          return;
        }
        let adjacentNodeId: string | null = null;
        if (edge.fromNodeId === currentNodeId) {
          adjacentNodeId = edge.toNodeId;
        } else if (edge.toNodeId === currentNodeId) {
          adjacentNodeId = edge.fromNodeId;
        }
        if (adjacentNodeId == null || visited.has(adjacentNodeId)) {
          continue;
        }
        visited.add(adjacentNodeId);
        collected.add(adjacentNodeId);
        queue.push(adjacentNodeId);
      }
    }
  }

  private collectChunkKnowledgeRefs(chunkNodeId: string, relation: KnowledgeGraphEdgeType): string[] {
    // R8-11 FIX: Handle different node types based on relation type
    // For containment/similarity edges, related nodes are chunks
    // For entity relation edges, related nodes can be entities or chunks
    // For trust propagation edges, related nodes can be trust_root or entities
    // R13-07: Learned edges (learned_from, failure_pattern, causal_relationship) connect to chunks/entities
    const validNodeTypes: KnowledgeGraphNodeType[] = relation === "contains" || relation === "shared_keyword" || relation === "same_document"
      ? ["chunk"]
      : relation === "trusts" || relation === "verified_by" || relation === "derived_from" || relation === "confirms"
        ? ["chunk", "entity", "trust_root"]
      : relation === "learned_from" || relation === "failure_pattern" || relation === "causal_relationship"
        ? ["chunk", "entity"]
        : ["chunk", "entity"];

    return [...(this.adjacencyByNodeId.get(chunkNodeId) ?? [])]
      .filter((edge) => edge.relation === relation)
      .map((edge) => this.nodes.get(edge.toNodeId))
      .filter((node): node is KnowledgeGraphNode => node != null && validNodeTypes.includes(node.nodeType))
      .map((node) => node.knowledgeRef)
      .filter((ref): ref is string => ref != null)
      .sort();
  }

  private addUndirectedEdge(fromNodeId: string, toNodeId: string, relation: KnowledgeGraphEdgeType, weight: number): void {
    this.addEdge(fromNodeId, toNodeId, relation, weight);
    this.addEdge(toNodeId, fromNodeId, relation, weight);
  }

  private addEdge(fromNodeId: string, toNodeId: string, relation: KnowledgeGraphEdgeType, weight: number): void {
    const id = edgeId(fromNodeId, toNodeId, relation);
    this.edges.set(id, {
      edgeId: id,
      fromNodeId,
      toNodeId,
      relation,
      weight,
    });
    const adjacency = this.adjacencyByNodeId.get(fromNodeId) ?? [];
    adjacency.push(this.edges.get(id)!);
    this.adjacencyByNodeId.set(fromNodeId, adjacency);
  }
}
