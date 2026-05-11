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
  /** SHA-256 hash of the canonical serialization of this entry (hex string). */
  integrityHash: string;
  /** Hash of the previous entry's canonical form; null for the first entry. */
  prevHash: string | null;
  metadata: Record<string, unknown>;
}

export interface ChainIntegrityResult {
  valid: boolean;
  brokenAtIndex: number | null;
  reason: string | null;
}

interface CanonicalEntry {
  edgeId: string;
  sourceRef: string;
  targetRef: string;
  kind: LineageEdgeKind;
  actorRef: string;
  policyRef: string | null;
  createdAt: string;
  prevHash: string | null;
  metadata: Record<string, unknown>;
}

function canonicalForm(entry: CanonicalEntry): string {
  return JSON.stringify(entry);
}

function computeHash(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export class DataLineageService {
  /** Append-only chain of edges. Each entry is immutable once created. */
  private _chain: DataLineageEdge[] = [];

  /**
   * Records a new edge, appending it to the chain with integrity hash chaining.
   * The returned edge is a copy; the internal chain entry cannot be modified.
   */
  public recordEdge(input: {
    sourceRef: string;
    targetRef: string;
    kind: LineageEdgeKind;
    actorRef: string;
    policyRef?: string | null;
    metadata?: Record<string, unknown>;
  }): DataLineageEdge {
    const lastEntry = this._chain.length > 0 ? this._chain[this._chain.length - 1] : null;
    const prevHash = lastEntry?.integrityHash ?? null;

    const canonical: CanonicalEntry = {
      edgeId: newId("lineage"),
      sourceRef: input.sourceRef,
      targetRef: input.targetRef,
      kind: input.kind,
      actorRef: input.actorRef,
      policyRef: input.policyRef ?? null,
      createdAt: nowIso(),
      prevHash,
      metadata: cloneMetadata(input.metadata),
    };

    const integrityHash = computeHash(canonicalForm(canonical));

    // Create the final edge with the computed hash (replace edgeId from canonical with final)
    const edge: DataLineageEdge = {
      edgeId: canonical.edgeId,
      sourceRef: canonical.sourceRef,
      targetRef: canonical.targetRef,
      kind: canonical.kind,
      actorRef: canonical.actorRef,
      policyRef: canonical.policyRef,
      createdAt: canonical.createdAt,
      integrityHash,
      prevHash: canonical.prevHash,
      metadata: canonical.metadata,
    };

    // Append-only: replace chain with new array containing all previous + new entry
    this._chain = [...this._chain, Object.freeze({ ...edge })];

    return cloneEdge(edge);
  }

  public traceFrom(sourceRef: string): DataLineageEdge[] {
    return this._chain
      .filter((edge) => edge.sourceRef === sourceRef)
      .map(cloneEdge);
  }

  public traceTo(targetRef: string): DataLineageEdge[] {
    return this._chain
      .filter((edge) => edge.targetRef === targetRef)
      .map(cloneEdge);
  }

  public listEdges(): DataLineageEdge[] {
    return this._chain.map(cloneEdge);
  }

  /**
   * Verifies the integrity of the entire chain.
   * Returns ChainIntegrityResult indicating whether the chain is valid
   * and, if not, at which index it was broken and why.
   */
  public verifyChain(): ChainIntegrityResult {
    for (let i = 0; i < this._chain.length; i++) {
      const entry = this._chain[i]!;

      // Verify prevHash matches previous entry's integrityHash (or null for first)
      if (i === 0) {
        if (entry.prevHash !== null) {
          return {
            valid: false,
            brokenAtIndex: 0,
            reason: `Entry 0 has prevHash "${entry.prevHash}" but expected null for genesis entry`,
          };
        }
      } else {
        const prevEntry = this._chain[i - 1]!;
        if (entry.prevHash !== prevEntry.integrityHash) {
          return {
            valid: false,
            brokenAtIndex: i,
            reason: `Entry ${i} has prevHash "${entry.prevHash}" but previous entry ${i - 1} has integrityHash "${prevEntry.integrityHash}"`,
          };
        }
      }

      // Verify the entry's own integrity hash
      const canonical: CanonicalEntry = {
        edgeId: entry.edgeId,
        sourceRef: entry.sourceRef,
        targetRef: entry.targetRef,
        kind: entry.kind,
        actorRef: entry.actorRef,
        policyRef: entry.policyRef,
        createdAt: entry.createdAt,
        prevHash: entry.prevHash,
        metadata: entry.metadata,
      };
      const expectedHash = computeHash(canonicalForm(canonical));
      if (entry.integrityHash !== expectedHash) {
        return {
          valid: false,
          brokenAtIndex: i,
          reason: `Entry ${i} integrity hash mismatch: expected "${expectedHash}", got "${entry.integrityHash}"`,
        };
      }
    }
    return { valid: true, brokenAtIndex: null, reason: null };
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
