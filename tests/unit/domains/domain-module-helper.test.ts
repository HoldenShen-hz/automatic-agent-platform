import assert from "node:assert/strict";
import test from "node:test";
import {
  createDomainModulePreset,
  requiresPresetReview,
  type DomainModulePreset,
} from "../../../src/domains/domain-module-helper.js";
import { DomainRegistryService } from "../../../src/domains/registry/domain-registry-service.js";
import { getVerticalDomainBaseline } from "../../../src/domains/domain-baseline-catalog.js";
import type { VerticalDomainId } from "../../../src/domains/domain-baseline-catalog.js";

// =============================================================================
// Domain Module Metadata Tests
// =============================================================================

test("createDomainModulePreset returns correct domainId", () => {
  const preset = createDomainModulePreset("coding", ["analyze"], []);
  assert.equal(preset.domainId, "coding");
});

test("createDomainModulePreset returns correct displayName from baseline", () => {
  const preset = createDomainModulePreset("coding", [], []);
  assert.equal(preset.displayName, "Coding");
});

test("createDomainModulePreset returns displayName for each vertical domain", () => {
  const domainIds: VerticalDomainId[] = [
    "coding",
    "data-engineering",
    "knowledge-base",
    "user-operations",
    "quant-trading",
    "financial-services",
    "ecommerce",
    "advertising",
  ];

  for (const domainId of domainIds) {
    const preset = createDomainModulePreset(domainId, [], []);
    assert.ok(
      preset.displayName.length > 0,
      `displayName should not be empty for ${domainId}`,
    );
  }
});

test("createDomainModulePreset includes defaultWorkflowIds from baseline", () => {
  const preset = createDomainModulePreset("coding", [], []);
  const baseline = getVerticalDomainBaseline("coding");

  assert.deepEqual(preset.defaultWorkflowIds, baseline.definition.workflows.map((w) => w.workflowId));
});

test("createDomainModulePreset includes defaultToolBundleIds from baseline", () => {
  const preset = createDomainModulePreset("coding", [], []);
  const baseline = getVerticalDomainBaseline("coding");

  assert.deepEqual(preset.defaultToolBundleIds, baseline.definition.toolBundles.map((b) => b.bundleId));
});

test("createDomainModulePreset includes requiredCapabilities as frozen array", () => {
  const taskTypes = ["analyze", "implement", "test"] as const;
  const preset = createDomainModulePreset("coding", taskTypes, []);

  assert.deepEqual(preset.requiredCapabilities, taskTypes);
  assert.ok(Object.isFrozen(preset.requiredCapabilities));
});

test("createDomainModulePreset includes reviewRequiredTaskTypes as frozen array", () => {
  const reviewTypes = ["security_scan", "compliance_check"] as const;
  const preset = createDomainModulePreset("coding", [], reviewTypes);

  assert.deepEqual(preset.reviewRequiredTaskTypes, reviewTypes);
  assert.ok(Object.isFrozen(preset.reviewRequiredTaskTypes));
});

test("createDomainModulePreset returns deeply frozen object", () => {
  const preset = createDomainModulePreset("coding", ["analyze"], ["security_scan"]);

  assert.ok(Object.isFrozen(preset), "preset root should be frozen");
  assert.ok(Object.isFrozen(preset.requiredCapabilities), "requiredCapabilities should be frozen");
  assert.ok(Object.isFrozen(preset.reviewRequiredTaskTypes), "reviewRequiredTaskTypes should be frozen");
  assert.ok(Object.isFrozen(preset.defaultWorkflowIds), "defaultWorkflowIds should be frozen");
  assert.ok(Object.isFrozen(preset.defaultToolBundleIds), "defaultToolBundleIds should be frozen");
});

test("createDomainModulePreset works with empty arrays", () => {
  const preset = createDomainModulePreset("coding", [], []);

  assert.deepEqual(preset.requiredCapabilities, []);
  assert.deepEqual(preset.reviewRequiredTaskTypes, []);
});

test("createDomainModulePreset preserves readonly modifier on domainId", () => {
  const preset = createDomainModulePreset("coding", [], []);
  assert.throws(() => {
    // @ts-expect-error - domainId is readonly
    preset.domainId = "data-engineering";
  }, /read only/i);
});

// =============================================================================
// requiresPresetReview Tests
// =============================================================================

test("requiresPresetReview returns true when taskType is in reviewRequiredTaskTypes", () => {
  const preset = createDomainModulePreset("coding", ["analyze"], ["security_scan", "compliance_check"]);
  assert.equal(requiresPresetReview(preset, "security_scan"), true);
  assert.equal(requiresPresetReview(preset, "compliance_check"), true);
});

test("requiresPresetReview returns false when taskType is not in reviewRequiredTaskTypes", () => {
  const preset = createDomainModulePreset("coding", ["analyze", "implement"], ["security_scan"]);
  assert.equal(requiresPresetReview(preset, "analyze"), false);
  assert.equal(requiresPresetReview(preset, "implement"), false);
});

test("requiresPresetReview returns false when reviewRequiredTaskTypes is empty", () => {
  const preset = createDomainModulePreset("data-engineering", ["ingest"], []);
  assert.equal(requiresPresetReview(preset, "ingest"), false);
});

test("requiresPresetReview works with different domain presets", () => {
  // coding domain with high risk
  const codingPreset = createDomainModulePreset("coding", ["analyze"], ["security_scan"]);
  assert.equal(requiresPresetReview(codingPreset, "security_scan"), true);

  // data-engineering domain with medium risk
  const dataPreset = createDomainModulePreset("data-engineering", ["ingest"], []);
  assert.equal(requiresPresetReview(dataPreset, "ingest"), false);
});

// =============================================================================
// Module Registration with Domain Registry Tests
// =============================================================================

test("preset can be used to register domain with registry service", () => {
  const registry = new DomainRegistryService();
  const preset = createDomainModulePreset("coding", ["analyze", "implement"], []);
  const baseline = getVerticalDomainBaseline("coding");
  registry.register(baseline.definition);

  const registered = registry.get(preset.domainId);
  assert.ok(registered !== null, "domain should be registered");
  assert.equal(registered?.domainId, preset.domainId);
});

test("preset workflow IDs match registered domain workflows", () => {
  const registry = new DomainRegistryService();
  const preset = createDomainModulePreset("coding", [], []);
  const baseline = getVerticalDomainBaseline("coding");
  registry.register(baseline.definition);

  for (const workflowId of preset.defaultWorkflowIds) {
    const workflow = registry.getWorkflow(preset.domainId, workflowId);
    assert.ok(workflow !== null, `workflow ${workflowId} should exist`);
  }
});

test("preset tool bundle IDs match registered domain tool bundles", () => {
  const registry = new DomainRegistryService();
  const preset = createDomainModulePreset("coding", [], []);
  const baseline = getVerticalDomainBaseline("coding");
  registry.register(baseline.definition);

  for (const bundleId of preset.defaultToolBundleIds) {
    const bundle = registry.getToolBundle(preset.domainId, bundleId);
    assert.ok(bundle !== null, `bundle ${bundleId} should exist`);
  }
});

test("preset enables domain activation in registry", () => {
  const registry = new DomainRegistryService();
  const preset = createDomainModulePreset("coding", [], []);
  const baseline = getVerticalDomainBaseline("coding");
  registry.register(baseline.definition);

  registry.activate(preset.domainId, true);
  const activated = registry.activate(preset.domainId, false);
  assert.equal(activated.status, "active");
});

test("multiple domain presets can coexist in registry", () => {
  const registry = new DomainRegistryService();

  const codingPreset = createDomainModulePreset("coding", ["analyze"], []);
  const dataPreset = createDomainModulePreset("data-engineering", ["ingest"], []);
  registry.register(getVerticalDomainBaseline("coding").definition);
  registry.register(getVerticalDomainBaseline("data-engineering").definition);

  registry.activate(codingPreset.domainId, true);
  registry.activate(codingPreset.domainId, false);
  registry.activate(dataPreset.domainId, true);
  registry.activate(dataPreset.domainId, false);

  const domains = registry.listActive();
  assert.ok(domains.length >= 2);
  assert.ok(domains.some((d) => d.domainId === "coding"));
  assert.ok(domains.some((d) => d.domainId === "data-engineering"));
});

// =============================================================================
// Module Dependency Resolution Tests
// =============================================================================

test("preset exposes capabilities that can resolve dependencies", () => {
  const preset = createDomainModulePreset("coding", ["analyze", "implement", "test"], []);

  const capabilityIds = preset.requiredCapabilities;
  assert.ok(capabilityIds.includes("analyze"));
  assert.ok(capabilityIds.includes("implement"));
  assert.ok(capabilityIds.includes("test"));
});

test("workflow IDs provide dependency ordering from baseline", () => {
  const preset = createDomainModulePreset("coding", [], []);
  const baseline = getVerticalDomainBaseline("coding");

  // Verify workflow IDs are derived from baseline
  const workflowIds = preset.defaultWorkflowIds;
  const baselineWorkflowIds = baseline.definition.workflows.map((w) => w.workflowId);

  assert.deepEqual(workflowIds, baselineWorkflowIds);
});

test("tool bundle IDs provide required tools for dependency resolution", () => {
  const preset = createDomainModulePreset("coding", [], []);
  const baseline = getVerticalDomainBaseline("coding");

  const bundleIds = preset.defaultToolBundleIds;
  const baselineBundleIds = baseline.definition.toolBundles.map((b) => b.bundleId);

  assert.deepEqual(bundleIds, baselineBundleIds);
});

test("capabilities are correctly typed as readonly array", () => {
  const taskTypes = ["analyze", "implement"] as const;
  const preset = createDomainModulePreset("coding", taskTypes, []);

  type Capabilities = typeof preset.requiredCapabilities;
  const capabilities: Capabilities = preset.requiredCapabilities;

  // Verify readonly nature
  assert.deepEqual(capabilities, taskTypes);
});

// =============================================================================
// Domain Capability Detection Tests
// =============================================================================

test("preset correctly identifies supported task types", () => {
  const taskTypes = ["analyze", "implement", "test"] as const;
  const preset = createDomainModulePreset("coding", taskTypes, []);

  for (const taskType of taskTypes) {
    assert.ok(
      preset.requiredCapabilities.includes(taskType),
      `${taskType} should be a supported capability`,
    );
  }
});

test("preset correctly identifies review-required task types", () => {
  const reviewTypes = ["security_scan", "compliance_check", "code_review"] as const;
  const preset = createDomainModulePreset("coding", [], reviewTypes);

  for (const reviewType of reviewTypes) {
    assert.ok(
      preset.reviewRequiredTaskTypes.includes(reviewType),
      `${reviewType} should require review`,
    );
  }
});

test("requiresPresetReview correctly distinguishes supported vs review-required", () => {
  const supported = ["analyze", "implement", "test"] as const;
  const reviewRequired = ["security_scan", "compliance_check"] as const;
  const preset = createDomainModulePreset("coding", supported, reviewRequired);

  for (const taskType of supported) {
    assert.equal(
      requiresPresetReview(preset, taskType),
      false,
      `${taskType} should not require review`,
    );
  }

  for (const taskType of reviewRequired) {
    assert.equal(
      requiresPresetReview(preset, taskType),
      true,
      `${taskType} should require review`,
    );
  }
});

test("capabilities detection works across multiple domains", () => {
  const codingPreset = createDomainModulePreset("coding", ["analyze"], ["security_scan"]);
  const dataPreset = createDomainModulePreset("data-engineering", ["ingest", "clean"], []);
  const financialPreset = createDomainModulePreset("financial-services", ["risk_assess"], ["compliance_check"]);

  // Coding capabilities
  assert.ok(codingPreset.requiredCapabilities.includes("analyze"));
  assert.ok(requiresPresetReview(codingPreset, "security_scan"));

  // Data engineering capabilities
  assert.ok(dataPreset.requiredCapabilities.includes("ingest"));
  assert.ok(dataPreset.requiredCapabilities.includes("clean"));
  assert.ok(!requiresPresetReview(dataPreset, "ingest"));

  // Financial services capabilities
  assert.ok(financialPreset.requiredCapabilities.includes("risk_assess"));
  assert.ok(requiresPresetReview(financialPreset, "compliance_check"));
});

test("preset capability structure matches DomainModulePreset interface", () => {
  const preset: DomainModulePreset<string> = createDomainModulePreset(
    "coding",
    ["analyze"],
    ["security_scan"],
  );

  // Verify interface compliance
  assert.equal(typeof preset.domainId, "string");
  assert.equal(typeof preset.displayName, "string");
  assert.ok(Array.isArray(preset.defaultWorkflowIds));
  assert.ok(Array.isArray(preset.defaultToolBundleIds));
  assert.ok(Array.isArray(preset.requiredCapabilities));
  assert.ok(Array.isArray(preset.reviewRequiredTaskTypes));
});

test("preset with all task types covered", () => {
  const baseline = getVerticalDomainBaseline("coding");
  const allTaskTypes = baseline.definition.capabilities.supportedTaskTypes;

  const preset = createDomainModulePreset("coding", allTaskTypes, []);

  assert.deepEqual(preset.requiredCapabilities, allTaskTypes);
});

test("preset for healthcare domain with regulated capabilities", () => {
  const preset = createDomainModulePreset(
    "healthcare",
    ["patient_data_review", "treatment_plan"],
    ["compliance_check"],
  );

  assert.equal(preset.domainId, "healthcare");
  assert.ok(preset.requiredCapabilities.includes("patient_data_review"));
  assert.ok(requiresPresetReview(preset, "compliance_check"));
});

test("preset for ecommerce domain with standard capabilities", () => {
  const preset = createDomainModulePreset(
    "ecommerce",
    ["order_process", "inventory_check"],
    [],
  );

  assert.equal(preset.domainId, "ecommerce");
  assert.ok(preset.requiredCapabilities.includes("order_process"));
  assert.ok(!requiresPresetReview(preset, "order_process"));
});
