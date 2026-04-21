/**
 * Operations domain retriever plugin.
 *
 * Retrieves runbooks, incident records, and monitoring dashboards from the knowledge plane
 * to assist with operational tasks.
 *
 * §G8: Operations domain — M2 Phase 1 (simplest domain, uses existing GitHub adapter).
 */
import type { DomainRetrieverPlugin } from "../../domains/registry/plugin-spi.js";
export declare function createOperationsRetrieverPlugin(): DomainRetrieverPlugin;
