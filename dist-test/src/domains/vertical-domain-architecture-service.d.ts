import { type DomainBaseline, type LegacyVerticalDomainId, type VerticalDomainId } from "./domain-baseline-catalog.js";
export interface VerticalDomainArchitectureSection {
    readonly sectionId: "workflow" | "tooling" | "risk" | "eval" | "latency" | "ownership" | "knowledge" | "recipes";
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
export declare class VerticalDomainArchitectureService {
    listVerticalDomainArchitectures(): readonly VerticalDomainArchitectureRecord[];
    getVerticalDomainArchitecture(domainId: VerticalDomainId | LegacyVerticalDomainId | string): VerticalDomainArchitectureRecord;
    hasVerticalDomainArchitecture(domainId: VerticalDomainId | LegacyVerticalDomainId | string): boolean;
    private toArchitectureRecord;
}
