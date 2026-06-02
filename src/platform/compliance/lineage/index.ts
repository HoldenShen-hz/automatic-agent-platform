import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { newId, nowIso } from "../../contracts/types/ids.js";
import { stableStringify } from "../../shared/cache/utils/stable-stringify.js";

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
  /** HMAC-SHA256 signature over the canonical entry form (hex string). */
  integritySignature: string;
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

export interface DataLineagePersistenceStore {
  loadChain(): readonly DataLineageEdge[];
  replaceChain(chain: readonly DataLineageEdge[]): void;
}

export interface DataLineageServiceOptions {
  readonly hmacKey?: string;
  readonly persistenceStore?: DataLineagePersistenceStore;
  readonly edgeIdFactory?: () => string;
  readonly now?: () => string;
}

function canonicalForm(entry: CanonicalEntry): string {
  return stableStringify(entry);
}

function computeHash(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function computeSignature(data: string, hmacKey: string): string {
  return createHmac("sha256", hmacKey).update(data, "utf8").digest("hex");
}

export class DataLineageService {
  /** Append-only chain of edges. Each entry is immutable once created. */
  private _chain: DataLineageEdge[] = [];
  private readonly hmacKey: string;
  private readonly persistenceStore: DataLineagePersistenceStore | null;
  private readonly edgeIdFactory: () => string;
  private readonly now: () => string;

  public constructor(options: DataLineageServiceOptions = {}) {
    this.hmacKey = options.hmacKey?.trim() || randomBytes(32).toString("hex");
    this.persistenceStore = options.persistenceStore ?? null;
    this.edgeIdFactory = options.edgeIdFactory ?? (() => newId("lineage"));
    this.now = options.now ?? (() => nowIso());
    const restoredChain = this.persistenceStore?.loadChain() ?? [];
    this._chain = restoredChain.map((edge) => freezeEdge(edge));
    const integrity = this.verifyChain();
    if (!integrity.valid) {
      throw new Error(`data_lineage.invalid_persisted_chain:${integrity.reason ?? "unknown"}`);
    }
  }

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
      edgeId: this.edgeIdFactory(),
      sourceRef: input.sourceRef,
      targetRef: input.targetRef,
      kind: input.kind,
      actorRef: input.actorRef,
      policyRef: input.policyRef ?? null,
      createdAt: this.now(),
      prevHash,
      metadata: cloneMetadata(input.metadata),
    };

    const canonicalPayload = canonicalForm(canonical);
    const integrityHash = computeHash(canonicalPayload);
    const integritySignature = computeSignature(canonicalPayload, this.hmacKey);

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
      integritySignature,
      prevHash: canonical.prevHash,
      metadata: canonical.metadata,
    };

    // Append-only: replace chain with new array containing all previous + new entry
    this._chain = [...this._chain, freezeEdge(edge)];
    this.persistenceStore?.replaceChain(this._chain.map(cloneEdge));

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
      const expectedSignature = computeSignature(canonicalForm(canonical), this.hmacKey);
      if (entry.integritySignature !== expectedSignature) {
        return {
          valid: false,
          brokenAtIndex: i,
          reason: `Entry ${i} integrity signature mismatch`,
        };
      }
    }
    return { valid: true, brokenAtIndex: null, reason: null };
  }
}

export class JsonFileDataLineagePersistenceStore implements DataLineagePersistenceStore {
  public constructor(private readonly filePath: string) {}

  public loadChain(): readonly DataLineageEdge[] {
    if (!existsSync(this.filePath)) {
      return [];
    }
    const raw = readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("data_lineage.invalid_persistence_payload");
    }
    return parsed.map((entry) => normalizePersistedEdge(entry));
  }

  public replaceChain(chain: readonly DataLineageEdge[]): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(chain, null, 2)}\n`, "utf8");
  }
}

function cloneEdge(edge: DataLineageEdge): DataLineageEdge {
  return {
    ...edge,
    metadata: cloneMetadata(edge.metadata),
  };
}

function freezeEdge(edge: DataLineageEdge): DataLineageEdge {
  return Object.freeze({
    ...edge,
    metadata: cloneMetadata(edge.metadata),
  });
}

function cloneMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  return metadata == null ? {} : structuredClone(metadata);
}

function normalizePersistedEdge(entry: unknown): DataLineageEdge {
  if (entry == null || typeof entry !== "object") {
    throw new Error("data_lineage.invalid_persisted_edge");
  }
  const candidate = entry as Partial<DataLineageEdge>;
  if (
    typeof candidate.edgeId !== "string"
    || typeof candidate.sourceRef !== "string"
    || typeof candidate.targetRef !== "string"
    || typeof candidate.kind !== "string"
    || typeof candidate.actorRef !== "string"
    || typeof candidate.createdAt !== "string"
    || typeof candidate.integrityHash !== "string"
    || typeof candidate.integritySignature !== "string"
  ) {
    throw new Error("data_lineage.invalid_persisted_edge");
  }
  return {
    edgeId: candidate.edgeId,
    sourceRef: candidate.sourceRef,
    targetRef: candidate.targetRef,
    kind: candidate.kind as LineageEdgeKind,
    actorRef: candidate.actorRef,
    policyRef: typeof candidate.policyRef === "string" ? candidate.policyRef : null,
    createdAt: candidate.createdAt,
    integrityHash: candidate.integrityHash,
    integritySignature: candidate.integritySignature,
    prevHash: typeof candidate.prevHash === "string" ? candidate.prevHash : null,
    metadata: cloneMetadata(candidate.metadata as Record<string, unknown> | undefined),
  };
}
