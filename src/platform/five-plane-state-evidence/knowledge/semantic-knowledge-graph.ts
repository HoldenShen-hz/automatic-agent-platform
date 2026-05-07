import type { ArchivedKnowledgeRecord } from "./archive/knowledge-archive.js";

export type KnowledgeGraphNodeType = "namespace" | "document" | "chunk" | "keyword" | "entity";
export type KnowledgeGraphEdgeType =
  | "contains"
  | "shared_keyword"
  | "same_document"
  | "references"        // §13.9: Entity relation edge - one entity references another
  | "derives_from"      // Knowledge derives from source
  | "contradicts"       // Contradicting knowledge
  | "specializes"       // Specializes/generalizes relationship
  | "trust_boost"       // Trust propagation edge
  | "trust_degrades"    // Trust degradation edge
  | "learned_from"      // R13-07: Learned knowledge edge - knowledge learned from another source
  | "failure_pattern"   // R13-07: Failure pattern edge - marks recurring failure patterns
  | "causal_relationship" // R13-07: Causal relationship edge - cause-effect relationship
  | "temporal_correlation" // R13-07: Temporal correlation edge - time-based correlation
  | "sequential"       // R8-11: Sequential edge - execution ordering dependency
  | "entity_relation";  // R8-11: Entity relation edge - direct entity relationship

export interface KnowledgeGraphNode {
  nodeId: string;
  nodeType: KnowledgeGraphNodeType;
  label: string;
  namespace: string | null;
  knowledgeRef: string | null;
  /** R16-34 FIX: §29.1 Trust Level for knowledge nodes
   * Levels (lowest to highest):
   * - private_unverified: raw info, no review
   * - team_reviewed: verified by team
   * - official: formally approved
   * - authoritative: canonical, cannot be contested
   * - contested: previously authoritative but now disputed
   */
  trustLevel: "private_unverified" | "team_reviewed" | "official" | "authoritative" | "contested";
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
  /** References to related entities per §13.9 */
  entityRefs: string[];
}

export interface TrustPropagationResult {
  propagatedNodeIds: string[];
  trustScoreChanges: Record<string, number>;
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
      // R16-34 FIX: Namespace nodes are authoritative - they represent org boundaries
      trustLevel: "authoritative",
    });

    const documentNodeId = `document:${record.document.documentId}`;
    this.nodes.set(documentNodeId, {
      nodeId: documentNodeId,
      nodeType: "document",
      label: record.document.title,
      namespace: record.document.namespace,
      knowledgeRef: null,
      // R16-34 FIX: Documents start as team_reviewed until formally approved
      trustLevel: "team_reviewed",
    });
    this.addEdge(namespaceNodeId, documentNodeId, "contains", 1);

    const chunkNodeIds: string[] = [];
    for (const chunk of record.chunks) {
      const chunkNodeId = `chunk:${chunk.chunkId}`;
      chunkNodeIds.push(chunkNodeId);
      // R16-34 FIX: Derive trust level from source trust level (chunks inherit from parent document's source)
      const derivedTrustLevel = record.source.trustLevel as KnowledgeGraphNode["trustLevel"];
      this.nodes.set(chunkNodeId, {
        nodeId: chunkNodeId,
        nodeType: "chunk",
        label: chunk.summary,
        namespace: chunk.namespace,
        knowledgeRef: `knowledge:${chunk.chunkId}`,
        trustLevel: derivedTrustLevel ?? "private_unverified",
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
          // R16-34 FIX: Keywords inherit trust from their parent chunk's source
          trustLevel: derivedTrustLevel ?? "private_unverified",
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
      entityRefs: this.collectChunkKnowledgeRefs(chunkNodeId, "references"),
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

      // R16-33 FIX: Use adjacency index instead of iterating all edges
      // O(V*E) -> O(V + E) by using the pre-built adjacencyByNodeId map
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
    return [...(this.adjacencyByNodeId.get(chunkNodeId) ?? [])]
      .filter((edge) => edge.relation === relation)
      .map((edge) => this.nodes.get(edge.toNodeId))
      .filter((node): node is KnowledgeGraphNode => node != null && node.nodeType === "chunk")
      .map((node) => node.knowledgeRef)
      .filter((knowledgeRef): knowledgeRef is string => knowledgeRef != null)
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
    // R25-3 Fix: Deduplicate adjacency entries - prevent unbounded growth from duplicate edge additions
    // Without this check, repeated upsertRecord calls cause same edge to be pushed multiple times
    if (!adjacency.some((e) => e.edgeId === id)) {
      adjacency.push(this.edges.get(id)!);
      this.adjacencyByNodeId.set(fromNodeId, adjacency);
    }
  }

  /**
   * §13.9: Adds an entity relation edge between two nodes.
   * Entity relations represent references between knowledge entities.
   */
  public addEntityRelation(
    fromEntityRef: string,
    toEntityRef: string,
    relation: "references" | "derives_from" | "contradicts" | "specializes" | "entity_relation" = "references",
    weight: number = 1.0,
  ): void {
    const fromNodeId = `entity:${fromEntityRef}`;
    const toNodeId = `entity:${toEntityRef}`;

    // Ensure entity nodes exist
    if (!this.nodes.has(fromNodeId)) {
      this.nodes.set(fromNodeId, {
        nodeId: fromNodeId,
        nodeType: "entity",
        label: fromEntityRef,
        namespace: null,
        knowledgeRef: null,
        // R16-34 FIX: Entity nodes default to private_unverified (unverified info)
        trustLevel: "private_unverified",
      });
    }
    if (!this.nodes.has(toNodeId)) {
      this.nodes.set(toNodeId, {
        nodeId: toNodeId,
        nodeType: "entity",
        label: toEntityRef,
        namespace: null,
        knowledgeRef: null,
        // R16-34 FIX: Entity nodes default to private_unverified (unverified info)
        trustLevel: "private_unverified",
      });
    }

    this.addEdge(fromNodeId, toNodeId, relation, weight);
  }

  /**
   * §13.11: Propagates trust through the knowledge graph.
   * Trust flows through "trust_boost" edges and degrades through "trust_degrades" edges.
   * Returns nodes whose trust scores changed.
   */
  public propagateTrust(seedNodeIds: readonly string[], boostAmount: number = 0.1): TrustPropagationResult {
    const trustScoreChanges: Record<string, number> = {};
    const propagatedNodeIds: string[] = [];
    const visited = new Set<string>();
    const queue = [...seedNodeIds];

    // Initialize trust scores from node weights
    const nodeTrustScores = new Map<string, number>();
    for (const nodeId of seedNodeIds) {
      nodeTrustScores.set(nodeId, 1.0);
      trustScoreChanges[nodeId] = boostAmount;
      propagatedNodeIds.push(nodeId);
    }

    // BFS propagation through trust edges
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const currentTrust = nodeTrustScores.get(currentId) ?? 0;
      const adjacentEdges = this.adjacencyByNodeId.get(currentId) ?? [];

      for (const edge of adjacentEdges) {
        if (edge.relation === "trust_boost") {
          const neighborId = edge.fromNodeId === currentId ? edge.toNodeId : edge.fromNodeId;
          const newTrust = Math.min(1.0, currentTrust + boostAmount * edge.weight);
          const existingTrust = nodeTrustScores.get(neighborId) ?? 0;

          if (newTrust > existingTrust) {
            nodeTrustScores.set(neighborId, newTrust);
            trustScoreChanges[neighborId] = (trustScoreChanges[neighborId] ?? 0) + (newTrust - existingTrust);
            if (!propagatedNodeIds.includes(neighborId)) {
              propagatedNodeIds.push(neighborId);
            }
            queue.push(neighborId);
          }
        } else if (edge.relation === "trust_degrades") {
          const neighborId = edge.fromNodeId === currentId ? edge.toNodeId : edge.fromNodeId;
          const newTrust = Math.max(0, currentTrust - boostAmount * edge.weight);
          const existingTrust = nodeTrustScores.get(neighborId) ?? 1.0;

          if (newTrust < existingTrust) {
            nodeTrustScores.set(neighborId, newTrust);
            trustScoreChanges[neighborId] = (trustScoreChanges[neighborId] ?? 0) - (existingTrust - newTrust);
            if (!propagatedNodeIds.includes(neighborId)) {
              propagatedNodeIds.push(neighborId);
            }
            queue.push(neighborId);
          }
        }
      }
    }

    return { propagatedNodeIds, trustScoreChanges };
  }

  /**
   * R8-11: Knowledge trust downgraded event handler.
   * Handles knowledge.trust_downgraded event - demotes node trust level and triggers re-evaluation.
   */
  public handleTrustDowngradedEvent(
    nodeId: string,
    demotionLevel: "to_team_reviewed" | "to_private_unverified" | "to_contested" = "to_team_reviewed",
  ): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }

    const oldTrust = node.trustLevel;
    let newTrustLevel: KnowledgeGraphNode["trustLevel"] = node.trustLevel;

    switch (demotionLevel) {
      case "to_contested":
        newTrustLevel = "contested";
        break;
      case "to_team_reviewed":
        newTrustLevel = "team_reviewed";
        break;
      case "to_private_unverified":
        newTrustLevel = "private_unverified";
        break;
    }

    // Update node trust level
    this.nodes.set(nodeId, { ...node, trustLevel: newTrustLevel });

    // Create audit trail edge for the trust demotion event
    const eventNodeId = `event:knowledge.trust_downgraded:${nodeId}:${Date.now()}`;
    this.nodes.set(eventNodeId, {
      nodeId: eventNodeId,
      nodeType: "entity",
      label: `trust_downgraded:${nodeId}`,
      namespace: node.namespace,
      knowledgeRef: null,
      trustLevel: "authoritative", // Events are always authoritative
    });

    // Connect event to affected node
    this.addEdge(eventNodeId, nodeId, "trust_degrades", 1.0);

    // Propagate trust degradation to connected nodes
    this.propagateTrust([nodeId], -0.2);
  }

  /**
   * R8-11: Adds a sequential edge between nodes representing execution ordering.
   */
  public addSequentialEdge(
    fromNodeId: string,
    toNodeId: string,
    weight: number = 1.0,
  ): void {
    this.addEdge(fromNodeId, toNodeId, "sequential", weight);
  }

  /**
   * R8-11: Adds a direct entity relationship edge between two entities.
   */
  public addEntityRelationEdge(
    fromEntityRef: string,
    toEntityRef: string,
    weight: number = 1.0,
  ): void {
    this.addEntityRelation(fromEntityRef, toEntityRef, "entity_relation", weight);
  }

  /**
   * R8-11: Persistence layer - serializes graph state to a portable format.
   */
  public serialize(): string {
    const state = {
      nodes: [...this.nodes.entries()],
      edges: [...this.edges.entries()],
      adjacency: [...this.adjacencyByNodeId.entries()],
      chunkByKnowledgeRef: [...this.chunkByKnowledgeRef.entries()],
      keywordToChunkIds: [...this.keywordToChunkIds.entries()].map(
        ([k, v]) => [k, [...v]] as [string, string[]],
      ),
      chunkToKeywordIds: [...this.chunkToKeywordIds.entries()].map(
        ([k, v]) => [k, [...v]] as [string, string[]],
      ),
      timestamp: Date.now(),
    };
    return JSON.stringify(state);
  }

  /**
   * R8-11: Persistence layer - deserializes graph state from a portable format.
   */
  public deserialize(data: string): void {
    const state = JSON.parse(data) as {
      nodes: [string, KnowledgeGraphNode][];
      edges: [string, KnowledgeGraphEdge][];
      adjacency: [string, KnowledgeGraphEdge[]][];
      chunkByKnowledgeRef: [string, string][];
      keywordToChunkIds: [string, string[]][];
      chunkToKeywordIds: [string, string[]][];
      timestamp: number;
    };

    this.nodes.clear();
    this.edges.clear();
    this.adjacencyByNodeId.clear();
    this.chunkByKnowledgeRef.clear();
    this.keywordToChunkIds.clear();
    this.chunkToKeywordIds.clear();

    for (const [id, node] of state.nodes) {
      this.nodes.set(id, node);
    }
    for (const [id, edge] of state.edges) {
      this.edges.set(id, edge);
    }
    for (const [nodeId, adjacents] of state.adjacency) {
      this.adjacencyByNodeId.set(nodeId, adjacents);
    }
    for (const [ref, chunkId] of state.chunkByKnowledgeRef) {
      this.chunkByKnowledgeRef.set(ref, chunkId);
    }
    for (const [keyword, chunkIds] of state.keywordToChunkIds) {
      this.keywordToChunkIds.set(keyword, new Set(chunkIds));
    }
    for (const [chunkId, keywordIds] of state.chunkToKeywordIds) {
      this.chunkToKeywordIds.set(chunkId, new Set(keywordIds));
    }
  }

  /**
   * R8-11: Persistence layer - exports graph inspection for debugging/auditing.
   */
  public exportInspection(): KnowledgeGraphInspection {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
    };
  }
}
