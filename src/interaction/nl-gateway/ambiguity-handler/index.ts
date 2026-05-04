/**
 * Ambiguity Handler
 *
 * §39: Ambiguity detection for NL Gateway.
 * Provides ambiguity detection to determine when user input is too ambiguous
 * for automatic intent resolution and requires clarification.
 *
 * The canonical implementation is detectAmbiguity() in disambiguation-handler/index.ts.
 * This module provides backward-compatible re-export via the disambiguation-handler.
 *
 * @see docs_en/reviews/architecture-design-vs-implementation-review.md §39
 */

export { detectAmbiguity } from "../disambiguation-handler/index.js";