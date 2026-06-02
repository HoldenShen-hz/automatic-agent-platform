export interface SideEffectLedgerEntry {
  readonly sideEffectId: string;
  readonly nodeRunId: string;
  readonly idempotencyKey: string;
  readonly status: "proposed" | "committed" | "confirmed" | "compensating" | "compensated" | "failed";
  readonly externalRef?: string;
  readonly evidenceRefs: readonly string[];
}

export function createSideEffectLedgerEntry(entry: SideEffectLedgerEntry): SideEffectLedgerEntry {
  return Object.freeze({
    ...entry,
    evidenceRefs: [...entry.evidenceRefs],
  });
}

export class SideEffectLedgerService {
  private readonly entries = new Map<string, SideEffectLedgerEntry>();

  public upsert(entry: SideEffectLedgerEntry): SideEffectLedgerEntry {
    const normalized = createSideEffectLedgerEntry(entry);
    this.entries.set(normalized.sideEffectId, normalized);
    return normalized;
  }

  public findById(sideEffectId: string): SideEffectLedgerEntry | null {
    return this.entries.get(sideEffectId) ?? null;
  }

  public listByNodeRun(nodeRunId: string): SideEffectLedgerEntry[] {
    return [...this.entries.values()].filter((entry) => entry.nodeRunId === nodeRunId);
  }
}
