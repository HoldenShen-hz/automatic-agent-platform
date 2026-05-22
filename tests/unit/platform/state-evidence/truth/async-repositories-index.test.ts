import { describe, it } from "node:test";
import assert from "node:assert";

describe("async-repositories/index re-exports", () => {
  it("should export all async repository classes", async () => {
    const mod = await import(
      "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/index.js"
    );

    // Verify all expected exports exist
    assert.ok(mod.AsyncApprovalRepository);
    assert.ok(mod.AsyncArtifactRepository);
    assert.ok(mod.AsyncBillingRepository);
    assert.ok(mod.AsyncBudgetRepository);
    assert.ok(mod.AsyncCostManagementRepository);
    assert.ok(mod.AsyncDelegationRepository);
    assert.ok(mod.AsyncDispatchRepository);
    assert.ok(mod.AsyncDivisionRepository);
    assert.ok(mod.AsyncEvolutionRepository);
    assert.ok(mod.AsyncEventRepository);
    assert.ok(mod.AsyncExecutionRepository);
    assert.ok(mod.AsyncIntelligenceRepository);
    assert.ok(mod.AsyncLeaseRepository);
    assert.ok(mod.AsyncLockRepository);
    assert.ok(mod.AsyncMarketplaceListingRepository);
    assert.ok(mod.AsyncMarketplaceRepository);
    assert.ok(mod.AsyncMemoryRepository);
    assert.ok(mod.AsyncOperationsRepository);
    assert.ok(mod.AsyncOrganizationRepository);
    assert.ok(mod.AsyncPromptRepository);
    assert.ok(mod.AsyncReleaseRepository);
    assert.ok(mod.AsyncSecretRepository);
    assert.ok(mod.AsyncSessionRepository);
    assert.ok(mod.AsyncTaskRepository);
    assert.ok(mod.AsyncTenantRepository);
    assert.ok(mod.AsyncWorkflowRepository);
    assert.ok(mod.AsyncWorkerRepository);
  });

  it("should export AsyncBudgetRepository class", async () => {
    const { AsyncBudgetRepository } = await import(
      "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/index.js"
    );

    assert.strictEqual(typeof AsyncBudgetRepository, "function");
  });
});
