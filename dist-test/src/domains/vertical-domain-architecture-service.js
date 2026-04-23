import { getVerticalDomainBaseline, listVerticalDomainBaselines, resolveCanonicalVerticalDomainId, } from "./domain-baseline-catalog.js";
export class VerticalDomainArchitectureService {
    listVerticalDomainArchitectures() {
        return listVerticalDomainBaselines().map((baseline) => this.toArchitectureRecord(baseline));
    }
    getVerticalDomainArchitecture(domainId) {
        return this.toArchitectureRecord(getVerticalDomainBaseline(domainId));
    }
    hasVerticalDomainArchitecture(domainId) {
        return resolveCanonicalVerticalDomainId(domainId) != null;
    }
    toArchitectureRecord(baseline) {
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
function buildArchitectureSections(baseline) {
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
//# sourceMappingURL=vertical-domain-architecture-service.js.map