/**
 * Growth domain configuration.
 *
 * Defines the Growth domain with workflows, tool bundles, and plugin bindings
 * for the 5 business domains in §G8.
 *
 * §G8: Growth is M2 Phase 2 — medium complexity, needs Ad Platforms + CRM adapters.
 */
import type { DomainDefinition } from "../domains/registry/domain-model.js";
/**
 * Growth domain definition.
 *
 * Workflows:
 * - campaign_optimization: Optimize marketing campaigns based on A/B test results
 * - customer_analytics: Analyze customer segments and conversion funnels
 * - growth_experiment: Design and evaluate growth experiments
 *
 * Plugins:
 * - retriever: growth-retriever (playbook + campaign + A/B test search)
 * - presenter: growth-presenter (marketer/analyst-readable output)
 * - validator: basic-evaluator (shared)
 * - planner: basic-planner (shared, fallback)
 *
 * Adapters:
 * - crm: crm-adapter (HubSpot/Salesforce customer data)
 */
export declare const growthDomainDefinition: DomainDefinition;
