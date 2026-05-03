/**
 * Ambiguity Handler
 *
 * Re-exports detectAmbiguity from disambiguation-handler for backward compatibility.
 * The canonical implementation lives in disambiguation-handler/index.ts.
 *
 * @see docs_en/reviews/architecture-design-vs-implementation-review.md §39
 */

export { detectAmbiguity } from "../disambiguation-handler/index.js";