export interface SideEffectLedgerEntry {
  readonly sideEffectId: string;
  readonly nodeRunId: string;
  readonly idempotencyKey: string;
  readonly status: "proposed" | "committed" | "confirmed" | "compensating" | "compensated" | "failed";
  readonly externalRef?: string;
  readonly evidenceRefs: readonly string[];
}

export function createSideEffectLedgerEntry(entry: SideEffectLedgerEntry): SideEffectLedgerEntry {
  return entry;
}
