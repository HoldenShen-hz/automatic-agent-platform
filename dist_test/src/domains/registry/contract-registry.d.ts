import type { OutputContractConfig } from "./domain-model.js";
export declare class ContractRegistry {
    private readonly contracts;
    registerAll(contracts: readonly OutputContractConfig[]): void;
    get(contractId: string): OutputContractConfig | null;
    list(): OutputContractConfig[];
}
