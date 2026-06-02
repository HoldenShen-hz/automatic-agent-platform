// Seeded positive sample: a TS type declared under contracts/ that has no
// matching JSON schema. The audit:contracts-sync script surfaces this as a
// P0 missing_layer finding. The fixture is intentionally named after a
// well-known P0 contract so the contract-sync script sees a missing layer.
export interface UnusedSeedContract {
  id: string;
  payload: { name: string; amount: number };
}
