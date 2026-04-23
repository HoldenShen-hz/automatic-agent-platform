/**
 * Operations domain presenter plugin.
 *
 * Formats operational output — runbooks, incident summaries, monitoring alerts —
 * into human-readable form for operators and SREs.
 *
 * §G8: Operations domain — formats for "operator" and "reviewer" audiences.
 */
import type { DomainPresenterPlugin } from "../../domains/registry/plugin-spi.js";
export declare function createOperationsPresenterPlugin(): DomainPresenterPlugin;
