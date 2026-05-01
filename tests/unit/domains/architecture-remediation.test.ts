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

// ---------------------------------------------------------------------------
// canTransitionDomain Tests
// ---------------------------------------------------------------------------

test("canTransitionDomain returns true for valid Draft transitions", () => {
  assert.equal(canTransitionDomain("Draft", "Validated"), true);
  assert.equal(canTransitionDomain("Draft", "Archived"), true);
});

test("canTransitionDomain returns false for invalid Draft transitions", () => {
  assert.equal(canTransitionDomain("Draft", "Active"), false);
  assert.equal(canTransitionDomain("Draft", "Updating"), false);
  assert.equal(canTransitionDomain("Draft", "Deprecated"), false);
});

test("canTransitionDomain returns true for valid Validated transitions", () => {
  assert.equal(canTransitionDomain("Validated", "Registered"), true);
  assert.equal(canTransitionDomain("Validated", "Draft"), true);
});

test("canTransitionDomain returns false for invalid Validated transitions", () => {
  assert.equal(canTransitionDomain("Validated", "Active"), false);
  assert.equal(canTransitionDomain("Validated", "Archived"), false);
});

test("canTransitionDomain returns true for valid Registered transitions", () => {
  assert.equal(canTransitionDomain("Registered", "Active"), true);
  assert.equal(canTransitionDomain("Registered", "Deprecated"), true);
});

test("canTransitionDomain returns false for invalid Registered transitions", () => {
  assert.equal(canTransitionDomain("Registered", "Draft"), false);
  assert.equal(canTransitionDomain("Registered", "Updating"), false);
});

test("canTransitionDomain returns true for valid Active transitions", () => {
  assert.equal(canTransitionDomain("Active", "Updating"), true);
  assert.equal(canTransitionDomain("Active", "Deprecated"), true);
});

test("canTransitionDomain returns false for invalid Active transitions", () => {
  assert.equal(canTransitionDomain("Active", "Draft"), false);
  assert.equal(canTransitionDomain("Active", "Registered"), false);
});

test("canTransitionDomain returns true for valid Updating transitions", () => {
  assert.equal(canTransitionDomain("Updating", "Active"), true);
  assert.equal(canTransitionDomain("Updating", "Deprecated"), true);
});

test("canTransitionDomain returns false for invalid Updating transitions", () => {
  assert.equal(canTransitionDomain("Updating", "Draft"), false);
  assert.equal(canTransitionDomain("Updating", "Registered"), false);
});

test("canTransitionDomain returns true for valid Deprecated transition", () => {
  assert.equal(canTransitionDomain("Deprecated", "Archived"), true);
});

test("canTransitionDomain returns false for invalid Deprecated transitions", () => {
  assert.equal(canTransitionDomain("Deprecated", "Active"), false);
  assert.equal(canTransitionDomain("Deprecated", "Draft"), false);
  assert.equal(canTransitionDomain("Deprecated", "Registered"), false);
});

test("canTransitionDomain returns false for Archived transitions (terminal state)", () => {
  const states: DomainLifecycleState[] = ["Draft", "Validated", "Registered", "Active", "Updating", "Deprecated", "Archived"];
  for (const to of states) {
    assert.equal(canTransitionDomain("Archived", to), false, `Archived -> ${to} should be false`);
  }
});

test("canTransitionDomain covers all state pairs exhaustively", () => {
  const states: DomainLifecycleState[] = ["Draft", "Validated", "Registered", "Active", "Updating", "Deprecated", "Archived"];
  for (const from of states) {
    for (const to of states) {
      if (from === "Archived") {
        assert.equal(canTransitionDomain(from, to), false);
      } else if (from === to) {
        assert.equal(canTransitionDomain(from, to), false, `same-state transition ${from} -> ${to} should be false`);
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
    lifecycleState: "Active",
    executionMode: "supervised",
    hotPathMode: "deterministic_only",
    planningMode: "plan_graph_required",
  };
  assert.deepStrictEqual(validateActiveDomainDescriptor(descriptor), []);
});

test("validateActiveDomainDescriptor returns empty array for full_auto with deterministic_only hot path", () => {
  const descriptor: DomainDescriptorProfile = {
    domainId: "test-domain",
    lifecycleState: "Active",
    executionMode: "full_auto",
    hotPathMode: "deterministic_only",
    planningMode: "plan_graph_required",
  };
  assert.deepStrictEqual(validateActiveDomainDescriptor(descriptor), []);
});

test("validateActiveDomainDescriptor returns empty array for auto execution with deterministic_only hot path", () => {
  const descriptor: DomainDescriptorProfile = {
    domainId: "test-domain",
    lifecycleState: "Active",
    executionMode: "auto",
    hotPathMode: "deterministic_only",
    planningMode: "plan_graph_required",
  };
  assert.deepStrictEqual(validateActiveDomainDescriptor(descriptor), []);
});

test("validateActiveDomainDescriptor detects non-Active lifecycleState", () => {
  const states: DomainLifecycleState[] = ["Draft", "Validated", "Registered", "Updating", "Deprecated", "Archived"];
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
    lifecycleState: "Active",
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
    lifecycleState: "Active",
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
    lifecycleState: "Active",
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
    lifecycleState: "Draft",
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
      lifecycleState: "Active",
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
      lifecycleState: "Active",
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
