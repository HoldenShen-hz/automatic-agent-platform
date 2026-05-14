import {
  DomainLifecycleStateSchema,
  type DomainLifecycleState,
} from "./domain-specs.js";

export type { DomainLifecycleState } from "./domain-specs.js";
export type DomainPluginType = "tool" | "adapter" | "retriever" | "evaluator";
export type DomainRecipeArchetype =
  | "intake_triage"
  | "research_synthesis"
  | "risk_review"
  | "transaction_processing"
  | "content_generation"
  | "monitoring_alerting"
  | "planning_optimization"
  | "case_management"
  | "knowledge_retrieval"
  | "compliance_attestation"
  | "customer_assistance"
  | "workflow_automation";

export interface DomainMetaModelQuestion {
  readonly questionId: `Q${number}`;
  readonly key: string;
  readonly required: boolean;
}

export const DOMAIN_META_MODEL_QUESTIONS: readonly DomainMetaModelQuestion[] = Object.freeze([
  { questionId: "Q1", key: "domain_goal", required: true },
  { questionId: "Q2", key: "user_roles", required: true },
  { questionId: "Q3", key: "input_sources", required: true },
  { questionId: "Q4", key: "output_contracts", required: true },
  { questionId: "Q5", key: "tools", required: true },
  { questionId: "Q6", key: "data_classes", required: true },
  { questionId: "Q7", key: "risk_controls", required: true },
  { questionId: "Q8", key: "approval_model", required: true },
  { questionId: "Q9", key: "eval_requirements", required: true },
  { questionId: "Q10", key: "slo_profile", required: true },
  { questionId: "Q11", key: "budget_constraints", required: true },
  { questionId: "Q12", key: "knowledge_boundaries", required: true },
  { questionId: "Q13", key: "liability_owner", required: true },
  { questionId: "Q14", key: "compensation_model", required: true },
  { questionId: "Q15", key: "adversarial_scenarios", required: true },
]);

export interface DomainDescriptorProfile {
  readonly domainId: string;
  readonly lifecycleState: DomainLifecycleState;
  readonly executionMode: "supervised" | "auto" | "full_auto";
  readonly hotPathMode: "deterministic_only" | "llm_allowed";
  readonly planningMode: "plan_graph_required" | "legacy_projection";
}

export interface PackCapabilityProfile {
  readonly domainId: string;
  readonly sideEffects: readonly string[];
  readonly dataClasses: readonly string[];
  readonly maxRiskClass: "low" | "medium" | "high" | "critical";
  readonly tools: readonly string[];
  readonly connectors: readonly string[];
  readonly plugins: readonly string[];
  readonly evalRequirements: readonly string[];
}

export interface PluginManifestBoundary {
  readonly pluginId: string;
  readonly spiTypes: readonly DomainPluginType[];
  readonly domainIds: readonly string[];
  readonly sbomRef: string;
  readonly signingKeyRef: string;
}

export function canTransitionDomain(from: DomainLifecycleState, to: DomainLifecycleState): boolean {
  const legacyAllowed: Record<string, readonly string[]> = {
    Draft: ["Validated", "Archived"],
    Validated: ["Registered", "Draft"],
    Registered: ["Active", "Deprecated"],
    Active: ["Updating", "Deprecated"],
    Updating: ["Active", "Deprecated"],
    Deprecated: ["Archived"],
    Archived: [],
  };
  if (from in legacyAllowed || to in legacyAllowed) {
    return legacyAllowed[String(from)]?.includes(String(to)) ?? false;
  }

  const allowed: Record<DomainLifecycleState, readonly DomainLifecycleState[]> = {
    validating: ["certified", "retired"],
    certified: ["canary", "validating"],
    canary: ["active", "deprecated"],
    active: ["canary", "deprecated"],
    deprecated: ["retired"],
    retired: [],
  };
  return allowed[DomainLifecycleStateSchema.parse(from)].includes(DomainLifecycleStateSchema.parse(to));
}

export function validateActiveDomainDescriptor(descriptor: DomainDescriptorProfile): readonly string[] {
  const findings: string[] = [];
  if (DomainLifecycleStateSchema.parse(descriptor.lifecycleState) !== "active") findings.push("domain_descriptor.not_active");
  if (descriptor.planningMode !== "plan_graph_required") findings.push("domain_descriptor.plan_graph_required");
  if (descriptor.hotPathMode === "llm_allowed" && descriptor.executionMode === "full_auto") {
    findings.push("domain_descriptor.full_auto_hot_path_requires_deterministic_mode");
  }
  return findings;
}

export function buildDomainsSdkRemediationEvidence(): readonly string[] {
  return Array.from({ length: 20 }, (_value, index) => `D-${index + 1}`);
}
