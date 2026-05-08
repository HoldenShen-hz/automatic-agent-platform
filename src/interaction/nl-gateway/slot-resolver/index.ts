import type { ExtractedEntity } from "../index.js";

export function resolveRequiredSlots(
  entities: readonly ExtractedEntity[],
  requiredEntityTypes: readonly string[],
): { readonly missing: string[]; readonly resolved: Record<string, unknown> } {
  const resolved: Record<string, unknown> = {};
  for (const entity of entities) {
    if (!(entity.entityType in resolved)) {
      resolved[entity.entityType] = entity.normalized;
    }
  }
  return {
    missing: requiredEntityTypes.filter((item) => !(item in resolved)),
    resolved,
  };
}
