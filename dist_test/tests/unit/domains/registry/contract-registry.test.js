import test from "node:test";
import assert from "node:assert/strict";
import { ContractRegistry } from "../../../../src/domains/registry/contract-registry.js";
function makeContract(contractId) {
    return {
        contractId,
        name: `Contract ${contractId}`,
        schema: { type: "object", properties: {} },
        validationLevel: "strict",
    };
}
test("ContractRegistry.registerAll stores multiple contracts", () => {
    const registry = new ContractRegistry();
    registry.registerAll([makeContract("contract_a"), makeContract("contract_b")]);
    assert.equal(registry.list().length, 2);
});
test("ContractRegistry.get returns contract by id", () => {
    const registry = new ContractRegistry();
    registry.registerAll([makeContract("contract_get")]);
    const result = registry.get("contract_get");
    assert.ok(result !== null);
    assert.equal(result.contractId, "contract_get");
});
test("ContractRegistry.get returns null for unknown id", () => {
    const registry = new ContractRegistry();
    assert.equal(registry.get("nonexistent"), null);
});
test("ContractRegistry.list returns all contracts", () => {
    const registry = new ContractRegistry();
    registry.registerAll([makeContract("contract_list_1"), makeContract("contract_list_2")]);
    const list = registry.list();
    assert.ok(list.length >= 2);
});
test("ContractRegistry.list returns a copy", () => {
    const registry = new ContractRegistry();
    registry.registerAll([makeContract("contract_copy")]);
    const list1 = registry.list();
    list1.push({});
    const list2 = registry.list();
    assert.ok(list2.every((c) => c.contractId !== undefined));
});
test("ContractRegistry.registerAll overwrites existing contract with same id", () => {
    const registry = new ContractRegistry();
    registry.registerAll([makeContract("contract_dup")]);
    registry.registerAll([makeContract("contract_dup")]);
    assert.equal(registry.list().length, 1);
});
//# sourceMappingURL=contract-registry.test.js.map