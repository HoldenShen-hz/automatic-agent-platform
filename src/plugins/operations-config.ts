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
export const operationsDomainDefinition: DomainDefinition = {
  domainId: "operations",
  name: "Operations",
  description: "Runbook execution, incident response, and monitoring review for SRE and DevOps tasks.",
  version: 1,
  status: "active",
  workflows: [
    {
      workflowId: "incident_response",
      name: "Incident Response",
      triggerConditions: {
        taskType: "incident",
      },
      steps: [
        {
          stepName: "assess_incident",
          toolHints: ["diagnose", "fetch_logs"],
          modelHints: { preferredModel: "MiniMax-M2.7", temperature: 0.3 },
          outputSchema: {
            severity: "string",
            system: "string",
            description: "string",
          },
          retryPolicy: { maxRetries: 1, backoffMs: 1000 },
          requiresReview: true,
          timeoutMs: 30000,
          dependsOn: [],
        },
        {
          stepName: "apply_remediation",
          toolHints: ["execute", "patch"],
          modelHints: { preferredModel: "MiniMax-M2.7", temperature: 0.1 },
          outputSchema: { applied: "boolean", verified: "boolean" },
          retryPolicy: { maxRetries: 2, backoffMs: 5000 },
          requiresReview: true,
          timeoutMs: 120000,
          dependsOn: ["assess_incident"],
        },
      ],
    },
    {
      workflowId: "runbook_execution",
      name: "Runbook Execution",
      triggerConditions: {
        taskType: "runbook",
      },
      steps: [
        {
          stepName: "retrieve_runbook",
          toolHints: ["knowledge_retrieve"],
          modelHints: { preferredModel: "MiniMax-Text-01", temperature: 0.2 },
          outputSchema: { runbookId: "string", steps: "array" },
          retryPolicy: { maxRetries: 0, backoffMs: 0 },
          requiresReview: false,
          timeoutMs: 10000,
          dependsOn: [],
        },
        {
          stepName: "execute_runbook",
          toolHints: ["execute"],
          modelHints: { preferredModel: "MiniMax-M2.7", temperature: 0.1 },
          outputSchema: { completed: "boolean", verified: "boolean" },
          retryPolicy: { maxRetries: 2, backoffMs: 3000 },
          requiresReview: false,
          timeoutMs: 60000,
          dependsOn: ["retrieve_runbook"],
        },
      ],
    },
    {
      workflowId: "monitoring_review",
      name: "Monitoring Review",
      triggerConditions: {
        taskType: "monitoring",
      },
      steps: [
        {
          stepName: "fetch_metrics",
          toolHints: ["query_metrics"],
          modelHints: { preferredModel: "MiniMax-Text-01", temperature: 0.0 },
          outputSchema: { metrics: "array", anomalyDetected: "boolean" },
          retryPolicy: { maxRetries: 1, backoffMs: 2000 },
          requiresReview: false,
          timeoutMs: 15000,
          dependsOn: [],
        },
        {
          stepName: "summarize_findings",
          toolHints: ["summarize"],
          modelHints: { preferredModel: "MiniMax-M1", temperature: 0.4 },
          outputSchema: { summary: "string", recommendations: "array" },
          retryPolicy: { maxRetries: 0, backoffMs: 0 },
          requiresReview: false,
          timeoutMs: 20000,
          dependsOn: ["fetch_metrics"],
        },
      ],
    },
  ],
  toolBundles: [
    {
      bundleId: "ops-core",
      tools: [
        { toolName: "diagnose", enabled: true, configOverrides: {} },
        { toolName: "fetch_logs", enabled: true, configOverrides: {} },
        { toolName: "execute", enabled: true, configOverrides: {} },
        { toolName: "patch", enabled: false, configOverrides: {} },
        { toolName: "query_metrics", enabled: true, configOverrides: {} },
        { toolName: "knowledge_retrieve", enabled: true, configOverrides: {} },
      ],
    },
  ],
  outputContracts: [
    {
      contractId: "ops.incident_response",
      name: "Incident Response Output",
      schema: {
        severity: "string",
        system: "string",
        description: "string",
        remediationApplied: "boolean",
      },
      validationLevel: "strict",
    },
    {
      contractId: "ops.runbook_execution",
      name: "Runbook Execution Output",
      schema: {
        runbookId: "string",
        stepsCompleted: "number",
        verified: "boolean",
      },
      validationLevel: "lenient",
    },
    {
      contractId: "ops.monitoring_review",
      name: "Monitoring Review Output",
      schema: {
        alertId: "string",
        reviewedAt: "string",
        findings: "string[]",
        severityOverride: "string | null",
      },
      validationLevel: "lenient",
    },
  ],
  promptOverrides: {
    system: "You are an Operations AI assisting SRE and DevOps engineers with incident response, runbook execution, and monitoring review. Be precise, concise, and prioritize operator safety.",
  },
  capabilities: {
    supportedTaskTypes: ["incident", "runbook", "monitoring", "deployment", "health_check"],
    requiredTools: ["diagnose", "fetch_logs", "knowledge_retrieve"],
    optionalTools: ["execute", "patch", "query_metrics"],
    modelPreferences: {
      "incident_response": "MiniMax-M2.7",
      "runbook_execution": "MiniMax-Text-01",
    },
    budgetLimits: {
      maxTokensPerTask: 6000,
      maxCostPerTask: 2.0,
    },
    securityLevel: "elevated",
  },
  externalAdapters: ["github"],
  pluginBindings: [
    { bindingId: "ops.retriever", domainId: "operations", pluginType: "retriever", pluginId: "plugin.operations.retriever", priority: 10, enabled: true, config: {} },
    { bindingId: "ops.presenter", domainId: "operations", pluginType: "tool", bindingRole: "presenter", pluginId: "plugin.operations.presenter", priority: 10, enabled: true, config: {} },
    { bindingId: "ops.validator", domainId: "operations", pluginType: "evaluator", bindingRole: "validator", pluginId: "plugin.core.basic-evaluator", priority: 5, enabled: true, config: {} },
    { bindingId: "ops.planner", domainId: "operations", pluginType: "tool", bindingRole: "planner", pluginId: "plugin.core.basic-planner", priority: 1, enabled: true, config: {} },
  ],
};
