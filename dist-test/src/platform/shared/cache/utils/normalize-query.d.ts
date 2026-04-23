/**
 * Query Normalization Utility
 *
 * Provides consistent query string normalization for search-like
 * operations (grep, web-search, memory retrieval).
 */
export declare function normalizeQuery(input: string): string;
export declare function normalizeGrepQuery(input: string): string;
export declare function normalizeIntentQuery(input: string): string;
