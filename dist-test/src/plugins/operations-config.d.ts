/**
 * Operations domain configuration.
 *
 * Defines the Operations domain with workflows, tool bundles, and plugin bindings
 * for the 5 business domains in §G8.
 *
 * §G8: Operations is M2 Phase 1 — lowest complexity, uses existing GitHub adapter.
 */
import type { DomainDefinition } from "../domains/registry/domain-model.js";
/**
 * Operations domain definition.
 *
 * Workflows:
 * - incident_response: Respond to production incidents
 * - runbook_execution: Execute operational runbooks
 * - monitoring_review: Review monitoring dashboards and alerts
 *
 * Plugins:
 * - retriever: operations-retriever (runbook + incident search)
 * - presenter: operations-presenter (operator-readable output)
 * - validator: basic-evaluator (shared)
 * - planner: basic-planner (shared, fallback)
 */
export declare const operationsDomainDefinition: DomainDefinition;
