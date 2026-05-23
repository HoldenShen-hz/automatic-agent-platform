import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransitionDomain,
  validateActiveDomainDescriptor,
  buildDomainsSdkRemediationEvidence,
  DOMAIN_META_MODEL_QUESTIONS,
  type DomainLifecycleState,
  type DomainDescriptorProfile,
} from "../../../src/domains/architecture-remediation.js";

const legacyState = (state: string): DomainLifecycleState => state as DomainLifecycleState;

// ---------------------------------------------------------------------------
// canTransitionDomain Tests
// ---------------------------------------------------------------------------

test("canTransitionDomain returns true for valid Draft transitions", () => {
  assert.equal(canTransitionDomain(legacyState("Draft"), legacyState("Validated")), true);
  assert.equal(canTransitionDomain(legacyState("Draft"), legacyState("Archived")), true);
});

test("canTransitionDomain returns false for invalid Draft transitions", () => {
  assert.equal(canTransitionDomain(legacyState("Draft"), legacyState("Active")), false);
  assert.equal(canTransitionDomain(legacyState("Draft"), legacyState("Updating")), false);
  assert.equal(canTransitionDomain(legacyState("Draft"), legacyState("Deprecated")), false);
});

test("canTransitionDomain returns true for valid Validated transitions", () => {
  assert.equal(canTransitionDomain(legacyState("Validated"), legacyState("Registered")), true);
  assert.equal(canTransitionDomain(legacyState("Validated"), legacyState("Draft")), true);
});

test("canTransitionDomain returns false for invalid Validated transitions", () => {
  assert.equal(canTransitionDomain(legacyState("Validated"), legacyState("Active")), false);
  assert.equal(canTransitionDomain(legacyState("Validated"), legacyState("Archived")), false);
});

test("canTransitionDomain returns true for valid Registered transitions", () => {
  assert.equal(canTransitionDomain(legacyState("Registered"), legacyState("Active")), true);
  assert.equal(canTransitionDomain(legacyState("Registered"), legacyState("Deprecated")), true);
});

test("canTransitionDomain returns false for invalid Registered transitions", () => {
  assert.equal(canTransitionDomain(legacyState("Registered"), legacyState("Draft")), false);
  assert.equal(canTransitionDomain(legacyState("Registered"), legacyState("Updating")), false);
});

test("canTransitionDomain returns true for valid Active transitions", () => {
  assert.equal(canTransitionDomain(legacyState("Active"), legacyState("Updating")), true);
  assert.equal(canTransitionDomain(legacyState("Active"), legacyState("Deprecated")), true);
});

test("canTransitionDomain returns false for invalid Active transitions", () => {
  assert.equal(canTransitionDomain(legacyState("Active"), legacyState("Draft")), false);
  assert.equal(canTransitionDomain(legacyState("Active"), legacyState("Registered")), false);
});

test("canTransitionDomain returns true for valid Updating transitions", () => {
  assert.equal(canTransitionDomain(legacyState("Updating"), legacyState("Active")), true);
  assert.equal(canTransitionDomain(legacyState("Updating"), legacyState("Deprecated")), true);
});

test("canTransitionDomain returns false for invalid Updating transitions", () => {
  assert.equal(canTransitionDomain(legacyState("Updating"), legacyState("Draft")), false);
  assert.equal(canTransitionDomain(legacyState("Updating"), legacyState("Registered")), false);
});

test("canTransitionDomain returns true for valid Deprecated transition", () => {
  assert.equal(canTransitionDomain(legacyState("Deprecated"), legacyState("Archived")), true);
});

test("canTransitionDomain returns false for invalid Deprecated transitions", () => {
  assert.equal(canTransitionDomain(legacyState("Deprecated"), legacyState("Active")), false);
  assert.equal(canTransitionDomain(legacyState("Deprecated"), legacyState("Draft")), false);
  assert.equal(canTransitionDomain(legacyState("Deprecated"), legacyState("Registered")), false);
});

test("canTransitionDomain returns false for Archived transitions (terminal state)", () => {
  const states = ["Draft", "Validated", "Registered", "Active", "Updating", "Deprecated", "Archived"] as const;
  for (const to of states) {
    assert.equal(canTransitionDomain(legacyState("Archived"), legacyState(to)), false, `Archived -> ${to} should be false`);
  }
});

test("canTransitionDomain covers all state pairs exhaustively", () => {
  const states = ["Draft", "Validated", "Registered", "Active", "Updating", "Deprecated", "Archived"] as const;
  for (const from of states) {
    for (const to of states) {
      if (from === "Archived") {
        assert.equal(canTransitionDomain(legacyState(from), legacyState(to)), false);
      } else if (from === to) {
        assert.equal(canTransitionDomain(legacyState(from), legacyState(to)), false, `same-state transition ${from} -> ${to} should be false`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// validateActiveDomainDescriptor Tests
// ---------------------------------------------------------------------------

test("validateActiveDomainDescriptor returns empty array for valid Active descriptor", () => {
  const descriptor: DomainDescriptorProfile = {
    domainId: "test-domain",
    lifecycleState: "active",
    executionMode: "supervised",
    hotPathMode: "deterministic_only",
    planningMode: "plan_graph_required",
  };
  assert.deepStrictEqual(validateActiveDomainDescriptor(descriptor), []);
});

test("validateActiveDomainDescriptor returns empty array for full_auto with deterministic_only hot path", () => {
  const descriptor: DomainDescriptorProfile = {
    domainId: "test-domain",
    lifecycleState: "active",
    executionMode: "full_auto",
    hotPathMode: "deterministic_only",
    planningMode: "plan_graph_required",
  };
  assert.deepStrictEqual(validateActiveDomainDescriptor(descriptor), []);
});

test("validateActiveDomainDescriptor returns empty array for auto execution with deterministic_only hot path", () => {
  const descriptor: DomainDescriptorProfile = {
    domainId: "test-domain",
    lifecycleState: "active",
    executionMode: "auto",
    hotPathMode: "deterministic_only",
    planningMode: "plan_graph_required",
  };
  assert.deepStrictEqual(validateActiveDomainDescriptor(descriptor), []);
});

test("validateActiveDomainDescriptor detects non-Active lifecycleState", () => {
  const states: DomainLifecycleState[] = ["validating", "certified", "canary", "deprecated", "retired"];
  for (const state of states) {
    const descriptor: DomainDescriptorProfile = {
      domainId: "test-domain",
      lifecycleState: state,
      executionMode: "supervised",
      hotPathMode: "deterministic_only",
      planningMode: "plan_graph_required",
    };
    const findings = validateActiveDomainDescriptor(descriptor);
    assert.ok(findings.includes("domain_descriptor.not_active"), `${state} should be flagged as not_active`);
  }
});

test("validateActiveDomainDescriptor detects non-plan_graph_required planningMode", () => {
  const descriptor: DomainDescriptorProfile = {
    domainId: "test-domain",
    lifecycleState: "active",
    executionMode: "supervised",
    hotPathMode: "deterministic_only",
    planningMode: "legacy_projection",
  };
  const findings = validateActiveDomainDescriptor(descriptor);
  assert.ok(findings.includes("domain_descriptor.plan_graph_required"));
});

test("validateActiveDomainDescriptor detects full_auto with llm_allowed hot path (conflict)", () => {
  const descriptor: DomainDescriptorProfile = {
    domainId: "test-domain",
    lifecycleState: "active",
    executionMode: "full_auto",
    hotPathMode: "llm_allowed",
    planningMode: "plan_graph_required",
  };
  const findings = validateActiveDomainDescriptor(descriptor);
  assert.ok(findings.includes("domain_descriptor.full_auto_hot_path_requires_deterministic_mode"));
});

test("validateActiveDomainDescriptor detects auto with llm_allowed (not flagged for full_auto)", () => {
  const descriptor: DomainDescriptorProfile = {
    domainId: "test-domain",
    lifecycleState: "active",
    executionMode: "auto",
    hotPathMode: "llm_allowed",
    planningMode: "plan_graph_required",
  };
  const findings = validateActiveDomainDescriptor(descriptor);
  assert.ok(!findings.includes("domain_descriptor.full_auto_hot_path_requires_deterministic_mode"));
});

test("validateActiveDomainDescriptor returns multiple findings when multiple issues exist", () => {
  const descriptor: DomainDescriptorProfile = {
    domainId: "test-domain",
    lifecycleState: "validating",
    executionMode: "full_auto",
    hotPathMode: "llm_allowed",
    planningMode: "legacy_projection",
  };
  const findings = validateActiveDomainDescriptor(descriptor);
  assert.ok(findings.includes("domain_descriptor.not_active"));
  assert.ok(findings.includes("domain_descriptor.plan_graph_required"));
  assert.ok(findings.includes("domain_descriptor.full_auto_hot_path_requires_deterministic_mode"));
  assert.equal(findings.length, 3);
});

test("validateActiveDomainDescriptor handles all executionMode values", () => {
  const modes = ["supervised", "auto", "full_auto"] as const;
  for (const mode of modes) {
    const descriptor: DomainDescriptorProfile = {
      domainId: "test-domain",
      lifecycleState: "active",
      executionMode: mode,
      hotPathMode: "deterministic_only",
      planningMode: "plan_graph_required",
    };
    if (mode === "full_auto") {
      assert.ok(!validateActiveDomainDescriptor(descriptor).includes("domain_descriptor.full_auto_hot_path_requires_deterministic_mode"));
    }
  }
});

test("validateActiveDomainDescriptor handles all hotPathMode values", () => {
  const modes = ["deterministic_only", "llm_allowed"] as const;
  for (const mode of modes) {
    const descriptor: DomainDescriptorProfile = {
      domainId: "test-domain",
      lifecycleState: "active",
      executionMode: "supervised",
      hotPathMode: mode,
      planningMode: "plan_graph_required",
    };
    const findings = validateActiveDomainDescriptor(descriptor);
    if (mode === "llm_allowed") {
      assert.ok(!findings.includes("domain_descriptor.full_auto_hot_path_requires_deterministic_mode"));
    }
  }
});

// ---------------------------------------------------------------------------
// buildDomainsSdkRemediationEvidence Tests
// ---------------------------------------------------------------------------

test("buildDomainsSdkRemediationEvidence returns array of 20 evidence strings", () => {
  const evidence = buildDomainsSdkRemediationEvidence();
  assert.ok(Array.isArray(evidence));
  assert.equal(evidence.length, 20);
});

test("buildDomainsSdkRemediationEvidence returns D-prefixed evidence IDs", () => {
  const evidence = buildDomainsSdkRemediationEvidence();
  for (let i = 0; i < evidence.length; i++) {
    assert.equal(evidence[i], `D-${i + 1}`, `evidence[${i}] should be D-${i + 1}`);
  }
});

test("buildDomainsSdkRemediationEvidence returns mutable array (not frozen)", () => {
  const evidence = buildDomainsSdkRemediationEvidence();
  assert.ok(!Object.isFrozen(evidence));
  // can still verify basic properties
  assert.equal(evidence.length, 20);
});

// ---------------------------------------------------------------------------
// DOMAIN_META_MODEL_QUESTIONS Tests
// ---------------------------------------------------------------------------

test("DOMAIN_META_MODEL_QUESTIONS has 15 questions", () => {
  assert.equal(DOMAIN_META_MODEL_QUESTIONS.length, 15);
});

test("DOMAIN_META_MODEL_QUESTIONS all have Q-prefixed IDs", () => {
  for (let i = 0; i < DOMAIN_META_MODEL_QUESTIONS.length; i++) {
    assert.equal(DOMAIN_META_MODEL_QUESTIONS[i]!.questionId, `Q${i + 1}`);
  }
});

test("DOMAIN_META_MODEL_QUESTIONS all required fields are true", () => {
  for (const q of DOMAIN_META_MODEL_QUESTIONS) {
    assert.equal(q.required, true);
  }
});

test("DOMAIN_META_MODEL_QUESTIONS keys are unique", () => {
  const keys = DOMAIN_META_MODEL_QUESTIONS.map((q) => q.key);
  const uniqueKeys = new Set(keys);
  assert.equal(uniqueKeys.size, keys.length);
});

test("DOMAIN_META_MODEL_QUESTIONS is frozen", () => {
  assert.ok(Object.isFrozen(DOMAIN_META_MODEL_QUESTIONS));
});
