/**
 * Growth domain presenter plugin.
 *
 * Formats growth output — campaign summaries, A/B test results, customer analytics —
 * into human-readable form for marketers, analysts, and growth engineers.
 *
 * §G8: Growth domain — formats for "end_user" and "reviewer" audiences.
 */
import type { DomainPresenterPlugin } from "../../domains/registry/plugin-spi.js";
export declare function createGrowthPresenterPlugin(): DomainPresenterPlugin;
