import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import {
  seedDomainMetaModel,
  MetaModelValidator,
  type DomainMetaModel,
  type MetaModelValidationResult,
} from "./canonical-meta-model/index.js";
import { DomainDescriptorOrchestrationService, type DomainDescriptorReview } from "./domain-descriptor-orchestration-service.js";
import { DOMAIN_SEEDS, type DomainSeed } from "./domain-baseline-seeds.js";
import type { DomainEvalFramework } from "./eval-framework/index.js";
import type { DomainInteractionRule } from "./interaction-policy/index.js";
import type { DomainKnowledgeSchema } from "./knowledge-schema/index.js";
import type { DomainOnboardingChecklist } from "./domain-descriptor-orchestration-service.js";
import type { DomainPromptLibrary } from "./prompt-library/index.js";
import type { DomainRecipe } from "./recipes/index.js";
import type { DomainRiskLevel, DomainRiskProfile } from "./risk-profile/index.js";
import type { DomainGovernancePolicy } from "./governance/domain-governance-policy.js";
import { DomainRegistryService } from "./registry/domain-registry-service.js";
import type { DomainDefinition } from "./registry/domain-model.js";

export type VerticalDomainPhase = "9a" | "9b" | "9c" | "9d" | "9e" | "9f";

export type VerticalDomainId =
  | "coding"
  | "data-engineering"
  | "knowledge-base"
  | "user-operations"
  | "quant-trading"
  | "financial-services"
  | "ecommerce"
  | "advertising"
  | "industry-research"
  | "academic-research"
  | "product-management"
  | "quality-assurance"
  | "finance-accounting"
  | "legal"
  | "project-management"
  | "customer-service"
  | "it-operations"
  | "content-moderation"
  | "live-streaming"
  | "healthcare"
  | "human-resources"
  | "facilities"
  | "executive-assistant"
  | "supply-chain"
  | "education"
  | "creative-production"
  | "game-dev"
  | "game-publishing"
  | "manufacturing"
  | "agriculture"
  | "marketing";

export type LegacyVerticalDomainId =
  | "data-processing"
  | "enterprise-knowledge-base"
  | "quantitative-trading"
  | "advertising-promotion"
  | "sales"
  | "security"
  | "data-analytics"
  | "finance"
  | "online-livestream"
  | "medical-health"
  | "supply-chain-logistics"
  | "education-training"
  | "advertising-creative"
  | "game-development"
  | "marketing-brand";

export interface DomainLatencyProfile {
  readonly tier: "ultra_realtime" | "realtime" | "near_realtime" | "business_day";
  readonly targetResponseMinutes: number;
  readonly maxResponseMinutes: number;
  readonly dataSensitivity: "internal" | "confidential" | "regulated";
}

export interface DomainWorkflowSpecialization {
  readonly workflowTemplateId: string;
  readonly stageNames: readonly string[];
  readonly exitCriteria: readonly string[];
}

export interface DomainToolingSpecialization {
  readonly bundleId: string;
  readonly requiredToolNames: readonly string[];
  readonly optionalToolNames: readonly string[];
  readonly externalAdapterIds: readonly string[];
}

export interface DomainEvalSpecialization {
  readonly blockingMetricIds: readonly string[];
  readonly advisoryMetricIds: readonly string[];
}

export interface DomainOwnershipProfile {
  readonly divisionId: string;
  readonly ownerTeam: string;
  readonly escalationTeam: string;
  readonly configPath: string;
}

export interface DomainBaseline {
  readonly phase: VerticalDomainPhase;
  readonly domainId: VerticalDomainId;
  readonly legacyDomainIds: readonly LegacyVerticalDomainId[];
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
  readonly metaModel: DomainMetaModel;
  readonly metaModelValidation: MetaModelValidationResult;
  readonly workflowSpecialization: DomainWorkflowSpecialization;
  readonly toolingSpecialization: DomainToolingSpecialization;
  readonly evalSpecialization: DomainEvalSpecialization;
  readonly latencyProfile: DomainLatencyProfile;
  readonly ownershipProfile: DomainOwnershipProfile;
}

export interface VerticalDomainBootstrapResult {
  readonly domainRegistry: DomainRegistryService;
  readonly baselines: readonly DomainBaseline[];
  readonly reviews: readonly DomainDescriptorReview[];
  readonly onboardingChecklists: readonly DomainOnboardingChecklist[];
  readonly governancePolicies: readonly DomainGovernancePolicy[];
  readonly activatedDomainIds: readonly string[];
}

const REPO_ROOT_CANDIDATES = [
  resolve(process.cwd()),
  resolve(fileURLToPath(new URL("../..", import.meta.url))),
];

const LEGACY_DOMAIN_ID_ALIASES = {
  "data-processing": "data-engineering",
  "enterprise-knowledge-base": "knowledge-base",
  "quantitative-trading": "quant-trading",
  "advertising-promotion": "advertising",
  sales: "ecommerce",
  security: "content-moderation",
  "data-analytics": "data-engineering",
  finance: "finance-accounting",
  "online-livestream": "live-streaming",
  "medical-health": "healthcare",
  "supply-chain-logistics": "supply-chain",
  "education-training": "education",
  "advertising-creative": "creative-production",
  "game-development": "game-dev",
  "marketing-brand": "marketing",
} as const satisfies Record<LegacyVerticalDomainId, VerticalDomainId>;

function configPathFor(domainId: VerticalDomainId): string {
  for (const root of REPO_ROOT_CANDIDATES) {
    const candidate = resolve(root, "config", "domains", `${domainId}.json`);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return resolve(REPO_ROOT_CANDIDATES[0]!, "config", "domains", `${domainId}.json`);
}

function divisionIdFor(domainId: VerticalDomainId): string {
  if (domainId === "coding" || domainId === "game-dev") {
    return "engineering_ops";
  }
  if (domainId === "data-engineering" || domainId === "knowledge-base" || domainId === "industry-research" || domainId === "academic-research") {
    return "research";
  }
  if (domainId === "it-operations" || domainId === "supply-chain") {
    return "operations";
  }
  if (domainId === "content-moderation" || domainId === "financial-services" || domainId === "healthcare" || domainId === "legal") {
    return "security";
  }
  if (domainId === "creative-production" || domainId === "advertising" || domainId === "marketing") {
    return "content";
  }
  if (domainId === "customer-service" || domainId === "user-operations" || domainId === "live-streaming") {
    return "support";
  }
  if (domainId === "education" || domainId === "human-resources") {
    return "general_ops";
  }
  if (domainId === "finance-accounting" || domainId === "quant-trading" || domainId === "ecommerce") {
    return "analytics";
  }
  return "data";
}


function securityLevelForRisk(riskLevel: DomainRiskLevel): "standard" | "elevated" | "restricted" {
  if (riskLevel === "critical") {
    return "restricted";
  }
  if (riskLevel === "high") {
    return "elevated";
  }
  return "standard";
}

function thresholdForMetric(metric: string, riskLevel: DomainRiskLevel): number {
  if (metric.includes("safety") || metric.includes("compliance") || metric.includes("risk")) {
    return riskLevel === "critical" ? 0.96 : riskLevel === "high" ? 0.92 : 0.88;
  }
  if (metric.includes("latency")) {
    return 0.75;
  }
  return riskLevel === "critical" ? 0.85 : 0.8;
}

function buildWorkflow(seed: DomainSeed) {
  return {
    workflowId: `${seed.domainId}.primary`,
    name: `${seed.displayName} Primary Workflow`,
    triggerConditions: {
      phase: seed.phase,
      baseline: true,
      latencyTier: seed.latencyProfile.tier,
    },
    steps: seed.workflowStages.map((stageName, index) => ({
      stepName: stageName,
      toolHints: index === 0
        ? [...seed.requiredTools.slice(0, Math.min(2, seed.requiredTools.length))]
        : [...seed.requiredTools.slice(Math.max(0, index - 1), Math.max(1, index + 1))],
      modelHints: { preferredModel: "MiniMax-M2.7", temperature: seed.riskLevel === "critical" ? 0.1 : 0.2 },
      outputSchema: { type: "object", stage: stageName, domainId: seed.domainId },
      retryPolicy: { maxRetries: seed.riskLevel === "critical" ? 0 : 1, backoffMs: 1_000 + (index * 250) },
      requiresReview: seed.riskLevel === "critical" || index === seed.workflowStages.length - 1,
      timeoutMs: seed.latencyProfile.maxResponseMinutes * 60_000,
      dependsOn: index === 0 ? [] : [seed.workflowStages[index - 1]!],
    })),
  };
}

function buildRiskProfile(seed: DomainSeed): DomainRiskProfile {
  return {
    profileId: `${seed.domainId}.risk`,
    domainId: seed.domainId,
    defaultRiskLevel: seed.riskLevel,
    dimensions: [
      { dimension: "accuracy", weight: 0.3, threshold: 80, mitigation: "eval_gate" },
      { dimension: "safety", weight: 0.4, threshold: 85, mitigation: "approval_route" },
      { dimension: "cost", weight: 0.15, threshold: 75, mitigation: "budget_guard" },
      { dimension: "latency", weight: 0.15, threshold: 70, mitigation: "sla_guard" },
    ],
    regulatoryClass: seed.riskLevel === "critical" ? "heavily_regulated" : seed.riskLevel === "high" ? "regulated" : "lightly_regulated",
    timeSensitivity: seed.latencyProfile.tier === "ultra_realtime"
      ? "ultra_realtime"
      : seed.latencyProfile.tier === "realtime"
        ? "realtime"
        : "near_realtime",
    reversibility: seed.riskLevel === "critical" ? "partially_reversible" : "fully_reversible",
    blastRadius: seed.riskLevel === "critical" ? "company" : seed.riskLevel === "high" ? "department" : "team",
    riskOverrides: [
      {
        actionPattern: `${seed.domainId}.write.*`,
        baseRisk: seed.riskLevel === "critical" ? 85 : 60,
        domainRisk: seed.riskLevel === "critical" ? 95 : seed.riskLevel === "high" ? 82 : 55,
        reason: `${seed.domainId}.domain_specific_write_path`,
        requiresJustification: seed.riskLevel !== "medium",
      },
      {
        actionPattern: `${seed.domainId}.release.*`,
        baseRisk: 70,
        domainRisk: seed.riskLevel === "critical" ? 96 : 84,
        reason: `${seed.domainId}.release_requires_rollout_guard`,
        requiresJustification: true,
      },
    ],
    escalationChain: [
      { level: 1, trigger: "quality_gate_failed", target: seed.ownershipProfile.ownerTeam as unknown as "domain_owner" | "platform_sre" | "security_team" | "executive", responseSla: "30m" },
      { level: 2, trigger: "production_risk_high", target: seed.ownershipProfile.escalationTeam as unknown as "domain_owner" | "platform_sre" | "security_team" | "executive", responseSla: "15m" },
    ],
    mandatoryApprovals: [
      {
        ruleId: `${seed.domainId}.approval.release`,
        actionPattern: `${seed.domainId}.release.*`,
        requiredApprovals: seed.riskLevel === "critical" ? 2 : 1,
        approverRole: seed.riskLevel === "critical" ? "risk_committee" : "domain_owner",
      },
    ],
  };
}

function buildKnowledgeSchema(seed: DomainSeed): DomainKnowledgeSchema {
  return {
    schemaId: `${seed.domainId}.knowledge`,
    domainId: seed.domainId,
    namespaceIds: [`${seed.domainId}/default`, `${seed.domainId}/governed`],
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
}

function buildEvalFramework(seed: DomainSeed): DomainEvalFramework {
  const blockingEvaluators = seed.blockingMetrics.map((metric) => ({
    evaluatorId: `${seed.domainId}.${metric}`,
    metric,
    threshold: thresholdForMetric(metric, seed.riskLevel),
    blocking: true,
  }));
  const advisoryEvaluators = seed.advisoryMetrics.map((metric) => ({
    evaluatorId: `${seed.domainId}.${metric}`,
    metric,
    threshold: thresholdForMetric(metric, seed.riskLevel),
    blocking: false,
  }));

  return {
    frameworkId: `${seed.domainId}.eval`,
    domainId: seed.domainId,
    fewShotExamples: [
      `${seed.displayName} example 1`,
      `${seed.displayName} example 2`,
      `${seed.displayName} example 3`,
      `${seed.displayName} example 4`,
      `${seed.displayName} example 5`,
    ],
    evaluators: [...blockingEvaluators, ...advisoryEvaluators],
    onlineMetrics: [...new Set([...seed.blockingMetrics, ...seed.advisoryMetrics])],
    releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
  };
}

function buildPromptLibrary(seed: DomainSeed): DomainPromptLibrary {
  return {
    libraryId: `${seed.domainId}.prompts`,
    domainId: seed.domainId,
    prompts: [
      { promptId: `${seed.domainId}.observe`, stage: "observe", version: "v1", template: `Observe ${seed.displayName} signals.`, guardrails: [] },
      { promptId: `${seed.domainId}.assess`, stage: "assess", version: "v1", template: `Assess ${seed.displayName} context.`, guardrails: ["cite_authoritative_evidence"] },
      { promptId: `${seed.domainId}.plan`, stage: "plan", version: "v1", template: `Plan a safe ${seed.displayName} action sequence.`, guardrails: ["respect_domain_policy"] },
      { promptId: `${seed.domainId}.execute`, stage: "execute", version: "v1", template: `Execute ${seed.displayName} workflow steps conservatively.`, guardrails: ["no_unapproved_side_effects"] },
      { promptId: `${seed.domainId}.release`, stage: "release", version: "v1", template: `Summarize ${seed.displayName} release decision.`, guardrails: ["include_rollback_path"] },
    ],
  };
}

function buildRecipes(seed: DomainSeed, workflowId: string, bundleId: string): readonly DomainRecipe[] {
  return [
    {
      recipeId: `${seed.domainId}.baseline-recipe`,
      domainId: seed.domainId,
      archetype: inferRecipeArchetype(seed.tags),
      name: `${seed.displayName} Baseline Recipe`,
      description: `Baseline recipe for ${seed.displayName}.`,
      triggerPhrases: seed.tags.map((tag) => tag.replace(/-/g, " ")),
      defaultWorkflowId: workflowId,
      defaultToolBundleIds: [bundleId],
    },
  ];
}

function buildInteractionRules(seed: DomainSeed): readonly DomainInteractionRule[] {
  return [
    {
      sourceDomainId: seed.domainId,
      targetDomainId: seed.domainId,
      mode: "allow",
      maxConcurrentWorkflows: seed.riskLevel === "critical" ? 1 : 3,
      compensationRequired: seed.riskLevel === "critical",
    },
  ];
}

function buildGovernancePolicy(seed: DomainSeed): DomainGovernancePolicy {
  return {
    policyId: `${seed.domainId}.governance`,
    domainId: seed.domainId,
    ownerRoles: ["domain_owner"],
    operatorRoles: ["domain_operator"],
    approvalRoles: seed.riskLevel === "critical" ? ["risk_committee", "domain_owner"] : ["domain_owner"],
    restrictedDataClasses: [...seed.restrictedDataClasses],
    sloProfile: {},
    budgetConstraints: {},
    maxHibernationRenewals: 0,
    complianceRules: [],
    recertification: { cadence: "annual", requiredEvidence: [] },
    waiver: { allowed: false, approvalRoles: [], maxDurationDays: 30 },
    rollout: {
      strategy: seed.rolloutStrategy,
      approvalRequired: seed.riskLevel !== "medium",
      rollbackWindowMinutes: seed.riskLevel === "critical" ? 180 : 60,
    },
    mandatoryEvidence: ["risk_profile", "eval_framework", "prompt_library", "rollback_plan", "domain_config"],
  };
}

function buildDefinition(seed: DomainSeed, workflowId: string, bundleId: string, contractId: string, promptId: string): DomainDefinition {
  return {
    domainId: seed.domainId,
    name: seed.displayName,
    description: seed.description,
    version: 1,
    workflows: [buildWorkflow(seed)],
    toolBundles: [
      {
        bundleId,
        tools: [
          ...seed.requiredTools.map((toolName) => ({ toolName, enabled: true, configOverrides: { required: true } })),
          ...seed.optionalTools.map((toolName) => ({ toolName, enabled: true, configOverrides: { required: false } })),
        ],
      },
    ],
    outputContracts: [
      {
        contractId,
        name: `${seed.displayName} Result Contract`,
        schema: { type: "object", domainId: seed.domainId, workflowTemplateId: workflowId },
        validationLevel: "strict",
      },
    ],
    promptOverrides: { primary: promptId },
    capabilities: {
      supportedTaskTypes: [...seed.taskTypes],
      requiredTools: [...seed.requiredTools],
      optionalTools: [...seed.optionalTools],
      modelPreferences: { primary: "MiniMax-M2.7", fallback: "MiniMax-Text-01" },
      budgetLimits: {
        maxTokensPerTask: seed.riskLevel === "critical" ? 8_000 : 5_000,
        maxCostPerTask: seed.riskLevel === "critical" ? 8 : seed.riskLevel === "high" ? 5 : 3,
      },
      securityLevel: securityLevelForRisk(seed.riskLevel),
    },
    status: "validated",
    externalAdapters: [...seed.externalAdapters],
    pluginBindings: [],
  };
}

function inferRecipeArchetype(tags: readonly string[]) {
  if (tags.includes("realtime")) return "realtime" as const;
  if (tags.includes("trading")) return "trading" as const;
  if (tags.includes("research")) return "research" as const;
  if (tags.includes("compliance")) return "compliance" as const;
  if (tags.includes("analytics")) return "analytics" as const;
  return "crud_heavy" as const;
}

function buildDomainBaseline(seed: DomainSeed): DomainBaseline {
  const workflowId = `${seed.domainId}.primary`;
  const bundleId = `${seed.domainId}.default`;
  const contractId = `${seed.domainId}.result`;
  const promptId = `${seed.domainId}.plan`;
  const configPath = configPathFor(seed.domainId);
  const metaModel = seedDomainMetaModel({
    domainId: seed.domainId,
    displayName: seed.displayName,
    ownerOrgNodeId: seed.ownerOrgNodeId,
    taskTypes: seed.taskTypes,
    tags: seed.tags,
    riskLevel: seed.riskLevel as unknown as "high" | "medium" | "critical",
  });
  const metaModelValidation = new MetaModelValidator().validate(metaModel);

  return {
    phase: seed.phase,
    domainId: seed.domainId,
    legacyDomainIds: [...seed.legacyDomainIds],
    displayName: seed.displayName,
    ownerOrgNodeId: seed.ownerOrgNodeId,
    definition: buildDefinition(seed, workflowId, bundleId, contractId, promptId),
    riskProfile: buildRiskProfile(seed),
    knowledgeSchema: buildKnowledgeSchema(seed),
    evalFramework: buildEvalFramework(seed),
    promptLibrary: buildPromptLibrary(seed),
    recipes: buildRecipes(seed, workflowId, bundleId),
    interactionRules: buildInteractionRules(seed),
    governancePolicy: buildGovernancePolicy(seed),
    metaModel,
    metaModelValidation,
    workflowSpecialization: {
      workflowTemplateId: workflowId,
      stageNames: [...seed.workflowStages],
      exitCriteria: [`${seed.domainId}.quality_gate`, `${seed.domainId}.rollback_ready`],
    },
    toolingSpecialization: {
      bundleId,
      requiredToolNames: [...seed.requiredTools],
      optionalToolNames: [...seed.optionalTools],
      externalAdapterIds: [...seed.externalAdapters],
    },
    evalSpecialization: {
      blockingMetricIds: [...seed.blockingMetrics],
      advisoryMetricIds: [...seed.advisoryMetrics],
    },
    latencyProfile: seed.latencyProfile,
    ownershipProfile: {
      ...seed.ownershipProfile,
      divisionId: seed.ownershipProfile.divisionId || divisionIdFor(seed.domainId),
      configPath,
    },
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

export function listLegacyVerticalDomainIds(): readonly LegacyVerticalDomainId[] {
  return Object.keys(LEGACY_DOMAIN_ID_ALIASES) as LegacyVerticalDomainId[];
}

export function resolveCanonicalVerticalDomainId(domainId: VerticalDomainId | LegacyVerticalDomainId | string): VerticalDomainId | null {
  if (VERTICAL_DOMAIN_BASELINES.some((item) => item.domainId === domainId)) {
    return domainId as VerticalDomainId;
  }
  return LEGACY_DOMAIN_ID_ALIASES[domainId as LegacyVerticalDomainId] ?? null;
}

export function getVerticalDomainBaseline(domainId: VerticalDomainId | LegacyVerticalDomainId | string): DomainBaseline {
  const canonicalDomainId = resolveCanonicalVerticalDomainId(domainId);
  const baseline = canonicalDomainId == null
    ? undefined
    : VERTICAL_DOMAIN_BASELINES.find((item) => item.domainId === canonicalDomainId);
  if (baseline == null) {
    throw new Error(`vertical_domain.not_found:${domainId}`);
  }
  return baseline;
}

export function listVerticalDomainBaselinesByPhase(phase: VerticalDomainPhase): readonly DomainBaseline[] {
  return VERTICAL_DOMAIN_BASELINES.filter((item) => item.phase === phase);
}

export function listVerticalDomainConfigPaths(): readonly string[] {
  return VERTICAL_DOMAIN_BASELINES.map((baseline) => baseline.ownershipProfile.configPath);
}

export function validateVerticalDomainConfigs(): readonly string[] {
  return VERTICAL_DOMAIN_BASELINES
    .map((baseline) => baseline.ownershipProfile.configPath)
    .filter((configPath) => !existsSync(configPath));
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
      metaModelCompleteness: baseline.metaModelValidation.completeness,
      metaModelMissingQuestionIds: baseline.metaModelValidation.missingQuestionIds,
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
