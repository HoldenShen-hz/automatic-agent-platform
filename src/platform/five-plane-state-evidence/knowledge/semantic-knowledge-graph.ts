import type { ArchivedKnowledgeRecord } from "./archive/knowledge-archive.js";
import type { TrustLevel } from "./knowledge-model.js";

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
  | "related_to"        // Backward-compatible alias for relates_to
  | "specializes"       // Entity is a specialization of another
  | "generalizes"       // Entity is a generalization of another
  | "implies"           // Entity implies or leads to another
  | "contradicts"       // Entity contradicts another
  // R8-11: Trust propagation edges
  | "trusts"            // Trust relationship (A trusts B)
  | "verified_by"       // Entity verified by evidence/source
  | "derived_from"      // Knowledge derived from source
  | "derives_from"      // Backward-compatible alias for derived_from
  | "confirms"          // Confirms or corroborates another entity
  // R13-07: Learned edge types for learning pipeline integration
  | "learned_from"      // Knowledge learned from evidence/source
  | "failure_pattern"   // Edge marks a failure pattern node
  | "causal_relationship" // Causal relationship between nodes
  | "temporal_correlation"
  | "references"
  | "trust_boost";

export interface KnowledgeGraphNode {
  nodeId: string;
  nodeType: KnowledgeGraphNodeType;
  label: string;
  namespace: string | null;
  knowledgeRef: string | null;
  trustLevel: TrustLevel;
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

export interface TrustPropagationResult {
  propagatedNodeIds: string[];
  trustScoreChanges: Record<string, number>;
}

export interface KnowledgeGraphChunkConnections {
  knowledgeRef: string;
  namespace: string | null;
  keywords: string[];
  sharedKeywordRefs: string[];
  sameDocumentRefs: string[];
  // R8-11: Entity relation connections
  relatedEntityRefs: string[];
  contradictsRefs: string[];
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
  temporalCorrelationRefs: string[];
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
      trustLevel: "authoritative",
    });

    const documentNodeId = `document:${record.document.documentId}`;
    this.nodes.set(documentNodeId, {
      nodeId: documentNodeId,
      nodeType: "document",
      label: record.document.title,
      namespace: record.document.namespace,
      knowledgeRef: null,
      trustLevel: record.source.trustLevel,
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
        trustLevel: record.source.trustLevel,
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
          trustLevel: record.source.trustLevel,
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
      contradictsRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "contradicts"),
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
      temporalCorrelationRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "temporal_correlation"),
    };
  }

  public addEntityRelation(
    fromEntityId: string,
    toEntityId: string,
    relation: Extract<KnowledgeGraphEdgeType, "references" | "trust_boost" | "learned_from" | "failure_pattern" | "causal_relationship" | "temporal_correlation" | "relates_to" | "related_to" | "specializes" | "generalizes" | "implies" | "contradicts" | "derived_from" | "derives_from">,
    weight: number,
    trustLevel: TrustLevel = "team_reviewed",
  ): void {
    const fromNodeId = this.ensureEntityNode(fromEntityId, trustLevel);
    const toNodeId = this.ensureEntityNode(toEntityId, trustLevel);
    this.addEdge(fromNodeId, toNodeId, relation, weight);
  }

  public propagateTrust(seedNodeIds: readonly string[], decayFactor: number): TrustPropagationResult {
    if (seedNodeIds.length === 0) {
      return {
        propagatedNodeIds: [],
        trustScoreChanges: {},
      };
    }

    const normalizedDecay = Math.max(0, Math.min(1, decayFactor));
    const queue = seedNodeIds.map((nodeId) => ({ nodeId, score: 1 }));
    const visited = new Set<string>();
    const scores = new Map<string, number>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.nodeId)) {
        continue;
      }
      visited.add(current.nodeId);
      scores.set(current.nodeId, current.score);

      for (const edge of this.adjacencyByNodeId.get(current.nodeId) ?? []) {
        if (edge.relation !== "trust_boost" && edge.relation !== "trusts") {
          continue;
        }
        const nextScore = Number((current.score * Math.max(0, edge.weight) * (1 - normalizedDecay)).toFixed(4));
        if (nextScore <= 0) {
          continue;
        }
        queue.push({ nodeId: edge.toNodeId, score: nextScore });
      }
    }

    return {
      propagatedNodeIds: [...scores.keys()],
      trustScoreChanges: Object.fromEntries(scores.entries()),
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
      // R12-33: Use adjacencyByNodeId map instead of iterating all edges
      const adjacentEdges = this.adjacencyByNodeId.get(currentNodeId) ?? [];
      for (const edge of adjacentEdges) {
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
      : relation === "learned_from" || relation === "failure_pattern" || relation === "causal_relationship" || relation === "temporal_correlation"
        ? ["chunk", "entity"]
        : ["chunk", "entity"];

    return [...(this.adjacencyByNodeId.get(chunkNodeId) ?? [])]
      .filter((edge) => edge.relation === relation)
      .map((edge) => edge.fromNodeId === chunkNodeId ? edge.toNodeId : edge.fromNodeId)
      .map((nodeId) => this.nodes.get(nodeId))
      .filter((node): node is KnowledgeGraphNode => node != null && validNodeTypes.includes(node.nodeType))
      .map((node) => node.knowledgeRef)
      .filter((ref): ref is string => ref != null)
      .sort();
  }

  private addUndirectedEdge(fromNodeId: string, toNodeId: string, relation: KnowledgeGraphEdgeType, weight: number): void {
    this.addEdge(fromNodeId, toNodeId, relation, weight);
    this.addEdge(toNodeId, fromNodeId, relation, weight);
  }

  private ensureEntityNode(entityId: string, trustLevel: TrustLevel): string {
    const nodeId = entityId.startsWith("entity:") ? entityId : `entity:${entityId}`;
    if (!this.nodes.has(nodeId)) {
      this.nodes.set(nodeId, {
        nodeId,
        nodeType: "entity",
        label: entityId.replace(/^entity:/, ""),
        namespace: null,
        knowledgeRef: null,
        trustLevel,
      });
    }
    return nodeId;
  }

  private addEdge(fromNodeId: string, toNodeId: string, relation: KnowledgeGraphEdgeType, weight: number): void {
    const normalizedRelation = this.normalizeRelation(relation);
    const id = edgeId(fromNodeId, toNodeId, normalizedRelation);
    const edge: KnowledgeGraphEdge = {
      edgeId: id,
      fromNodeId,
      toNodeId,
      relation: normalizedRelation,
      weight,
    };
    this.edges.set(id, edge);
    const adjacency = this.adjacencyByNodeId.get(fromNodeId) ?? [];
    const existingIndex = adjacency.findIndex((candidate) => candidate.edgeId === id);
    if (existingIndex >= 0) {
      adjacency[existingIndex] = edge;
    } else {
      adjacency.push(edge);
    }
    this.adjacencyByNodeId.set(fromNodeId, adjacency);

    const reverseAdjacency = this.adjacencyByNodeId.get(toNodeId) ?? [];
    const reverseIndex = reverseAdjacency.findIndex((candidate) => candidate.edgeId === id);
    if (reverseIndex >= 0) {
      reverseAdjacency[reverseIndex] = edge;
    } else {
      reverseAdjacency.push(edge);
    }
    this.adjacencyByNodeId.set(toNodeId, reverseAdjacency);
  }

  private normalizeRelation(relation: KnowledgeGraphEdgeType): KnowledgeGraphEdgeType {
    switch (relation) {
      case "related_to":
        return "relates_to";
      case "derives_from":
        return "derived_from";
      default:
        return relation;
    }
  }
}
