/**
 * Stable Stringify Utility
 *
 * Provides deterministic JSON serialization that ensures equal objects
 * produce equal strings regardless of key order.
 */
export declare function stableStringify(value: unknown): string;
export declare function stableEquals(a: unknown, b: unknown): boolean;
