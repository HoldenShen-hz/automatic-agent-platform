import {
  getVerticalDomainBaseline,
  listVerticalDomainBaselines,
  resolveCanonicalVerticalDomainId,
  type DomainBaseline,
  type LegacyVerticalDomainId,
  type VerticalDomainId,
} from "./domain-baseline-catalog.js";

export interface VerticalDomainArchitectureSection {
  readonly sectionId:
    | "workflow"
    | "tooling"
    | "risk"
    | "eval"
    | "latency"
    | "ownership"
    | "knowledge"
    | "recipes";
  readonly title: string;
  readonly summary: string;
}

export interface VerticalDomainArchitectureRecord {
  readonly domainId: VerticalDomainId;
  readonly legacyDomainIds: readonly LegacyVerticalDomainId[];
  readonly displayName: string;
  readonly phase: DomainBaseline["phase"];
  readonly ownerOrgNodeId: string;
  readonly configPath: string;
  readonly workflow: DomainBaseline["workflowSpecialization"];
  readonly tooling: DomainBaseline["toolingSpecialization"];
  readonly risk: DomainBaseline["riskProfile"];
  readonly eval: DomainBaseline["evalSpecialization"];
  readonly latency: DomainBaseline["latencyProfile"];
  readonly ownership: DomainBaseline["ownershipProfile"];
  readonly knowledgeNamespaces: readonly string[];
  readonly recipeIds: readonly string[];
  readonly architectureSections: readonly VerticalDomainArchitectureSection[];
}

export class VerticalDomainArchitectureService {
  public listVerticalDomainArchitectures(): readonly VerticalDomainArchitectureRecord[] {
    return listVerticalDomainBaselines().map((baseline) => this.toArchitectureRecord(baseline));
  }

  public getVerticalDomainArchitecture(domainId: VerticalDomainId | LegacyVerticalDomainId | string): VerticalDomainArchitectureRecord {
    return this.toArchitectureRecord(getVerticalDomainBaseline(domainId));
  }

  public hasVerticalDomainArchitecture(domainId: VerticalDomainId | LegacyVerticalDomainId | string): boolean {
    return resolveCanonicalVerticalDomainId(domainId) != null;
  }

  private toArchitectureRecord(baseline: DomainBaseline): VerticalDomainArchitectureRecord {
    return {
      domainId: baseline.domainId,
      legacyDomainIds: baseline.legacyDomainIds,
      displayName: baseline.displayName,
      phase: baseline.phase,
      ownerOrgNodeId: baseline.ownerOrgNodeId,
      configPath: baseline.ownershipProfile.configPath,
      workflow: baseline.workflowSpecialization,
      tooling: baseline.toolingSpecialization,
      risk: baseline.riskProfile,
      eval: baseline.evalSpecialization,
      latency: baseline.latencyProfile,
      ownership: baseline.ownershipProfile,
      knowledgeNamespaces: baseline.knowledgeSchema.namespaceIds,
      recipeIds: baseline.recipes.map((recipe) => recipe.recipeId),
      architectureSections: buildArchitectureSections(baseline),
    };
  }
}

function buildArchitectureSections(baseline: DomainBaseline): readonly VerticalDomainArchitectureSection[] {
  return [
    {
      sectionId: "workflow",
      title: "Workflow Specialization",
      summary: `${baseline.displayName} uses ${baseline.workflowSpecialization.workflowTemplateId} with ${baseline.workflowSpecialization.stageNames.length} stages.`,
    },
    {
      sectionId: "tooling",
      title: "Tooling Contract",
      summary: `${baseline.toolingSpecialization.bundleId} requires ${baseline.toolingSpecialization.requiredToolNames.join(", ")}.`,
    },
    {
      sectionId: "risk",
      title: "Risk Profile",
      summary: `${baseline.displayName} operates at ${baseline.riskProfile.defaultRiskLevel} risk with ${baseline.governancePolicy.rollout.strategy} rollout.`,
    },
    {
      sectionId: "eval",
      title: "Evaluation Gates",
      summary: `${baseline.evalSpecialization.blockingMetricIds.join(", ")} are blocking metrics for ${baseline.domainId}.`,
    },
    {
      sectionId: "latency",
      title: "Latency Envelope",
      summary: `Target ${baseline.latencyProfile.targetResponseMinutes} minutes, max ${baseline.latencyProfile.maxResponseMinutes} minutes.`,
    },
    {
      sectionId: "ownership",
      title: "Ownership Profile",
      summary: `${baseline.ownershipProfile.ownerTeam} owns the domain and escalates to ${baseline.ownershipProfile.escalationTeam}.`,
    },
    {
      sectionId: "knowledge",
      title: "Knowledge Boundaries",
      summary: `${baseline.knowledgeSchema.namespaceIds.length} namespaces are wired into ${baseline.domainId}.`,
    },
    {
      sectionId: "recipes",
      title: "Recipe Inventory",
      summary: `${baseline.recipes.length} domain recipes are packaged for ${baseline.domainId}.`,
    },
  ];
}
