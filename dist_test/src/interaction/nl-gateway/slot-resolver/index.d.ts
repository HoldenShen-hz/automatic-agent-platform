import type { ExtractedEntity } from "../index.js";
export declare function resolveRequiredSlots(entities: readonly ExtractedEntity[], requiredEntityTypes: readonly string[]): {
    readonly missing: string[];
    readonly resolved: Record<string, unknown>;
};
