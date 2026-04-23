export class ContractRegistry {
    contracts = new Map();
    registerAll(contracts) {
        for (const contract of contracts) {
            this.contracts.set(contract.contractId, contract);
        }
    }
    get(contractId) {
        return this.contracts.get(contractId) ?? null;
    }
    list() {
        return [...this.contracts.values()];
    }
}
//# sourceMappingURL=contract-registry.js.map