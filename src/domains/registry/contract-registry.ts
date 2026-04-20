import type { OutputContractConfig } from "./domain-model.js";

export class ContractRegistry {
  private readonly contracts = new Map<string, OutputContractConfig>();

  public registerAll(contracts: readonly OutputContractConfig[]): void {
    for (const contract of contracts) {
      this.contracts.set(contract.contractId, contract);
    }
  }

  public get(contractId: string): OutputContractConfig | null {
    return this.contracts.get(contractId) ?? null;
  }

  public list(): OutputContractConfig[] {
    return [...this.contracts.values()];
  }
}
