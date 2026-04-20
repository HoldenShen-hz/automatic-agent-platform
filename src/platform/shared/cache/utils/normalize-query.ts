/**
 * Query Normalization Utility
 *
 * Provides consistent query string normalization for search-like
 * operations (grep, web-search, memory retrieval).
 */

export function normalizeQuery(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ') // Collapse whitespace
    .toLowerCase();
}

export function normalizeGrepQuery(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
}

export function normalizeIntentQuery(input: string): string {
  return input
    .trim()
    .replace(/[?!'。？！]+/g, '') // Remove punctuation including apostrophes
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
