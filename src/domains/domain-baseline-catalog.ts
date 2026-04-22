import type { DomainDefinition } from "./registry/domain-model.js";
import { DomainDescriptorOrchestrationService, type DomainDescriptorReview } from "./domain-descriptor-orchestration-service.js";
import type { DomainEvalFramework } from "./eval-framework/index.js";
import type { DomainInteractionRule } from "./interaction-policy/index.js";
import type { DomainKnowledgeSchema } from "./knowledge-schema/index.js";
import type { DomainOnboardingChecklist } from "./domain-descriptor-orchestration-service.js";
import type { DomainPromptLibrary } from "./prompt-library/index.js";
import type { DomainRecipe } from "./recipes/index.js";
import type { DomainRiskLevel, DomainRiskProfile } from "./risk-profile/index.js";
import type { DomainGovernancePolicy } from "./governance/domain-governance-policy.js";
import { DomainRegistryService } from "./registry/domain-registry-service.js";

export type VerticalDomainPhase = "9a" | "9b" | "9c" | "9d" | "9e" | "9f";

export type VerticalDomainId =
  | "coding"
  | "data-processing"
  | "enterprise-knowledge-base"
  | "user-operations"
  | "quantitative-trading"
  | "financial-services"
  | "ecommerce"
  | "advertising-promotion"
  | "industry-research"
  | "academic-research"
  | "finance"
  | "legal"
  | "customer-service"
  | "it-operations"
  | "content-moderation"
  | "online-livestream"
  | "medical-health"
  | "human-resources"
  | "supply-chain-logistics"
  | "education-training"
  | "advertising-creative"
  | "game-development"
  | "game-publishing"
  | "marketing-brand";

export interface DomainBaseline {
  readonly phase: VerticalDomainPhase;
  readonly domainId: VerticalDomainId;
  readonly displayName: string;
  readonly ownerOrgNodeId: string;
  readonly definition: DomainDefinition;
  readonly riskProfile: DomainRiskProfile;
  readonly knowledgeSchema: DomainKnowledgeSchema;
  readonly evalFramework: DomainEvalFramework;
  readonly promptLibrary: DomainPromptLibrary;
  readonly recipes: readonly DomainRecipe[];
  readonly interactionRules: readonly DomainInteractionRule[];
  readonly governancePolicy: DomainGovernancePolicy;
}

export interface VerticalDomainBootstrapResult {
  readonly domainRegistry: DomainRegistryService;
  readonly baselines: readonly DomainBaseline[];
  readonly reviews: readonly DomainDescriptorReview[];
  readonly onboardingChecklists: readonly DomainOnboardingChecklist[];
  readonly governancePolicies: readonly DomainGovernancePolicy[];
  readonly activatedDomainIds: readonly string[];
}

interface DomainSeed {
  readonly phase: VerticalDomainPhase;
  readonly domainId: VerticalDomainId;
  readonly displayName: string;
  readonly description: string;
  readonly riskLevel: DomainRiskLevel;
  readonly ownerOrgNodeId: string;
  readonly taskTypes: readonly string[];
  readonly namespace: string;
  readonly tags: readonly string[];
}

const DOMAIN_SEEDS: readonly DomainSeed[] = [
  { phase: "9a", domainId: "coding", displayName: "Coding", description: "Software change delivery and code lifecycle execution.", riskLevel: "high", ownerOrgNodeId: "org.eng", taskTypes: ["analyze", "implement", "test"], namespace: "coding/default", tags: ["engineering", "code"] },
  { phase: "9a", domainId: "data-processing", displayName: "Data Processing", description: "Structured and batch data transformation workflows.", riskLevel: "medium", ownerOrgNodeId: "org.data", taskTypes: ["ingest", "clean", "transform"], namespace: "data-processing/default", tags: ["data", "etl"] },
  { phase: "9a", domainId: "enterprise-knowledge-base", displayName: "Enterprise Knowledge Base", description: "Enterprise documentation, retrieval, and knowledge curation.", riskLevel: "medium", ownerOrgNodeId: "org.knowledge", taskTypes: ["ingest", "search", "curate"], namespace: "enterprise-knowledge-base/default", tags: ["knowledge", "retrieval"] },
  { phase: "9a", domainId: "user-operations", displayName: "User Operations", description: "Lifecycle operations for user cohorts and growth execution.", riskLevel: "medium", ownerOrgNodeId: "org.growth", taskTypes: ["segment", "operate", "follow-up"], namespace: "user-operations/default", tags: ["growth", "ops"] },
  { phase: "9b", domainId: "quantitative-trading", displayName: "Quantitative Trading", description: "Quant strategy research, simulation, and guarded order automation.", riskLevel: "critical", ownerOrgNodeId: "org.trading", taskTypes: ["research", "simulate", "trade"], namespace: "quantitative-trading/default", tags: ["trading", "finance"] },
  { phase: "9b", domainId: "financial-services", displayName: "Financial Services", description: "Customer-facing and regulated financial service workflows.", riskLevel: "critical", ownerOrgNodeId: "org.finserv", taskTypes: ["review", "advise", "execute"], namespace: "financial-services/default", tags: ["finance", "regulated"] },
  { phase: "9b", domainId: "ecommerce", displayName: "Ecommerce", description: "Catalog, order, and merchandising operations.", riskLevel: "high", ownerOrgNodeId: "org.commerce", taskTypes: ["catalog", "pricing", "order"], namespace: "ecommerce/default", tags: ["commerce", "retail"] },
  { phase: "9b", domainId: "advertising-promotion", displayName: "Advertising Promotion", description: "Campaign planning, audience targeting, and budget governance.", riskLevel: "high", ownerOrgNodeId: "org.ads", taskTypes: ["plan", "launch", "optimize"], namespace: "advertising-promotion/default", tags: ["ads", "campaign"] },
  { phase: "9c", domainId: "industry-research", displayName: "Industry Research", description: "Structured market and industry analysis workflows.", riskLevel: "medium", ownerOrgNodeId: "org.strategy", taskTypes: ["research", "summarize", "brief"], namespace: "industry-research/default", tags: ["research", "industry"] },
  { phase: "9c", domainId: "academic-research", displayName: "Academic Research", description: "Literature collection, evaluation, and synthesis pipelines.", riskLevel: "medium", ownerOrgNodeId: "org.research", taskTypes: ["collect", "evaluate", "synthesize"], namespace: "academic-research/default", tags: ["research", "academic"] },
  { phase: "9c", domainId: "finance", displayName: "Finance", description: "Internal finance operations, reporting, and close workflows.", riskLevel: "high", ownerOrgNodeId: "org.finance", taskTypes: ["reconcile", "report", "forecast"], namespace: "finance/default", tags: ["finance", "accounting"] },
  { phase: "9c", domainId: "legal", displayName: "Legal", description: "Contract review, policy mapping, and legal operations support.", riskLevel: "critical", ownerOrgNodeId: "org.legal", taskTypes: ["review", "redline", "advise"], namespace: "legal/default", tags: ["legal", "contracts"] },
  { phase: "9d", domainId: "customer-service", displayName: "Customer Service", description: "Customer support triage, response generation, and escalation.", riskLevel: "medium", ownerOrgNodeId: "org.support", taskTypes: ["triage", "respond", "escalate"], namespace: "customer-service/default", tags: ["support", "service"] },
  { phase: "9d", domainId: "it-operations", displayName: "IT Operations", description: "IT operations, incident handling, and runbook execution.", riskLevel: "high", ownerOrgNodeId: "org.itops", taskTypes: ["detect", "mitigate", "recover"], namespace: "it-operations/default", tags: ["itops", "incident"] },
  { phase: "9d", domainId: "content-moderation", displayName: "Content Moderation", description: "Policy-based moderation and escalation workflows.", riskLevel: "high", ownerOrgNodeId: "org.safety", taskTypes: ["classify", "moderate", "escalate"], namespace: "content-moderation/default", tags: ["moderation", "safety"] },
  { phase: "9d", domainId: "online-livestream", displayName: "Online Livestream", description: "Livestream planning, moderation, and incident response.", riskLevel: "high", ownerOrgNodeId: "org.live", taskTypes: ["prepare", "moderate", "respond"], namespace: "online-livestream/default", tags: ["livestream", "ops"] },
  { phase: "9e", domainId: "medical-health", displayName: "Medical Health", description: "Healthcare workflow assistance under strict governance.", riskLevel: "critical", ownerOrgNodeId: "org.health", taskTypes: ["triage", "summarize", "coordinate"], namespace: "medical-health/default", tags: ["health", "regulated"] },
  { phase: "9e", domainId: "human-resources", displayName: "Human Resources", description: "Employee lifecycle, policy, and people-ops workflows.", riskLevel: "high", ownerOrgNodeId: "org.hr", taskTypes: ["screen", "review", "coordinate"], namespace: "human-resources/default", tags: ["hr", "people"] },
  { phase: "9e", domainId: "supply-chain-logistics", displayName: "Supply Chain Logistics", description: "Supply chain planning, logistics coordination, and exception handling.", riskLevel: "high", ownerOrgNodeId: "org.supply", taskTypes: ["plan", "route", "resolve"], namespace: "supply-chain-logistics/default", tags: ["supply", "logistics"] },
  { phase: "9e", domainId: "education-training", displayName: "Education Training", description: "Learning design, learner support, and training operations.", riskLevel: "medium", ownerOrgNodeId: "org.education", taskTypes: ["design", "coach", "assess"], namespace: "education-training/default", tags: ["education", "training"] },
  { phase: "9f", domainId: "advertising-creative", displayName: "Advertising Creative", description: "Creative production for ad assets and campaign content.", riskLevel: "medium", ownerOrgNodeId: "org.creative", taskTypes: ["concept", "draft", "iterate"], namespace: "advertising-creative/default", tags: ["creative", "ads"] },
  { phase: "9f", domainId: "game-development", displayName: "Game Development", description: "Game production, content iteration, and build workflows.", riskLevel: "medium", ownerOrgNodeId: "org.games", taskTypes: ["design", "build", "verify"], namespace: "game-development/default", tags: ["games", "development"] },
  { phase: "9f", domainId: "game-publishing", displayName: "Game Publishing", description: "Release packaging, compliance checks, and store readiness.", riskLevel: "high", ownerOrgNodeId: "org.games", taskTypes: ["package", "review", "release"], namespace: "game-publishing/default", tags: ["games", "publishing"] },
  { phase: "9f", domainId: "marketing-brand", displayName: "Marketing Brand", description: "Brand marketing planning, execution, and performance analysis.", riskLevel: "medium", ownerOrgNodeId: "org.marketing", taskTypes: ["plan", "publish", "measure"], namespace: "marketing-brand/default", tags: ["marketing", "brand"] },
];

function securityLevelForRisk(riskLevel: DomainRiskLevel): "standard" | "elevated" | "restricted" {
  if (riskLevel === "critical") {
    return "restricted";
  }
  if (riskLevel === "high") {
    return "elevated";
  }
  return "standard";
}

function buildDomainBaseline(seed: DomainSeed): DomainBaseline {
  const workflowId = `${seed.domainId}.primary`;
  const bundleId = `${seed.domainId}.default`;
  const contractId = `${seed.domainId}.result`;
  const promptId = `${seed.domainId}.plan`;
  const riskProfile: DomainRiskProfile = {
    profileId: `${seed.domainId}.risk`,
    domainId: seed.domainId,
    defaultRiskLevel: seed.riskLevel,
    dimensions: [
      { dimension: "accuracy", weight: 0.35, threshold: 80, mitigation: "eval_gate" },
      { dimension: "safety", weight: 0.4, threshold: 85, mitigation: "approval_route" },
      { dimension: "cost", weight: 0.25, threshold: 75, mitigation: "budget_guard" },
    ],
    regulatoryClass: seed.riskLevel === "critical" ? "heavily_regulated" : seed.riskLevel === "high" ? "regulated" : "lightly_regulated",
    timeSensitivity: seed.domainId === "quantitative-trading" ? "ultra_realtime" : seed.domainId === "it-operations" ? "realtime" : "near_realtime",
    reversibility: seed.riskLevel === "critical" ? "partially_reversible" : "fully_reversible",
    blastRadius: seed.riskLevel === "critical" ? "company" : seed.riskLevel === "high" ? "department" : "team",
    riskOverrides: [
      {
        actionPattern: `${seed.domainId}:write`,
        baseRisk: seed.riskLevel === "critical" ? 88 : 60,
        domainRisk: seed.riskLevel === "critical" ? 95 : seed.riskLevel === "high" ? 82 : 48,
        reason: "domain_specific_write_path",
        requiresJustification: seed.riskLevel !== "medium",
      },
    ],
    escalationChain: [
      { level: 1, trigger: "quality_gate_failed", target: "domain_owner", responseSla: "30m" },
      { level: 2, trigger: "production_risk_high", target: "platform_sre", responseSla: "15m" },
    ],
    mandatoryApprovals: [
      {
        ruleId: `${seed.domainId}.approval.release`,
        actionPattern: `${seed.domainId}:release`,
        requiredApprovals: seed.riskLevel === "critical" ? 2 : 1,
        approverRole: seed.riskLevel === "critical" ? "risk_committee" : "domain_owner",
      },
    ],
  };

  const knowledgeSchema: DomainKnowledgeSchema = {
    schemaId: `${seed.domainId}.knowledge`,
    domainId: seed.domainId,
    namespaceIds: [seed.namespace],
    freshnessWindowHours: seed.riskLevel === "critical" ? 4 : 24,
    conflictResolution: "trust_priority",
    retentionDays: seed.riskLevel === "critical" ? 90 : 30,
    knowledgeSources: [
      {
        sourceId: `${seed.domainId}.primary-source`,
        type: "structured_kb",
        priority: 90,
        refreshInterval: seed.riskLevel === "critical" ? "1h" : "1d",
        authScope: `${seed.domainId}.read`,
        endpoint: `internal://${seed.domainId}/knowledge`,
      },
    ],
    retrievalStrategy: { strategy: "hybrid", maxResults: 8, minRelevanceScore: 0.72, rerankEnabled: true },
    freshnessPolicy: { maxStalenessHours: seed.riskLevel === "critical" ? 4 : 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
  };

  const evalFramework: DomainEvalFramework = {
    frameworkId: `${seed.domainId}.eval`,
    domainId: seed.domainId,
    fewShotExamples: [
      `${seed.displayName} example 1`,
      `${seed.displayName} example 2`,
      `${seed.displayName} example 3`,
      `${seed.displayName} example 4`,
      `${seed.displayName} example 5`,
    ],
    evaluators: [
      { evaluatorId: `${seed.domainId}.quality`, metric: "quality", threshold: 0.82, blocking: true },
      { evaluatorId: `${seed.domainId}.safety`, metric: "safety", threshold: 0.9, blocking: true },
      { evaluatorId: `${seed.domainId}.cost`, metric: "cost", threshold: 0.65, blocking: false },
    ],
    onlineMetrics: ["quality", "safety", "latency"],
    releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
  };

  const promptLibrary: DomainPromptLibrary = {
    libraryId: `${seed.domainId}.prompts`,
    domainId: seed.domainId,
    prompts: [
      { promptId: `${seed.domainId}.observe`, stage: "observe", version: "v1", template: `Observe ${seed.displayName} signals.`, guardrails: [] },
      { promptId: `${seed.domainId}.assess`, stage: "assess", version: "v1", template: `Assess ${seed.displayName} context.`, guardrails: ["cite_authoritative_evidence"] },
      { promptId, stage: "plan", version: "v1", template: `Plan a safe ${seed.displayName} action sequence.`, guardrails: ["respect_domain_policy"] },
      { promptId: `${seed.domainId}.execute`, stage: "execute", version: "v1", template: `Execute ${seed.displayName} steps conservatively.`, guardrails: ["no_unapproved_side_effects"] },
      { promptId: `${seed.domainId}.release`, stage: "release", version: "v1", template: `Summarize ${seed.displayName} release decision.`, guardrails: ["include_rollback_path"] },
    ],
  };

  const recipes: readonly DomainRecipe[] = [
    {
      recipeId: `${seed.domainId}.default-recipe`,
      domainId: seed.domainId,
      name: `${seed.displayName} Baseline Recipe`,
      description: `Baseline recipe for ${seed.displayName}.`,
      triggerPhrases: seed.tags.map((tag) => tag.replace(/-/g, " ")),
      defaultWorkflowId: workflowId,
      defaultToolBundleIds: [bundleId],
    },
  ];

  const interactionRules: readonly DomainInteractionRule[] = [
    {
      sourceDomainId: seed.domainId,
      targetDomainId: seed.domainId,
      mode: "allow",
      maxConcurrentWorkflows: seed.riskLevel === "critical" ? 1 : 3,
      compensationRequired: seed.riskLevel === "critical",
    },
  ];

  const governancePolicy: DomainGovernancePolicy = {
    policyId: `${seed.domainId}.governance`,
    domainId: seed.domainId,
    ownerRoles: ["domain_owner"],
    operatorRoles: ["domain_operator"],
    approvalRoles: seed.riskLevel === "critical" ? ["risk_committee", "domain_owner"] : ["domain_owner"],
    restrictedDataClasses: seed.riskLevel === "critical" ? ["sensitive", "regulated"] : seed.riskLevel === "high" ? ["internal"] : [],
    rollout: {
      strategy: seed.riskLevel === "critical" ? "shadow" : seed.riskLevel === "high" ? "canary" : "supervised_auto",
      approvalRequired: seed.riskLevel !== "medium",
      rollbackWindowMinutes: seed.riskLevel === "critical" ? 180 : 60,
    },
    mandatoryEvidence: ["risk_profile", "eval_framework", "prompt_library", "rollback_plan"],
  };

  const definition: DomainDefinition = {
    domainId: seed.domainId,
    name: seed.displayName,
    description: seed.description,
    version: 1,
    workflows: [
      {
        workflowId,
        name: `${seed.displayName} Primary Workflow`,
        triggerConditions: { phase: seed.phase, baseline: true },
        steps: [
          {
            stepName: "intake",
            toolHints: ["read"],
            modelHints: { preferredModel: "gpt-5.2", temperature: 0.2 },
            outputSchema: { type: "object", stage: "intake" },
            retryPolicy: { maxRetries: 1, backoffMs: 1000 },
            requiresReview: false,
            timeoutMs: 60_000,
            dependsOn: [],
          },
          {
            stepName: "deliver",
            toolHints: ["summarize"],
            modelHints: { preferredModel: "gpt-5.2", temperature: 0.1 },
            outputSchema: { type: "object", stage: "deliver" },
            retryPolicy: { maxRetries: 1, backoffMs: 1500 },
            requiresReview: seed.riskLevel === "critical",
            timeoutMs: 90_000,
            dependsOn: ["intake"],
          },
        ],
      },
    ],
    toolBundles: [
      {
        bundleId,
        tools: [
          { toolName: "read", enabled: true, configOverrides: {} },
          { toolName: "summarize", enabled: true, configOverrides: {} },
        ],
      },
    ],
    outputContracts: [
      {
        contractId,
        name: `${seed.displayName} Result Contract`,
        schema: { type: "object", domainId: seed.domainId },
        validationLevel: "strict",
      },
    ],
    promptOverrides: {
      primary: promptId,
    },
    capabilities: {
      supportedTaskTypes: [...seed.taskTypes],
      requiredTools: ["read"],
      optionalTools: ["summarize"],
      modelPreferences: { primary: "gpt-5.2", fallback: "gpt-5.4-mini" },
      budgetLimits: {
        maxTokensPerTask: seed.riskLevel === "critical" ? 8000 : 5000,
        maxCostPerTask: seed.riskLevel === "critical" ? 8 : seed.riskLevel === "high" ? 5 : 3,
      },
      securityLevel: securityLevelForRisk(seed.riskLevel),
    },
    status: "testing",
    externalAdapters: [],
    pluginBindings: [],
  };

  return {
    phase: seed.phase,
    domainId: seed.domainId,
    displayName: seed.displayName,
    ownerOrgNodeId: seed.ownerOrgNodeId,
    definition,
    riskProfile,
    knowledgeSchema,
    evalFramework,
    promptLibrary,
    recipes,
    interactionRules,
    governancePolicy,
  };
}

export const VERTICAL_DOMAIN_BASELINES: readonly DomainBaseline[] = Object.freeze(
  DOMAIN_SEEDS.map((seed) => buildDomainBaseline(seed)),
);

export function listVerticalDomainBaselines(): readonly DomainBaseline[] {
  return VERTICAL_DOMAIN_BASELINES;
}

export function listVerticalDomainIds(): readonly VerticalDomainId[] {
  return VERTICAL_DOMAIN_BASELINES.map((item) => item.domainId);
}

export function getVerticalDomainBaseline(domainId: VerticalDomainId): DomainBaseline {
  const baseline = VERTICAL_DOMAIN_BASELINES.find((item) => item.domainId === domainId);
  if (baseline == null) {
    throw new Error(`vertical_domain.not_found:${domainId}`);
  }
  return baseline;
}

export function listVerticalDomainBaselinesByPhase(phase: VerticalDomainPhase): readonly DomainBaseline[] {
  return VERTICAL_DOMAIN_BASELINES.filter((item) => item.phase === phase);
}

export function bootstrapVerticalDomainBaselines(domainRegistry: DomainRegistryService = new DomainRegistryService()): VerticalDomainBootstrapResult {
  const descriptorService = new DomainDescriptorOrchestrationService();
  const activatedDomainIds: string[] = [];
  const reviews: DomainDescriptorReview[] = [];
  const onboardingChecklists: DomainOnboardingChecklist[] = [];

  for (const baseline of VERTICAL_DOMAIN_BASELINES) {
    if (domainRegistry.get(baseline.domainId) == null) {
      domainRegistry.register(baseline.definition);
    }
    for (const namespace of baseline.knowledgeSchema.namespaceIds) {
      domainRegistry.registerKnowledgeNamespace(namespace, baseline.domainId);
    }
    if (domainRegistry.get(baseline.domainId)?.status !== "active") {
      domainRegistry.activate(baseline.domainId);
    }
    activatedDomainIds.push(baseline.domainId);
    reviews.push(descriptorService.review({
      domainId: baseline.domainId,
      displayName: baseline.displayName,
      description: baseline.definition.description,
      ownerOrgNodeId: baseline.ownerOrgNodeId,
      lifecycleState: "canary",
      version: baseline.definition.version,
      riskProfile: baseline.riskProfile,
      knowledgeSchema: baseline.knowledgeSchema,
      evalFramework: baseline.evalFramework,
      promptLibrary: baseline.promptLibrary,
      recipes: baseline.recipes,
      interactionRules: baseline.interactionRules,
      defaultToolBundleIds: baseline.definition.toolBundles.map((bundle) => bundle.bundleId),
      defaultWorkflowIds: baseline.definition.workflows.map((workflow) => workflow.workflowId),
    }));
    onboardingChecklists.push(descriptorService.buildOnboardingChecklist(baseline.domainId));
  }

  return {
    domainRegistry,
    baselines: VERTICAL_DOMAIN_BASELINES,
    reviews,
    onboardingChecklists,
    governancePolicies: VERTICAL_DOMAIN_BASELINES.map((item) => item.governancePolicy),
    activatedDomainIds,
  };
}
