/**
 * Unit tests for interaction-baseline-catalog edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  listInteractionCapabilityBaselines,
  resolveInteractionCapabilityBaseline,
} from "../../../src/interaction/interaction-baseline-catalog.js";

test("listInteractionCapabilityBaselines returns all 6 capabilities", () => {
  const baselines = listInteractionCapabilityBaselines();

  assert.equal(baselines.length, 6);
});

test("listInteractionCapabilityBaselines returns frozen array", () => {
  const baselines = listInteractionCapabilityBaselines();

  assert.ok(Object.isFrozen(baselines));
});

test("each baseline has required capabilityId", () => {
  const baselines = listInteractionCapabilityBaselines();

  for (const baseline of baselines) {
    assert.ok(baseline.capabilityId.length > 0);
    assert.ok(baseline.entryModule.startsWith("src/interaction/"));
    assert.ok(baseline.description.length > 0);
    assert.ok(Array.isArray(baseline.architectureSections));
    assert.ok(Array.isArray(baseline.baselineServices));
    assert.ok(baseline.baselineServices.length > 0);
  }
});

test("resolveInteractionCapabilityBaseline returns nl-gateway baseline", () => {
  const baseline = resolveInteractionCapabilityBaseline("nl-gateway");

  assert.equal(baseline.capabilityId, "nl-gateway");
  assert.ok(baseline.baselineServices.includes("NlEntryService"));
  assert.ok(baseline.baselineServices.includes("ConversationContextManager"));
});

test("resolveInteractionCapabilityBaseline returns goal-decomposer baseline", () => {
  const baseline = resolveInteractionCapabilityBaseline("goal-decomposer");

  assert.equal(baseline.capabilityId, "goal-decomposer");
  assert.ok(baseline.baselineServices.includes("GoalDecompositionService"));
});

test("resolveInteractionCapabilityBaseline returns proactive-agent baseline", () => {
  const baseline = resolveInteractionCapabilityBaseline("proactive-agent");

  assert.equal(baseline.capabilityId, "proactive-agent");
  assert.ok(baseline.baselineServices.includes("ProactiveAgentService"));
});

test("resolveInteractionCapabilityBaseline returns autonomy baseline", () => {
  const baseline = resolveInteractionCapabilityBaseline("autonomy");

  assert.equal(baseline.capabilityId, "autonomy");
  assert.ok(baseline.baselineServices.includes("ProgressiveAutonomyService"));
  assert.ok(baseline.baselineServices.includes("AutonomyGovernanceService"));
});

test("resolveInteractionCapabilityBaseline returns dashboard baseline", () => {
  const baseline = resolveInteractionCapabilityBaseline("dashboard");

  assert.equal(baseline.capabilityId, "dashboard");
  assert.ok(baseline.baselineServices.includes("DashboardAggregationService"));
  assert.ok(baseline.baselineServices.includes("DashboardProjectionService"));
});

test("resolveInteractionCapabilityBaseline returns ux baseline", () => {
  const baseline = resolveInteractionCapabilityBaseline("ux");

  assert.equal(baseline.capabilityId, "ux");
  assert.ok(baseline.baselineServices.includes("UserPortalService"));
  assert.ok(baseline.baselineServices.includes("WorkflowBuilderService"));
  assert.ok(baseline.baselineServices.includes("UserExperienceOrchestrationService"));
});

test("resolveInteractionCapabilityBaseline throws for unknown capabilityId", () => {
  assert.throws(
    () => resolveInteractionCapabilityBaseline("unknown" as any),
    /interaction_capability.not_found/,
  );
});

test("all baseline service names are unique within each baseline", () => {
  const baselines = listInteractionCapabilityBaselines();

  for (const baseline of baselines) {
    const services = baseline.baselineServices;
    const unique = new Set(services);
    assert.equal(
      unique.size,
      services.length,
      `duplicate services in ${baseline.capabilityId}`,
    );
  }
});
