/**
 * Game Dev domain retriever plugin.
 *
 * Retrieves Unity project data, build outputs, game design documents, and asset
 * references from the knowledge plane to assist with game development tasks.
 *
 * §G8: Game Dev domain — M2 Phase 3 (medium complexity, needs Unity Cloud Build).
 */
import type { DomainRetrieverPlugin } from "../../domains/registry/plugin-spi.js";
export declare function createGameDevRetrieverPlugin(): DomainRetrieverPlugin;
