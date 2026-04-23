/**
 * Asset Production domain retriever plugin.
 *
 * Retrieves Figma files, CDN assets, design tokens, and production metadata
 * from the knowledge plane to assist with digital asset creation tasks.
 *
 * §G8: Asset Production domain — M2 Phase 4 (high complexity, needs Figma + CDN).
 */
import type { DomainRetrieverPlugin } from "../../domains/registry/plugin-spi.js";
export declare function createAssetProductionRetrieverPlugin(): DomainRetrieverPlugin;
