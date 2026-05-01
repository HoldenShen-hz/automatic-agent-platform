// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { EnterpriseContractService } from "../../../../src/scale-ecosystem/billing/enterprise-contract-service.js";
import { MonetizationError } from "../../../../src/platform/contracts/errors.js";

test("EnterpriseContractService.createContract - creates contract with correct fields", (t) => {
  const service = new EnterpriseContractService();
  const input = {
    accountId: "acc_123",
    terms: { rate: "0.01", tier: "enterprise" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveUntil: "2026-12-31T23:59:59.999Z",
    createdBy: "admin@test.com",
    metadata: { region: "us-west" },
  };

  const contract = service.createContract(input);

  assert.strictEqual(contract.accountId, "acc_123");
  assert.strictEqual(contract.status, "active");
  assert.strictEqual(contract.versionNumber, 1);
  assert.deepStrictEqual(contract.terms, { rate: "0.01", tier: "enterprise" });
  assert.strictEqual(contract.createdBy, "admin@test.com");
  assert.deepStrictEqual(contract.metadata, { region: "us-west" });
  assert.ok(contract.contractId.startsWith("contract_"));
  assert.ok(contract.versionId.startsWith("version_"));
  assert.ok(contract.createdAt);
  assert.ok(contract.updatedAt);
});

test("EnterpriseContractService.createContract - without optional metadata", (t) => {
  const service = new EnterpriseContractService();
  const input = {
    accountId: "acc_456",
    terms: { rate: "0.02" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  };

  const contract = service.createContract(input);

  assert.strictEqual(contract.accountId, "acc_456");
  assert.deepStrictEqual(contract.metadata, {});
});

test("EnterpriseContractService.getContract - returns contract by id", (t) => {
  const service = new EnterpriseContractService();
  const input = {
    accountId: "acc_123",
    terms: { rate: "0.01" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  };

  const created = service.createContract(input);
  const retrieved = service.getContract(created.contractId);

  assert.deepStrictEqual(retrieved, created);
});

test("EnterpriseContractService.getContract - returns null for unknown id", (t) => {
  const service = new EnterpriseContractService();

  const result = service.getContract("unknown_contract_id");

  assert.strictEqual(result, null);
});

test("EnterpriseContractService.listContracts - returns all contracts for account", (t) => {
  const service = new EnterpriseContractService();
  service.createContract({
    accountId: "acc_123",
    terms: { rate: "0.01" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  });
  service.createContract({
    accountId: "acc_123",
    terms: { rate: "0.02" },
    effectiveFrom: "2026-02-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  });
  service.createContract({
    accountId: "acc_456",
    terms: { rate: "0.03" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  });

  const contracts = service.listContracts("acc_123");

  assert.strictEqual(contracts.length, 2);
  assert.ok(contracts.every((c) => c.accountId === "acc_123"));
});

test("EnterpriseContractService.modifyContract - adds new version with clauses", (t) => {
  const service = new EnterpriseContractService();
  const created = service.createContract({
    accountId: "acc_123",
    terms: { rate: "0.01", tier: "basic" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  });

  const modified = service.modifyContract({
    contractId: created.contractId,
    changeReason: "Updated pricing",
    changedBy: "admin@test.com",
    clauses: [
      { clauseType: "rate", description: "New rate", newText: "0.02", effectiveFrom: "2026-06-01T00:00:00.000Z" },
      { clauseType: "tier", description: "Upgrade tier", newText: "pro", effectiveFrom: "2026-06-01T00:00:00.000Z" },
    ],
  });

  assert.strictEqual(modified.versionNumber, 2);
  assert.strictEqual(modified.status, "amending");
  assert.deepStrictEqual(modified.terms, { rate: "0.02", tier: "pro" });
  assert.ok(modified.versionId.startsWith("version_"));
});

test("EnterpriseContractService.modifyContract - throws when contract is terminated", (t) => {
  const service = new EnterpriseContractService();
  const created = service.createContract({
    accountId: "acc_123",
    terms: { rate: "0.01" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  });
  service.terminateContract(created.contractId, "admin@test.com");

  assert.throws(
    () =>
      service.modifyContract({
        contractId: created.contractId,
        changeReason: "test",
        changedBy: "admin@test.com",
        clauses: [
          { clauseType: "rate", description: "test", newText: "0.02", effectiveFrom: "2026-01-01T00:00:00.000Z" },
        ],
      }),
    (error) => {
      assert.ok(error instanceof MonetizationError);
      assert.ok(error.code.includes("terminated"));
      return true;
    },
  );
});

test("EnterpriseContractService.modifyContract - throws when contract is expired", (t) => {
  const service = new EnterpriseContractService();
  const created = service.createContract({
    accountId: "acc_123",
    terms: { rate: "0.01" },
    effectiveFrom: "2025-01-01T00:00:00.000Z",
    effectiveUntil: "2025-12-31T23:59:59.999Z",
    createdBy: "admin@test.com",
  });
  // Manually expire the contract for testing
  const expiredContract = { ...created, status: "expired" as const };
  (service as any).contracts.set(created.contractId, expiredContract);

  assert.throws(
    () =>
      service.modifyContract({
        contractId: created.contractId,
        changeReason: "test",
        changedBy: "admin@test.com",
        clauses: [
          { clauseType: "rate", description: "test", newText: "0.02", effectiveFrom: "2026-01-01T00:00:00.000Z" },
        ],
      }),
    (error) => {
      assert.ok(error instanceof MonetizationError);
      assert.ok(error.code.includes("expired"));
      return true;
    },
  );
});

test("EnterpriseContractService.modifyContract - throws when contract not found", (t) => {
  const service = new EnterpriseContractService();

  assert.throws(
    () =>
      service.modifyContract({
        contractId: "nonexistent_contract",
        changeReason: "test",
        changedBy: "admin@test.com",
        clauses: [
          { clauseType: "rate", description: "test", newText: "0.02", effectiveFrom: "2026-01-01T00:00:00.000Z" },
        ],
      }),
    (error) => {
      assert.ok(error instanceof MonetizationError);
      assert.ok(error.code.includes("not_found"));
      return true;
    },
  );
});

test("EnterpriseContractService.terminateContract - sets status to terminated", (t) => {
  const service = new EnterpriseContractService();
  const created = service.createContract({
    accountId: "acc_123",
    terms: { rate: "0.01" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  });

  const terminated = service.terminateContract(created.contractId, "admin@test.com");

  assert.strictEqual(terminated.status, "terminated");
});

test("EnterpriseContractService.terminateContract - throws when contract not found", (t) => {
  const service = new EnterpriseContractService();

  assert.throws(
    () => service.terminateContract("nonexistent_contract", "admin@test.com"),
    (error) => {
      assert.ok(error instanceof MonetizationError);
      assert.ok(error.code.includes("not_found"));
      return true;
    },
  );
});

test("EnterpriseContractService.getVersionHistory - returns version history sorted by version number desc", (t) => {
  const service = new EnterpriseContractService();
  const created = service.createContract({
    accountId: "acc_123",
    terms: { rate: "0.01" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  });

  service.modifyContract({
    contractId: created.contractId,
    changeReason: "Update 1",
    changedBy: "admin@test.com",
    clauses: [
      { clauseType: "rate", description: "rate update", newText: "0.02", effectiveFrom: "2026-02-01T00:00:00.000Z" },
    ],
  });

  service.modifyContract({
    contractId: created.contractId,
    changeReason: "Update 2",
    changedBy: "admin@test.com",
    clauses: [
      { clauseType: "rate", description: "rate update", newText: "0.03", effectiveFrom: "2026-03-01T00:00:00.000Z" },
    ],
  });

  const history = service.getVersionHistory(created.contractId);

  assert.strictEqual(history.length, 3);
  assert.strictEqual(history[0].versionNumber, 3);
  assert.strictEqual(history[1].versionNumber, 2);
  assert.strictEqual(history[2].versionNumber, 1);
  assert.strictEqual(history[0].changeReason, "Update 2");
});

test("EnterpriseContractService.getVersionHistory - returns empty array for unknown contract", (t) => {
  const service = new EnterpriseContractService();

  const history = service.getVersionHistory("nonexistent_contract");

  assert.deepStrictEqual(history, []);
});

test("EnterpriseContractService.getContractVersion - returns version by id", (t) => {
  const service = new EnterpriseContractService();
  const created = service.createContract({
    accountId: "acc_123",
    terms: { rate: "0.01" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  });

  const version = service.getContractVersion(created.versionId);

  assert.ok(version);
  assert.strictEqual(version?.versionNumber, 1);
  assert.strictEqual(version?.contractId, created.contractId);
});

test("EnterpriseContractService.getContractVersion - returns null for unknown version id", (t) => {
  const service = new EnterpriseContractService();

  const version = service.getContractVersion("unknown_version_id");

  assert.strictEqual(version, null);
});

test("EnterpriseContractService.modifyContract - preserves previousText in clauses", (t) => {
  const service = new EnterpriseContractService();
  const created = service.createContract({
    accountId: "acc_123",
    terms: { rate: "0.01", tier: "basic" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  });

  service.modifyContract({
    contractId: created.contractId,
    changeReason: "Update tier",
    changedBy: "admin@test.com",
    clauses: [
      { clauseType: "tier", description: "Upgrade", newText: "pro", effectiveFrom: "2026-06-01T00:00:00.000Z" },
    ],
  });

  const history = service.getVersionHistory(created.contractId);
  const v2 = history[0];
  const tierClause = v2.clauses.find((c) => c.clauseType === "tier");

  assert.strictEqual(tierClause?.previousText, "basic");
  assert.strictEqual(tierClause?.newText, "pro");
});

test("EnterpriseContractService.modifyContract - without effectiveUntil uses null", (t) => {
  const service = new EnterpriseContractService();
  const created = service.createContract({
    accountId: "acc_123",
    terms: { rate: "0.01" },
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdBy: "admin@test.com",
  });

  const modified = service.modifyContract({
    contractId: created.contractId,
    changeReason: "Update rate",
    changedBy: "admin@test.com",
    clauses: [
      { clauseType: "rate", description: "New rate", newText: "0.02", effectiveFrom: "2026-06-01T00:00:00.000Z" },
    ],
  });

  assert.strictEqual(modified.effectiveUntil, null);
});
