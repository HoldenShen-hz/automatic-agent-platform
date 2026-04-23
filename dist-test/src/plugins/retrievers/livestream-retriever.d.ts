/**
 * Livestream domain retriever plugin.
 *
 * Retrieves OBS configurations, stream analytics, viewer engagement metrics, and
 * content planning data from the knowledge plane to assist with livestream operations.
 *
 * §G8: Livestream domain — M2 Phase 5 (high complexity, needs OBS/Stream integration).
 */
import type { DomainRetrieverPlugin } from "../../domains/registry/plugin-spi.js";
export declare function createLivestreamRetrieverPlugin(): DomainRetrieverPlugin;
