import { createHash } from "node:crypto";
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

interface StoredLineageEdge extends DataLineageEdge {
  _integrityHash: string;
  _previousHash: string | null;
}

export class DataLineageService {
  private readonly edges: StoredLineageEdge[] = [];
  private lastEdgeHash: string | null = null;

  /**
   * R16-36 FIX #2092: Lineage DAG must be append-only with integrity hash.
   * Each edge hashes the previous edge hash + current edge data for tamper detection.
   * Mutable plain array had no integrity protection.
   */
  public recordEdge(input: {
    sourceRef: string;
    targetRef: string;
    kind: LineageEdgeKind;
    actorRef: string;
    policyRef?: string | null;
    metadata?: Record<string, unknown>;
  }): DataLineageEdge {
    const metadata = cloneMetadata(input.metadata);
    const publicEdge: DataLineageEdge = {
      edgeId: newId("lineage"),
      sourceRef: input.sourceRef,
      targetRef: input.targetRef,
      kind: input.kind,
      actorRef: input.actorRef,
      policyRef: input.policyRef ?? null,
      createdAt: nowIso(),
      metadata,
    };

    // R16-36 FIX #2092: Compute integrity hash linking to previous edge
    // This creates an append-only chain: each edge hash includes the previous hash
    const edgeData = JSON.stringify({
      edgeId: publicEdge.edgeId,
      sourceRef: publicEdge.sourceRef,
      targetRef: publicEdge.targetRef,
      kind: publicEdge.kind,
      actorRef: publicEdge.actorRef,
      policyRef: publicEdge.policyRef,
      createdAt: publicEdge.createdAt,
      metadata,
      previousHash: this.lastEdgeHash,
    });
    const storedEdge: StoredLineageEdge = {
      ...publicEdge,
      metadata,
      _integrityHash: createHash("sha256").update(edgeData).digest("hex"),
      _previousHash: this.lastEdgeHash,
    };

    this.edges.push(storedEdge);
    this.lastEdgeHash = storedEdge._integrityHash;
    return cloneEdge(storedEdge);
  }

  /**
   * R16-36 FIX #2092: Verify integrity of the lineage chain.
   * Returns null if tampering detected, otherwise returns hash of last edge.
   */
  public verifyIntegrity(): { valid: boolean; lastHash: string | null; corruptedAt?: string } {
    let previousHash: string | null = null;
    for (const edge of this.edges) {
      const storedHash = edge._integrityHash;
      const storedPreviousHash = edge._previousHash;

      if (storedPreviousHash !== previousHash) {
        return { valid: false, lastHash: this.lastEdgeHash, corruptedAt: edge.createdAt };
      }

      // Recompute expected hash
      const edgeData: string = JSON.stringify({
        edgeId: edge.edgeId,
        sourceRef: edge.sourceRef,
        targetRef: edge.targetRef,
        kind: edge.kind,
        actorRef: edge.actorRef,
        policyRef: edge.policyRef,
        createdAt: edge.createdAt,
        metadata: edge.metadata,
        previousHash,
      });
      const expectedHash: string = createHash("sha256").update(edgeData).digest("hex");

      if (storedHash !== expectedHash) {
        return { valid: false, lastHash: this.lastEdgeHash, corruptedAt: edge.createdAt };
      }

      previousHash = storedHash ?? null;
    }
    return { valid: true, lastHash: this.lastEdgeHash };
  }

  public traceFrom(sourceRef: string): DataLineageEdge[] {
    return this.edges.filter((edge) => edge.sourceRef === sourceRef).map(cloneEdge);
  }

  public traceTo(targetRef: string): DataLineageEdge[] {
    return this.edges.filter((edge) => edge.targetRef === targetRef).map(cloneEdge);
  }

  public listEdges(): DataLineageEdge[] {
    return this.edges.map(cloneEdge);
  }
}

function cloneEdge(edge: DataLineageEdge): DataLineageEdge {
  return {
    ...edge,
    metadata: cloneMetadata(edge.metadata),
  };
}

function cloneMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  return metadata == null ? {} : structuredClone(metadata);
}
