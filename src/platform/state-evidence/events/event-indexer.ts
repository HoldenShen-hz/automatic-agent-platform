/**
 * Legacy compatibility shim for older tooling that still looks for
 * `event-indexer.ts`. Canonical event indexing/export surfaces now live in
 * the events module barrel and related services.
 */

export * from "./index.js";

