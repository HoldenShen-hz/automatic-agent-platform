/**
 * Legacy compatibility shim. Canonical distributed lock coordination now
 * lives in `distributed-lock-service.ts`.
 */

export * from "./distributed-lock-service.js";
export * from "./distributed-lock-factory.js";
export * from "./distributed-lock-types.js";

