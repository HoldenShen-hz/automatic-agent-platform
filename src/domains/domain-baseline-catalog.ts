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
  | "finance-accounting"
  | "legal"
  | "customer-service"
  | "it-operations"
  | "content-moderation"
  | "live-streaming"
  | "healthcare"
  | "human-resources"
  | "supply-chain"
  | "education"
  | "creative-production"
  | "game-dev"
  | "game-publishing"
  | "marketing";

export type LegacyVerticalDomainId =
  | "data-processing"
  | "enterprise-knowledge-base"
  | "quantitative-trading"
  | "advertising-promotion"
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

interface DomainSeed {
  readonly phase: VerticalDomainPhase;
  readonly domainId: VerticalDomainId;
  readonly legacyDomainIds: readonly LegacyVerticalDomainId[];
  readonly displayName: string;
  readonly description: string;
  readonly riskLevel: DomainRiskLevel;
  readonly ownerOrgNodeId: string;
  readonly taskTypes: readonly string[];
  readonly tags: readonly string[];
  readonly workflowStages: readonly string[];
  readonly requiredTools: readonly string[];
  readonly optionalTools: readonly string[];
  readonly externalAdapters: readonly string[];
  readonly blockingMetrics: readonly string[];
  readonly advisoryMetrics: readonly string[];
  readonly latencyProfile: DomainLatencyProfile;
  readonly ownershipProfile: Omit<DomainOwnershipProfile, "configPath">;
  readonly rolloutStrategy: DomainGovernancePolicy["rollout"]["strategy"];
  readonly restrictedDataClasses: readonly string[];
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

const DOMAIN_SEEDS: readonly DomainSeed[] = [
  {
    phase: "9a",
    domainId: "coding",
    legacyDomainIds: [],
    displayName: "Coding",
    description: "Software change delivery and code lifecycle execution.",
    riskLevel: "high",
    ownerOrgNodeId: "org.eng",
    taskTypes: ["analyze", "implement", "test"],
    tags: ["engineering", "code"],
    workflowStages: ["scope_change", "implement_patch", "run_validation", "prepare_release_notes"],
    requiredTools: ["repo_map", "patch_apply", "test_runner"],
    optionalTools: ["static_analysis", "dependency_graph"],
    externalAdapters: ["github", "ci"],
    blockingMetrics: ["quality", "regression_rate"],
    advisoryMetrics: ["latency", "cost"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 15, maxResponseMinutes: 120, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "engineering_ops", ownerTeam: "eng-platform", escalationTeam: "eng-release" },
    rolloutStrategy: "canary",
    restrictedDataClasses: ["internal"],
  },
  {
    phase: "9a",
    domainId: "data-engineering",
    legacyDomainIds: ["data-processing"],
    displayName: "Data Engineering",
    description: "Structured ingestion, transformation, and governed dataset delivery.",
    riskLevel: "medium",
    ownerOrgNodeId: "org.data",
    taskTypes: ["ingest", "clean", "transform"],
    tags: ["data", "etl"],
    workflowStages: ["profile_source", "transform_dataset", "validate_lineage", "publish_dataset"],
    requiredTools: ["schema_registry", "pipeline_runner", "lineage_tracker"],
    optionalTools: ["quality_monitor", "warehouse_query"],
    externalAdapters: ["warehouse", "object-storage"],
    blockingMetrics: ["data_freshness", "schema_validity"],
    advisoryMetrics: ["cost", "throughput"],
    latencyProfile: { tier: "business_day", targetResponseMinutes: 240, maxResponseMinutes: 1440, dataSensitivity: "internal" },
    ownershipProfile: { divisionId: "data", ownerTeam: "data-platform", escalationTeam: "data-governance" },
    rolloutStrategy: "supervised_auto",
    restrictedDataClasses: [],
  },
  {
    phase: "9a",
    domainId: "knowledge-base",
    legacyDomainIds: ["enterprise-knowledge-base"],
    displayName: "Knowledge Base",
    description: "Enterprise documentation, retrieval, and curated knowledge delivery.",
    riskLevel: "medium",
    ownerOrgNodeId: "org.knowledge",
    taskTypes: ["ingest", "search", "curate"],
    tags: ["knowledge", "retrieval"],
    workflowStages: ["collect_sources", "normalize_documents", "index_chunks", "publish_answers"],
    requiredTools: ["document_ingest", "retrieval_index", "citation_builder"],
    optionalTools: ["taxonomy_mapper", "quality_monitor"],
    externalAdapters: ["notion", "wiki"],
    blockingMetrics: ["citation_coverage", "freshness"],
    advisoryMetrics: ["answer_latency", "cost"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 20, maxResponseMinutes: 240, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "research", ownerTeam: "knowledge-ops", escalationTeam: "knowledge-governance" },
    rolloutStrategy: "supervised_auto",
    restrictedDataClasses: ["internal"],
  },
  {
    phase: "9a",
    domainId: "user-operations",
    legacyDomainIds: [],
    displayName: "User Operations",
    description: "Lifecycle operations for user cohorts and growth execution.",
    riskLevel: "medium",
    ownerOrgNodeId: "org.growth",
    taskTypes: ["segment", "operate", "follow-up"],
    tags: ["growth", "ops"],
    workflowStages: ["segment_users", "compose_campaign", "schedule_touchpoints", "measure_lift"],
    requiredTools: ["crm_sync", "segment_builder", "journey_scheduler"],
    optionalTools: ["experiment_tracker", "content_generator"],
    externalAdapters: ["crm", "messaging"],
    blockingMetrics: ["opt_in_compliance", "delivery_success"],
    advisoryMetrics: ["conversion_lift", "latency"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 30, maxResponseMinutes: 480, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "support", ownerTeam: "growth-ops", escalationTeam: "growth-risk" },
    rolloutStrategy: "supervised_auto",
    restrictedDataClasses: ["internal"],
  },
  {
    phase: "9b",
    domainId: "quant-trading",
    legacyDomainIds: ["quantitative-trading"],
    displayName: "Quant Trading",
    description: "Quant strategy research, simulation, and guarded order automation.",
    riskLevel: "critical",
    ownerOrgNodeId: "org.trading",
    taskTypes: ["research", "simulate", "trade"],
    tags: ["trading", "finance"],
    workflowStages: ["ingest_market_data", "run_strategy_backtest", "check_risk_limits", "prepare_order_ticket"],
    requiredTools: ["market_data", "strategy_backtester", "risk_calculator", "order_execution"],
    optionalTools: ["portfolio_analyzer", "trade_journal"],
    externalAdapters: ["exchange", "market-data-feed"],
    blockingMetrics: ["sharpe_ratio", "max_drawdown", "pre_trade_risk"],
    advisoryMetrics: ["fill_rate", "latency"],
    latencyProfile: { tier: "ultra_realtime", targetResponseMinutes: 1, maxResponseMinutes: 5, dataSensitivity: "regulated" },
    ownershipProfile: { divisionId: "analytics", ownerTeam: "quant-research", escalationTeam: "trading-risk" },
    rolloutStrategy: "shadow",
    restrictedDataClasses: ["regulated", "sensitive"],
  },
  {
    phase: "9b",
    domainId: "financial-services",
    legacyDomainIds: [],
    displayName: "Financial Services",
    description: "Customer-facing and regulated financial service workflows.",
    riskLevel: "critical",
    ownerOrgNodeId: "org.finserv",
    taskTypes: ["review", "advise", "execute"],
    tags: ["finance", "regulated"],
    workflowStages: ["collect_customer_context", "perform_policy_checks", "prepare_advice_packet", "route_for_approval"],
    requiredTools: ["policy_checker", "case_manager", "decision_trace"],
    optionalTools: ["kyc_lookup", "pricing_engine"],
    externalAdapters: ["core-banking", "crm"],
    blockingMetrics: ["policy_compliance", "suitability"],
    advisoryMetrics: ["sla_breach_rate", "cost"],
    latencyProfile: { tier: "realtime", targetResponseMinutes: 10, maxResponseMinutes: 60, dataSensitivity: "regulated" },
    ownershipProfile: { divisionId: "security", ownerTeam: "finserv-ops", escalationTeam: "compliance-office" },
    rolloutStrategy: "shadow",
    restrictedDataClasses: ["regulated", "sensitive"],
  },
  {
    phase: "9b",
    domainId: "ecommerce",
    legacyDomainIds: [],
    displayName: "Ecommerce",
    description: "Catalog, order, and merchandising operations.",
    riskLevel: "high",
    ownerOrgNodeId: "org.commerce",
    taskTypes: ["catalog", "pricing", "order"],
    tags: ["commerce", "retail"],
    workflowStages: ["sync_catalog", "optimize_merchandising", "validate_promotions", "publish_changes"],
    requiredTools: ["catalog_admin", "pricing_engine", "inventory_snapshot"],
    optionalTools: ["recommendation_tuner", "promotion_simulator"],
    externalAdapters: ["shop", "payments"],
    blockingMetrics: ["margin_guard", "inventory_accuracy"],
    advisoryMetrics: ["conversion", "latency"],
    latencyProfile: { tier: "realtime", targetResponseMinutes: 10, maxResponseMinutes: 90, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "analytics", ownerTeam: "commerce-ops", escalationTeam: "commerce-risk" },
    rolloutStrategy: "canary",
    restrictedDataClasses: ["internal"],
  },
  {
    phase: "9b",
    domainId: "advertising",
    legacyDomainIds: ["advertising-promotion"],
    displayName: "Advertising",
    description: "Campaign planning, audience targeting, and budget governance.",
    riskLevel: "high",
    ownerOrgNodeId: "org.ads",
    taskTypes: ["plan", "launch", "optimize"],
    tags: ["ads", "campaign"],
    workflowStages: ["plan_campaign", "validate_budget", "activate_channels", "optimize_spend"],
    requiredTools: ["audience_builder", "budget_guard", "channel_launcher"],
    optionalTools: ["creative_brief", "attribution_dashboard"],
    externalAdapters: ["ad-network", "analytics"],
    blockingMetrics: ["budget_adherence", "policy_safety"],
    advisoryMetrics: ["roas", "latency"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 20, maxResponseMinutes: 240, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "content", ownerTeam: "ads-ops", escalationTeam: "ads-governance" },
    rolloutStrategy: "canary",
    restrictedDataClasses: ["internal"],
  },
  {
    phase: "9c",
    domainId: "industry-research",
    legacyDomainIds: [],
    displayName: "Industry Research",
    description: "Structured market and industry analysis workflows.",
    riskLevel: "medium",
    ownerOrgNodeId: "org.strategy",
    taskTypes: ["research", "summarize", "brief"],
    tags: ["research", "industry"],
    workflowStages: ["collect_sources", "extract_signals", "compare_competitors", "publish_brief"],
    requiredTools: ["source_collector", "signal_extractor", "brief_builder"],
    optionalTools: ["citation_builder", "trend_scanner"],
    externalAdapters: ["web-research", "knowledge-base"],
    blockingMetrics: ["source_relevance", "citation_coverage"],
    advisoryMetrics: ["freshness", "latency"],
    latencyProfile: { tier: "business_day", targetResponseMinutes: 180, maxResponseMinutes: 1440, dataSensitivity: "internal" },
    ownershipProfile: { divisionId: "research", ownerTeam: "strategy-research", escalationTeam: "strategy-leads" },
    rolloutStrategy: "supervised_auto",
    restrictedDataClasses: [],
  },
  {
    phase: "9c",
    domainId: "academic-research",
    legacyDomainIds: [],
    displayName: "Academic Research",
    description: "Literature collection, evaluation, and synthesis pipelines.",
    riskLevel: "medium",
    ownerOrgNodeId: "org.research",
    taskTypes: ["collect", "evaluate", "synthesize"],
    tags: ["research", "academic"],
    workflowStages: ["collect_papers", "screen_relevance", "summarize_findings", "prepare_citations"],
    requiredTools: ["paper_search", "citation_builder", "evidence_matrix"],
    optionalTools: ["trend_scanner", "knowledge_graph"],
    externalAdapters: ["scholar", "library"],
    blockingMetrics: ["citation_accuracy", "coverage"],
    advisoryMetrics: ["novelty", "latency"],
    latencyProfile: { tier: "business_day", targetResponseMinutes: 240, maxResponseMinutes: 1440, dataSensitivity: "internal" },
    ownershipProfile: { divisionId: "research", ownerTeam: "academic-programs", escalationTeam: "research-governance" },
    rolloutStrategy: "supervised_auto",
    restrictedDataClasses: [],
  },
  {
    phase: "9c",
    domainId: "finance-accounting",
    legacyDomainIds: ["finance"],
    displayName: "Finance Accounting",
    description: "Internal finance operations, reporting, and close workflows.",
    riskLevel: "high",
    ownerOrgNodeId: "org.finance",
    taskTypes: ["reconcile", "report", "forecast"],
    tags: ["finance", "accounting"],
    workflowStages: ["collect_ledgers", "reconcile_variances", "prepare_close_pack", "route_for_signoff"],
    requiredTools: ["ledger_reader", "variance_checker", "close_calendar"],
    optionalTools: ["forecast_model", "approval_router"],
    externalAdapters: ["erp", "spreadsheet"],
    blockingMetrics: ["reconciliation_accuracy", "approval_completeness"],
    advisoryMetrics: ["forecast_delta", "latency"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 60, maxResponseMinutes: 720, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "analytics", ownerTeam: "finance-ops", escalationTeam: "controller-office" },
    rolloutStrategy: "canary",
    restrictedDataClasses: ["internal"],
  },
  {
    phase: "9c",
    domainId: "legal",
    legacyDomainIds: [],
    displayName: "Legal",
    description: "Contract review, policy mapping, and legal operations support.",
    riskLevel: "critical",
    ownerOrgNodeId: "org.legal",
    taskTypes: ["review", "redline", "advise"],
    tags: ["legal", "contracts"],
    workflowStages: ["collect_authorities", "review_clause_set", "draft_redlines", "prepare_approval_packet"],
    requiredTools: ["clause_library", "redline_editor", "approval_router"],
    optionalTools: ["matter_tracker", "policy_linker"],
    externalAdapters: ["clm", "dms"],
    blockingMetrics: ["policy_alignment", "approval_completeness"],
    advisoryMetrics: ["turnaround_time", "cost"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 45, maxResponseMinutes: 720, dataSensitivity: "regulated" },
    ownershipProfile: { divisionId: "security", ownerTeam: "legal-ops", escalationTeam: "general-counsel-office" },
    rolloutStrategy: "shadow",
    restrictedDataClasses: ["regulated", "sensitive"],
  },
  {
    phase: "9d",
    domainId: "customer-service",
    legacyDomainIds: [],
    displayName: "Customer Service",
    description: "Customer support triage, response generation, and escalation.",
    riskLevel: "medium",
    ownerOrgNodeId: "org.support",
    taskTypes: ["triage", "respond", "escalate"],
    tags: ["support", "service"],
    workflowStages: ["triage_ticket", "retrieve_context", "draft_response", "escalate_if_needed"],
    requiredTools: ["ticket_router", "knowledge_search", "response_drafter"],
    optionalTools: ["sentiment_monitor", "crm_sync"],
    externalAdapters: ["crm", "support-desk"],
    blockingMetrics: ["csat_proxy", "policy_safety"],
    advisoryMetrics: ["first_response_time", "latency"],
    latencyProfile: { tier: "realtime", targetResponseMinutes: 5, maxResponseMinutes: 30, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "support", ownerTeam: "support-ops", escalationTeam: "customer-experience" },
    rolloutStrategy: "supervised_auto",
    restrictedDataClasses: ["internal"],
  },
  {
    phase: "9d",
    domainId: "it-operations",
    legacyDomainIds: [],
    displayName: "IT Operations",
    description: "IT operations, incident handling, and runbook execution.",
    riskLevel: "high",
    ownerOrgNodeId: "org.itops",
    taskTypes: ["detect", "mitigate", "recover"],
    tags: ["itops", "incident"],
    workflowStages: ["detect_incident", "diagnose_signal", "apply_runbook", "verify_recovery"],
    requiredTools: ["incident_feed", "runbook_executor", "system_observer"],
    optionalTools: ["change_freezer", "status_publisher"],
    externalAdapters: ["pager", "monitoring"],
    blockingMetrics: ["incident_containment", "recovery_success"],
    advisoryMetrics: ["mttr", "latency"],
    latencyProfile: { tier: "realtime", targetResponseMinutes: 3, maxResponseMinutes: 30, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "operations", ownerTeam: "it-sre", escalationTeam: "incident-command" },
    rolloutStrategy: "canary",
    restrictedDataClasses: ["internal"],
  },
  {
    phase: "9d",
    domainId: "content-moderation",
    legacyDomainIds: [],
    displayName: "Content Moderation",
    description: "Policy-based moderation and escalation workflows.",
    riskLevel: "high",
    ownerOrgNodeId: "org.safety",
    taskTypes: ["classify", "moderate", "escalate"],
    tags: ["moderation", "safety"],
    workflowStages: ["classify_content", "apply_policy", "queue_for_review", "record_enforcement"],
    requiredTools: ["policy_engine", "content_classifier", "evidence_logger"],
    optionalTools: ["appeal_router", "trend_monitor"],
    externalAdapters: ["ugc-platform", "case-management"],
    blockingMetrics: ["policy_precision", "appeal_reversal_rate"],
    advisoryMetrics: ["queue_latency", "cost"],
    latencyProfile: { tier: "realtime", targetResponseMinutes: 5, maxResponseMinutes: 60, dataSensitivity: "regulated" },
    ownershipProfile: { divisionId: "security", ownerTeam: "trust-safety", escalationTeam: "policy-ops" },
    rolloutStrategy: "canary",
    restrictedDataClasses: ["sensitive"],
  },
  {
    phase: "9d",
    domainId: "live-streaming",
    legacyDomainIds: ["online-livestream"],
    displayName: "Live Streaming",
    description: "Livestream planning, moderation, and incident response.",
    riskLevel: "high",
    ownerOrgNodeId: "org.live",
    taskTypes: ["prepare", "moderate", "respond"],
    tags: ["livestream", "ops"],
    workflowStages: ["prepare_show", "monitor_stream", "moderate_events", "stabilize_incidents"],
    requiredTools: ["stream_monitor", "chat_moderator", "incident_feed"],
    optionalTools: ["cue_sheet", "clip_router"],
    externalAdapters: ["stream-platform", "chat-platform"],
    blockingMetrics: ["stream_health", "policy_enforcement"],
    advisoryMetrics: ["viewer_retention", "latency"],
    latencyProfile: { tier: "realtime", targetResponseMinutes: 2, maxResponseMinutes: 15, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "support", ownerTeam: "live-ops", escalationTeam: "broadcast-command" },
    rolloutStrategy: "canary",
    restrictedDataClasses: ["internal"],
  },
  {
    phase: "9e",
    domainId: "healthcare",
    legacyDomainIds: ["medical-health"],
    displayName: "Healthcare",
    description: "Healthcare workflow assistance under strict governance.",
    riskLevel: "critical",
    ownerOrgNodeId: "org.health",
    taskTypes: ["triage", "summarize", "coordinate"],
    tags: ["health", "regulated"],
    workflowStages: ["collect_clinical_context", "apply_guidelines", "prepare_summary", "route_for_clinician_review"],
    requiredTools: ["ehr_reader", "guideline_mapper", "clinical_summary"],
    optionalTools: ["care_pathway_router", "appointment_sync"],
    externalAdapters: ["ehr", "care-management"],
    blockingMetrics: ["clinical_safety", "guideline_adherence"],
    advisoryMetrics: ["handoff_latency", "cost"],
    latencyProfile: { tier: "realtime", targetResponseMinutes: 10, maxResponseMinutes: 60, dataSensitivity: "regulated" },
    ownershipProfile: { divisionId: "security", ownerTeam: "clinical-ops", escalationTeam: "medical-governance" },
    rolloutStrategy: "shadow",
    restrictedDataClasses: ["regulated", "sensitive"],
  },
  {
    phase: "9e",
    domainId: "human-resources",
    legacyDomainIds: [],
    displayName: "Human Resources",
    description: "Employee lifecycle, policy, and people-ops workflows.",
    riskLevel: "high",
    ownerOrgNodeId: "org.hr",
    taskTypes: ["screen", "review", "coordinate"],
    tags: ["hr", "people"],
    workflowStages: ["collect_people_context", "apply_policy", "prepare_recommendation", "route_for_manager_signoff"],
    requiredTools: ["hris_reader", "policy_checker", "case_manager"],
    optionalTools: ["scheduler", "sentiment_monitor"],
    externalAdapters: ["hris", "ats"],
    blockingMetrics: ["policy_compliance", "privacy_safety"],
    advisoryMetrics: ["cycle_time", "latency"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 30, maxResponseMinutes: 480, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "general_ops", ownerTeam: "people-ops", escalationTeam: "hr-governance" },
    rolloutStrategy: "canary",
    restrictedDataClasses: ["sensitive"],
  },
  {
    phase: "9e",
    domainId: "supply-chain",
    legacyDomainIds: ["supply-chain-logistics"],
    displayName: "Supply Chain",
    description: "Supply planning, logistics coordination, and exception handling.",
    riskLevel: "high",
    ownerOrgNodeId: "org.supply",
    taskTypes: ["plan", "route", "resolve"],
    tags: ["supply", "logistics"],
    workflowStages: ["assess_supply_signal", "replan_inventory", "coordinate_logistics", "resolve_exception"],
    requiredTools: ["inventory_snapshot", "route_optimizer", "supplier_console"],
    optionalTools: ["forecast_model", "alert_manager"],
    externalAdapters: ["erp", "wms"],
    blockingMetrics: ["fill_rate", "exception_clearance"],
    advisoryMetrics: ["otif", "latency"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 20, maxResponseMinutes: 240, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "operations", ownerTeam: "supply-control-tower", escalationTeam: "logistics-command" },
    rolloutStrategy: "canary",
    restrictedDataClasses: ["internal"],
  },
  {
    phase: "9e",
    domainId: "education",
    legacyDomainIds: ["education-training"],
    displayName: "Education",
    description: "Learning design, learner support, and training operations.",
    riskLevel: "medium",
    ownerOrgNodeId: "org.education",
    taskTypes: ["design", "coach", "assess"],
    tags: ["education", "training"],
    workflowStages: ["design_curriculum", "assemble_materials", "deliver_guidance", "assess_outcomes"],
    requiredTools: ["curriculum_planner", "content_library", "assessment_builder"],
    optionalTools: ["schedule_sync", "engagement_tracker"],
    externalAdapters: ["lms", "content-repo"],
    blockingMetrics: ["assessment_quality", "content_safety"],
    advisoryMetrics: ["completion_rate", "latency"],
    latencyProfile: { tier: "business_day", targetResponseMinutes: 120, maxResponseMinutes: 1440, dataSensitivity: "internal" },
    ownershipProfile: { divisionId: "general_ops", ownerTeam: "learning-ops", escalationTeam: "learning-governance" },
    rolloutStrategy: "supervised_auto",
    restrictedDataClasses: [],
  },
  {
    phase: "9f",
    domainId: "creative-production",
    legacyDomainIds: ["advertising-creative"],
    displayName: "Creative Production",
    description: "Creative production for ad assets and campaign content.",
    riskLevel: "medium",
    ownerOrgNodeId: "org.creative",
    taskTypes: ["concept", "draft", "iterate"],
    tags: ["creative", "ads"],
    workflowStages: ["collect_brief", "generate_concepts", "review_brand_safety", "package_assets"],
    requiredTools: ["creative_brief", "asset_generator", "brand_checker"],
    optionalTools: ["storyboard_editor", "feedback_tracker"],
    externalAdapters: ["asset-library", "design-suite"],
    blockingMetrics: ["brand_safety", "brief_alignment"],
    advisoryMetrics: ["iteration_count", "latency"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 45, maxResponseMinutes: 720, dataSensitivity: "internal" },
    ownershipProfile: { divisionId: "content", ownerTeam: "creative-studio", escalationTeam: "brand-governance" },
    rolloutStrategy: "supervised_auto",
    restrictedDataClasses: [],
  },
  {
    phase: "9f",
    domainId: "game-dev",
    legacyDomainIds: ["game-development"],
    displayName: "Game Dev",
    description: "Game production, content iteration, and build workflows.",
    riskLevel: "medium",
    ownerOrgNodeId: "org.games",
    taskTypes: ["design", "build", "verify"],
    tags: ["games", "development"],
    workflowStages: ["plan_feature", "implement_content", "run_build_validation", "prepare_playtest"],
    requiredTools: ["build_runner", "asset_pipeline", "playtest_tracker"],
    optionalTools: ["performance_profiler", "bug_triage"],
    externalAdapters: ["build-system", "issue-tracker"],
    blockingMetrics: ["build_success", "performance_budget"],
    advisoryMetrics: ["playtest_feedback", "latency"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 30, maxResponseMinutes: 480, dataSensitivity: "internal" },
    ownershipProfile: { divisionId: "engineering_ops", ownerTeam: "game-dev-core", escalationTeam: "game-release" },
    rolloutStrategy: "supervised_auto",
    restrictedDataClasses: [],
  },
  {
    phase: "9f",
    domainId: "game-publishing",
    legacyDomainIds: [],
    displayName: "Game Publishing",
    description: "Release packaging, compliance checks, and store readiness.",
    riskLevel: "high",
    ownerOrgNodeId: "org.games",
    taskTypes: ["package", "review", "release"],
    tags: ["games", "publishing"],
    workflowStages: ["assemble_release", "verify_store_requirements", "prepare_submission", "coordinate_launch"],
    requiredTools: ["release_packager", "store_checklist", "submission_router"],
    optionalTools: ["localization_sync", "marketing_handoff"],
    externalAdapters: ["app-store", "console-store"],
    blockingMetrics: ["store_compliance", "release_readiness"],
    advisoryMetrics: ["approval_cycle_time", "latency"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 60, maxResponseMinutes: 1440, dataSensitivity: "confidential" },
    ownershipProfile: { divisionId: "content", ownerTeam: "publishing-ops", escalationTeam: "release-governance" },
    rolloutStrategy: "canary",
    restrictedDataClasses: ["internal"],
  },
  {
    phase: "9f",
    domainId: "marketing",
    legacyDomainIds: ["marketing-brand"],
    displayName: "Marketing",
    description: "Brand marketing planning, execution, and performance analysis.",
    riskLevel: "medium",
    ownerOrgNodeId: "org.marketing",
    taskTypes: ["plan", "publish", "measure"],
    tags: ["marketing", "brand"],
    workflowStages: ["plan_program", "prepare_content", "launch_assets", "measure_performance"],
    requiredTools: ["calendar_planner", "content_router", "measurement_dashboard"],
    optionalTools: ["brief_generator", "attribution_dashboard"],
    externalAdapters: ["cms", "analytics"],
    blockingMetrics: ["brand_consistency", "approval_completeness"],
    advisoryMetrics: ["pipeline_influence", "latency"],
    latencyProfile: { tier: "near_realtime", targetResponseMinutes: 30, maxResponseMinutes: 480, dataSensitivity: "internal" },
    ownershipProfile: { divisionId: "content", ownerTeam: "brand-marketing", escalationTeam: "brand-ops" },
    rolloutStrategy: "supervised_auto",
    restrictedDataClasses: [],
  },
] as const satisfies readonly DomainSeed[];

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
      modelHints: { preferredModel: "gpt-5.2", temperature: seed.riskLevel === "critical" ? 0.1 : 0.2 },
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
      modelPreferences: { primary: "gpt-5.2", fallback: "gpt-5.4-mini" },
      budgetLimits: {
        maxTokensPerTask: seed.riskLevel === "critical" ? 8_000 : 5_000,
        maxCostPerTask: seed.riskLevel === "critical" ? 8 : seed.riskLevel === "high" ? 5 : 3,
      },
      securityLevel: securityLevelForRisk(seed.riskLevel),
    },
    status: "testing",
    externalAdapters: [...seed.externalAdapters],
    pluginBindings: [],
  };
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
  if (canonicalDomainId == null) {
    throw new Error(`vertical_domain.not_found:${domainId}`);
  }
  const baseline = VERTICAL_DOMAIN_BASELINES.find((item) => item.domainId === canonicalDomainId);
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
