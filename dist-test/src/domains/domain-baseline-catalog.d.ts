import { type DomainMetaModel, type MetaModelValidationResult } from "./canonical-meta-model/index.js";
import { type DomainDescriptorReview } from "./domain-descriptor-orchestration-service.js";
import type { DomainEvalFramework } from "./eval-framework/index.js";
import type { DomainInteractionRule } from "./interaction-policy/index.js";
import type { DomainKnowledgeSchema } from "./knowledge-schema/index.js";
import type { DomainOnboardingChecklist } from "./domain-descriptor-orchestration-service.js";
import type { DomainPromptLibrary } from "./prompt-library/index.js";
import type { DomainRecipe } from "./recipes/index.js";
import type { DomainRiskProfile } from "./risk-profile/index.js";
import type { DomainGovernancePolicy } from "./governance/domain-governance-policy.js";
import { DomainRegistryService } from "./registry/domain-registry-service.js";
import type { DomainDefinition } from "./registry/domain-model.js";
export type VerticalDomainPhase = "9a" | "9b" | "9c" | "9d" | "9e" | "9f";
export type VerticalDomainId = "coding" | "data-engineering" | "knowledge-base" | "user-operations" | "quant-trading" | "financial-services" | "ecommerce" | "advertising" | "industry-research" | "academic-research" | "finance-accounting" | "legal" | "customer-service" | "it-operations" | "content-moderation" | "live-streaming" | "healthcare" | "human-resources" | "supply-chain" | "education" | "creative-production" | "game-dev" | "game-publishing" | "marketing";
export type LegacyVerticalDomainId = "data-processing" | "enterprise-knowledge-base" | "quantitative-trading" | "advertising-promotion" | "finance" | "online-livestream" | "medical-health" | "supply-chain-logistics" | "education-training" | "advertising-creative" | "game-development" | "marketing-brand";
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
export declare const VERTICAL_DOMAIN_BASELINES: readonly DomainBaseline[];
export declare function listVerticalDomainBaselines(): readonly DomainBaseline[];
export declare function listVerticalDomainIds(): readonly VerticalDomainId[];
export declare function listLegacyVerticalDomainIds(): readonly LegacyVerticalDomainId[];
export declare function resolveCanonicalVerticalDomainId(domainId: VerticalDomainId | LegacyVerticalDomainId | string): VerticalDomainId | null;
export declare function getVerticalDomainBaseline(domainId: VerticalDomainId | LegacyVerticalDomainId | string): DomainBaseline;
export declare function listVerticalDomainBaselinesByPhase(phase: VerticalDomainPhase): readonly DomainBaseline[];
export declare function listVerticalDomainConfigPaths(): readonly string[];
export declare function validateVerticalDomainConfigs(): readonly string[];
export declare function bootstrapVerticalDomainBaselines(domainRegistry?: DomainRegistryService): VerticalDomainBootstrapResult;
