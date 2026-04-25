import { test } from "node:test";
import assert from "node:assert/strict";

// stable-evidence-bundle.ts exports createStableEvidenceBundle which is an async
// function requiring complex runtime infrastructure (database, services, etc).
// The main logic is in stable-evidence-bundle-support.ts which is tested separately.

test.skip("createStableEvidenceBundle requires complex runtime infrastructure", () => {
  // This function requires:
  // - SqliteDatabase instantiation
  // - AuthoritativeTaskStore
  // - Multiple service instances (DoctorService, HumanTakeoverService, etc.)
  // - runSingleTaskExecution for baseline
  // - All rehearsal functions (runStableChaosSmoke, runStablePromptInjectionRedTeam, etc.)
  // - EventOpsService.drainDefaultConsumers()
  // It cannot be meaningfully unit tested without mocking the entire platform stack.
});
