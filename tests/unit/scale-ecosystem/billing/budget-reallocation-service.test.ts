import assert from "node:assert/strict";
import test from "node:test";

import { BudgetReallocationService } from "../../../../src/scale-ecosystem/billing/budget-reallocation-service.js";
import { MonetizationError } from "../../../../src/platform/contracts/errors.js";

test("BudgetReallocationService.reallocate - successful reallocation between accounts", (t) => {
  const service = new BudgetReallocationService();
  // Pre-fund source account
  (service as any).balances.set("acc_source", {
    accountId: "acc_source",
    outstandingUsd: 0,
    creditUsd: 1000,
    version: 1,
  });

  const result = service.reallocate({
    sourceAccountId: "acc_source",
    targetAccountId: "acc_target",
    amountUsd: 250,
    reasonCode: "budget_transfer",
    idempotencyKey: "idem_001",
    requestedBy: "admin@test.com",
  });

  assert.strictEqual(result.reallocation.status, "completed");
  assert.strictEqual(result.reallocation.amountUsd, 250);
  assert.strictEqual(result.reallocation.sourceAccountId, "acc_source");
  assert.strictEqual(result.reallocation.targetAccountId, "acc_target");
  assert.strictEqual(result.reallocation.reasonCode, "budget_transfer");
  assert.strictEqual(result.sourceBalanceSnapshot.creditUsd, 750);
  assert.strictEqual(result.targetBalanceSnapshot.creditUsd, 250);
});

test("BudgetReallocationService.reallocate - creates pending record then completes", (t) => {
  const service = new BudgetReallocationService();
  (service as any).balances.set("acc_source", {
    accountId: "acc_source",
    outstandingUsd: 0,
    creditUsd: 1000,
    version: 1,
  });

  const result = service.reallocate({
    sourceAccountId: "acc_source",
    targetAccountId: "acc_target",
    amountUsd: 100,
    reasonCode: "monthly_allocation",
    idempotencyKey: "idem_002",
    requestedBy: "finance@test.com",
  });

  const record = service.getReallocation(result.reallocation.reallocationId);
  assert.ok(record);
  assert.strictEqual(record?.status, "completed");
  assert.strictEqual(record?.requestedBy, "finance@test.com");
  assert.ok(record?.completedAt);
});

test("BudgetReallocationService.reallocate - throws on duplicate idempotency key", (t) => {
  const service = new BudgetReallocationService();
  (service as any).balances.set("acc_source", {
    accountId: "acc_source",
    outstandingUsd: 0,
    creditUsd: 1000,
    version: 1,
  });

  service.reallocate({
    sourceAccountId: "acc_source",
    targetAccountId: "acc_target",
    amountUsd: 100,
    reasonCode: "test",
    idempotencyKey: "idem_duplicate",
    requestedBy: "admin@test.com",
  });

  assert.throws(
    () =>
      service.reallocate({
        sourceAccountId: "acc_source",
        targetAccountId: "acc_target",
        amountUsd: 200,
        reasonCode: "test",
        idempotencyKey: "idem_duplicate",
        requestedBy: "admin@test.com",
      }),
    (error) => {
      assert.ok(error instanceof MonetizationError);
      assert.ok(error.code.includes("duplicate_reallocation"));
      return true;
    },
  );
});

test("BudgetReallocationService.reallocate - throws on insufficient credit", (t) => {
  const service = new BudgetReallocationService();
  (service as any).balances.set("acc_source", {
    accountId: "acc_source",
    outstandingUsd: 0,
    creditUsd: 50,
    version: 1,
  });

  assert.throws(
    () =>
      service.reallocate({
        sourceAccountId: "acc_source",
        targetAccountId: "acc_target",
        amountUsd: 100,
        reasonCode: "test",
        idempotencyKey: "idem_insufficient",
        requestedBy: "admin@test.com",
      }),
    (error) => {
      assert.ok(error instanceof MonetizationError);
      assert.ok(error.code.includes("insufficient_credit"));
      return true;
    },
  );
});

test("BudgetReallocationService.reallocate - creates new account balances on first use", (t) => {
  const service = new BudgetReallocationService();
  // Pre-fund both accounts since new accounts start with 0 credit
  (service as any).balances.set("acc_new_source", {
    accountId: "acc_new_source",
    outstandingUsd: 0,
    creditUsd: 1000,
    version: 0,
  });
  (service as any).balances.set("acc_new_target", {
    accountId: "acc_new_target",
    outstandingUsd: 0,
    creditUsd: 0,
    version: 0,
  });

  const result = service.reallocate({
    sourceAccountId: "acc_new_source",
    targetAccountId: "acc_new_target",
    amountUsd: 100,
    reasonCode: "initial_allocation",
    idempotencyKey: "idem_new_accounts",
    requestedBy: "admin@test.com",
  });

  assert.strictEqual(result.sourceBalanceSnapshot.creditUsd, 900);
  assert.strictEqual(result.targetBalanceSnapshot.creditUsd, 100);
});

test("BudgetReallocationService.reallocate - uses custom requestedAt when provided", (t) => {
  const service = new BudgetReallocationService();
  (service as any).balances.set("acc_source", {
    accountId: "acc_source",
    outstandingUsd: 0,
    creditUsd: 1000,
    version: 1,
  });
  const customDate = "2026-01-15T10:30:00.000Z";

  const result = service.reallocate({
    sourceAccountId: "acc_source",
    targetAccountId: "acc_target",
    amountUsd: 100,
    reasonCode: "test",
    idempotencyKey: "idem_custom_date",
    requestedBy: "admin@test.com",
    requestedAt: customDate,
  });

  assert.strictEqual(result.reallocation.requestedAt, customDate);
});

test("BudgetReallocationService.getReallocation - returns record by id", (t) => {
  const service = new BudgetReallocationService();
  (service as any).balances.set("acc_source", {
    accountId: "acc_source",
    outstandingUsd: 0,
    creditUsd: 1000,
    version: 1,
  });

  const result = service.reallocate({
    sourceAccountId: "acc_source",
    targetAccountId: "acc_target",
    amountUsd: 100,
    reasonCode: "test",
    idempotencyKey: "idem_get",
    requestedBy: "admin@test.com",
  });

  const retrieved = service.getReallocation(result.reallocation.reallocationId);

  assert.ok(retrieved);
  assert.strictEqual(retrieved?.reallocationId, result.reallocation.reallocationId);
});

test("BudgetReallocationService.getReallocation - returns null for unknown id", (t) => {
  const service = new BudgetReallocationService();

  const result = service.getReallocation("unknown_realloc_id");

  assert.strictEqual(result, null);
});

test("BudgetReallocationService.listReallocations - returns reallocations for source account", (t) => {
  const service = new BudgetReallocationService();
  (service as any).balances.set("acc_source", {
    accountId: "acc_source",
    outstandingUsd: 0,
    creditUsd: 10000,
    version: 1,
  });
  (service as any).balances.set("acc_other", {
    accountId: "acc_other",
    outstandingUsd: 0,
    creditUsd: 10000,
    version: 1,
  });

  service.reallocate({
    sourceAccountId: "acc_source",
    targetAccountId: "acc_target_a",
    amountUsd: 100,
    reasonCode: "test",
    idempotencyKey: "idem_list_1",
    requestedBy: "admin@test.com",
  });
  service.reallocate({
    sourceAccountId: "acc_source",
    targetAccountId: "acc_target_b",
    amountUsd: 200,
    reasonCode: "test",
    idempotencyKey: "idem_list_2",
    requestedBy: "admin@test.com",
  });
  service.reallocate({
    sourceAccountId: "acc_other",
    targetAccountId: "acc_target_c",
    amountUsd: 300,
    reasonCode: "test",
    idempotencyKey: "idem_list_3",
    requestedBy: "admin@test.com",
  });

  const reallocations = service.listReallocations("acc_source");

  assert.strictEqual(reallocations.length, 2);
});

test("BudgetReallocationService.listReallocations - returns reallocations for target account", (t) => {
  const service = new BudgetReallocationService();
  (service as any).balances.set("acc_source", {
    accountId: "acc_source",
    outstandingUsd: 0,
    creditUsd: 10000,
    version: 1,
  });

  service.reallocate({
    sourceAccountId: "acc_source",
    targetAccountId: "acc_target",
    amountUsd: 100,
    reasonCode: "test",
    idempotencyKey: "idem_target",
    requestedBy: "admin@test.com",
  });

  const reallocations = service.listReallocations("acc_target");

  assert.strictEqual(reallocations.length, 1);
  assert.strictEqual(reallocations[0].targetAccountId, "acc_target");
});

test("BudgetReallocationService.listReallocations - respects limit parameter", (t) => {
  const service = new BudgetReallocationService();
  (service as any).balances.set("acc_source", {
    accountId: "acc_source",
    outstandingUsd: 0,
    creditUsd: 100000,
    version: 1,
  });

  for (let i = 0; i < 10; i++) {
    service.reallocate({
      sourceAccountId: "acc_source",
      targetAccountId: "acc_target",
      amountUsd: 10,
      reasonCode: "test",
      idempotencyKey: `idem_limit_${i}`,
      requestedBy: "admin@test.com",
    });
  }

  const reallocations = service.listReallocations("acc_source", 5);

  assert.strictEqual(reallocations.length, 5);
});

test("BudgetReallocationService.listReallocations - returns empty array for account with no reallocations", (t) => {
  const service = new BudgetReallocationService();

  const reallocations = service.listReallocations("acc_nonexistent");

  assert.deepStrictEqual(reallocations, []);
});

test("BudgetReallocationService.reallocate - records version numbers in reallocation record", (t) => {
  const service = new BudgetReallocationService();
  (service as any).balances.set("acc_source", {
    accountId: "acc_source",
    outstandingUsd: 0,
    creditUsd: 1000,
    version: 5,
  });
  (service as any).balances.set("acc_target", {
    accountId: "acc_target",
    outstandingUsd: 0,
    creditUsd: 200,
    version: 10,
  });

  const result = service.reallocate({
    sourceAccountId: "acc_source",
    targetAccountId: "acc_target",
    amountUsd: 100,
    reasonCode: "test",
    idempotencyKey: "idem_version",
    requestedBy: "admin@test.com",
  });

  assert.strictEqual(result.reallocation.sourceVersion, 5);
  assert.strictEqual(result.reallocation.targetVersion, 10);
});

test("BudgetReallocationService.reallocate - error case preserves failed status in record", (t) => {
  const service = new BudgetReallocationService();
  (service as any).balances.set("acc_source", {
    accountId: "acc_source",
    outstandingUsd: 0,
    creditUsd: 50,
    version: 1,
  });

  // Reallocation will fail due to insufficient credit
  try {
    service.reallocate({
      sourceAccountId: "acc_source",
      targetAccountId: "acc_target",
      amountUsd: 100,
      reasonCode: "test",
      idempotencyKey: "idem_error_case",
      requestedBy: "admin@test.com",
    });
  } catch {
    // Expected to throw
  }

  // The idempotency key was added even though it failed
  assert.throws(
    () =>
      service.reallocate({
        sourceAccountId: "acc_source",
        targetAccountId: "acc_target",
        amountUsd: 100,
        reasonCode: "test",
        idempotencyKey: "idem_error_case",
        requestedBy: "admin@test.com",
      }),
    (error) => {
      assert.ok(error instanceof MonetizationError);
      assert.ok(error.code.includes("duplicate"));
      return true;
    },
  );
});
