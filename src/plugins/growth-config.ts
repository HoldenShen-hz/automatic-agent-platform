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
export const growthDomainDefinition: DomainDefinition = {
  domainId: "growth",
  name: "Growth",
  description: "Marketing campaign optimization, customer analytics, A/B testing, and growth experimentation for Growth and Marketing teams.",
  version: 1,
  status: "active",
  workflows: [
    {
      workflowId: "campaign_optimization",
      name: "Campaign Optimization",
      triggerConditions: {
        taskType: "campaign",
      },
      steps: [
        {
          stepName: "fetch_campaign_data",
          toolHints: ["crm_query", "analytics_fetch"],
          modelHints: { preferredModel: "MiniMax-M1", temperature: 0.3 },
          outputSchema: {
            campaignName: "string",
            reach: "string",
            conversionRate: "string",
            roas: "string",
          },
          retryPolicy: { maxRetries: 1, backoffMs: 1000 },
          requiresReview: false,
          timeoutMs: 30000,
          dependsOn: [],
        },
        {
          stepName: "analyze_variants",
          toolHints: ["abtest_query"],
          modelHints: { preferredModel: "MiniMax-M1", temperature: 0.2 },
          outputSchema: { variant: "string", lift: "string", confidence: "string" },
          retryPolicy: { maxRetries: 0, backoffMs: 0 },
          requiresReview: true,
          timeoutMs: 45000,
          dependsOn: ["fetch_campaign_data"],
        },
        {
          stepName: "recommend_optimizations",
          toolHints: ["summarize"],
          modelHints: { preferredModel: "MiniMax-M1", temperature: 0.4 },
          outputSchema: { recommendations: "array", priority: "array" },
          retryPolicy: { maxRetries: 0, backoffMs: 0 },
          requiresReview: true,
          timeoutMs: 30000,
          dependsOn: ["analyze_variants"],
        },
      ],
    },
    {
      workflowId: "customer_analytics",
      name: "Customer Analytics",
      triggerConditions: {
        taskType: "analytics",
      },
      steps: [
        {
          stepName: "query_customer_segments",
          toolHints: ["crm_query"],
          modelHints: { preferredModel: "MiniMax-M1", temperature: 0.2 },
          outputSchema: { segments: "array", cohortData: "object" },
          retryPolicy: { maxRetries: 1, backoffMs: 2000 },
          requiresReview: false,
          timeoutMs: 20000,
          dependsOn: [],
        },
        {
          stepName: "analyze_funnel",
          toolHints: ["analytics_fetch"],
          modelHints: { preferredModel: "MiniMax-M1", temperature: 0.3 },
          outputSchema: { funnelStages: "array", dropoffRates: "array" },
          retryPolicy: { maxRetries: 0, backoffMs: 0 },
          requiresReview: false,
          timeoutMs: 30000,
          dependsOn: ["query_customer_segments"],
        },
      ],
    },
    {
      workflowId: "growth_experiment",
      name: "Growth Experiment Design",
      triggerConditions: {
        taskType: "experiment",
      },
      steps: [
        {
          stepName: "research_playbooks",
          toolHints: ["knowledge_retrieve"],
          modelHints: { preferredModel: "MiniMax-M1", temperature: 0.4 },
          outputSchema: { relevantPlaybooks: "array", applicableContexts: "array" },
          retryPolicy: { maxRetries: 0, backoffMs: 0 },
          requiresReview: false,
          timeoutMs: 15000,
          dependsOn: [],
        },
        {
          stepName: "design_experiment",
          toolHints: ["plan"],
          modelHints: { preferredModel: "MiniMax-M1", temperature: 0.3 },
          outputSchema: { hypothesis: "string", testDesign: "object", sampleSize: "number" },
          retryPolicy: { maxRetries: 1, backoffMs: 1000 },
          requiresReview: true,
          timeoutMs: 45000,
          dependsOn: ["research_playbooks"],
        },
      ],
    },
  ],
  toolBundles: [
    {
      bundleId: "growth-core",
      tools: [
        { toolName: "crm_query", enabled: true, configOverrides: {} },
        { toolName: "analytics_fetch", enabled: true, configOverrides: {} },
        { toolName: "abtest_query", enabled: true, configOverrides: {} },
        { toolName: "knowledge_retrieve", enabled: true, configOverrides: {} },
        { toolName: "summarize", enabled: true, configOverrides: {} },
      ],
    },
  ],
  outputContracts: [
    {
      contractId: "growth.campaign_optimization",
      name: "Campaign Optimization Output",
      schema: {
        recommendations: "array",
        priority: "array",
        rationale: "string",
      },
      validationLevel: "lenient",
    },
    {
      contractId: "growth.customer_analytics",
      name: "Customer Analytics Output",
      schema: {
        segments: "array",
        funnelStages: "array",
        dropoffRates: "array",
      },
      validationLevel: "strict",
    },
    {
      contractId: "growth.growth_experiment",
      name: "Growth Experiment Output",
      schema: {
        hypothesis: "string",
        testDesign: "object",
        sampleSize: "number",
      },
      validationLevel: "strict",
    },
  ],
  promptOverrides: {
    system: "You are a Growth AI assisting Marketing and Growth teams with campaign optimization, customer analytics, and experiment design. Be data-driven, cite metrics, and prioritize measurable impact.",
  },
  capabilities: {
    supportedTaskTypes: ["campaign", "analytics", "experiment", "ab_test", "cohort_analysis"],
    requiredTools: ["crm_query", "analytics_fetch", "knowledge_retrieve"],
    optionalTools: ["abtest_query", "summarize", "plan"],
    modelPreferences: {
      "campaign_optimization": "MiniMax-M1",
      "customer_analytics": "MiniMax-M1",
      "growth_experiment": "MiniMax-M1",
    },
    budgetLimits: {
      maxTokensPerTask: 8000,
      maxCostPerTask: 3.0,
    },
    securityLevel: "standard",
  },
  externalAdapters: ["github", "jira", "crm"],
  pluginBindings: [
    { bindingId: "growth.retriever", domainId: "growth", pluginType: "retriever", pluginId: "plugin.growth.retriever", priority: 10, enabled: true, config: {} },
    { bindingId: "growth.presenter", domainId: "growth", pluginType: "tool", bindingRole: "presenter", pluginId: "plugin.growth.presenter", priority: 10, enabled: true, config: {} },
    { bindingId: "growth.validator", domainId: "growth", pluginType: "evaluator", bindingRole: "validator", pluginId: "plugin.core.basic-evaluator", priority: 5, enabled: true, config: {} },
    { bindingId: "growth.planner", domainId: "growth", pluginType: "tool", bindingRole: "planner", pluginId: "plugin.core.basic-planner", priority: 1, enabled: true, config: {} },
  ],
};
