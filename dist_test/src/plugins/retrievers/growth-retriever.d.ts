/**
 * Growth domain retriever plugin.
 *
 * Retrieves growth playbooks, campaign data, customer analytics, and A/B test results
 * from the knowledge plane to assist with marketing and growth tasks.
 *
 * §G8: Growth domain — M2 Phase 2 (medium complexity, needs Ad Platforms + CRM).
 */
import type { DomainRetrieverPlugin } from "../../domains/registry/plugin-spi.js";
export declare function createGrowthRetrieverPlugin(): DomainRetrieverPlugin;
