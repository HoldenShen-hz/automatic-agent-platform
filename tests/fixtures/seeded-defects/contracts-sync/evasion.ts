// Seeded evasion sample: a TS type with a P0 contract-like name (EventEnvelope)
// but with an extra inline body so the regex MUST still pick it up.
export interface EventEnvelopeEvasion {
  // intentionally-empty body; same name as P0 contract
  id: string;
}
