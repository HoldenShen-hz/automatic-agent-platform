import { type DomainMetaModel } from "./types.js";
export interface MetaModelSeedInput {
    readonly domainId: string;
    readonly displayName: string;
    readonly ownerOrgNodeId: string;
    readonly taskTypes: readonly string[];
    readonly tags: readonly string[];
    readonly riskLevel: "medium" | "high" | "critical";
}
export declare function seedDomainMetaModel(input: MetaModelSeedInput): DomainMetaModel;
export declare function seedDomainMetaModels(inputs: readonly MetaModelSeedInput[]): readonly DomainMetaModel[];
