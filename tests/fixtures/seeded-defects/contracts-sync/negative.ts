// Seeded negative sample: a TS type that does NOT match any P0 contract
// in the audit:contracts-sync list, so the audit script MUST NOT report it.
export interface SomeInternalHelper {
  hello: string;
}
