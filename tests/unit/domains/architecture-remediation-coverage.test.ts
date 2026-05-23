import { describe, it } from "node:test";
import { expect } from "../../helpers/node-expect.js";
import {
  canTransitionDomain,
  validateActiveDomainDescriptor,
  buildDomainsSdkRemediationEvidence,
  DOMAIN_META_MODEL_QUESTIONS,
  type DomainLifecycleState,
  type DomainPluginType,
  type DomainRecipeArchetype,
  type DomainDescriptorProfile,
} from "../../../src/domains/architecture-remediation.js";

const legacyState = (state: string): DomainLifecycleState => state as DomainLifecycleState;

describe("architecture-remediation", () => {
  describe("canTransitionDomain", () => {
    it("should allow Draft to Validated transition", () => {
      expect(canTransitionDomain(legacyState("Draft"), legacyState("Validated"))).toBe(true);
    });

    it("should allow Draft to Archived transition", () => {
      expect(canTransitionDomain(legacyState("Draft"), legacyState("Archived"))).toBe(true);
    });

    it("should allow Validated to Registered transition", () => {
      expect(canTransitionDomain(legacyState("Validated"), legacyState("Registered"))).toBe(true);
    });

    it("should allow Validated to Draft transition", () => {
      expect(canTransitionDomain(legacyState("Validated"), legacyState("Draft"))).toBe(true);
    });

    it("should allow Registered to Active transition", () => {
      expect(canTransitionDomain(legacyState("Registered"), legacyState("Active"))).toBe(true);
    });

    it("should allow Registered to Deprecated transition", () => {
      expect(canTransitionDomain(legacyState("Registered"), legacyState("Deprecated"))).toBe(true);
    });

    it("should allow Active to Updating transition", () => {
      expect(canTransitionDomain(legacyState("Active"), legacyState("Updating"))).toBe(true);
    });

    it("should allow Active to Deprecated transition", () => {
      expect(canTransitionDomain(legacyState("Active"), legacyState("Deprecated"))).toBe(true);
    });

    it("should allow Updating to Active transition", () => {
      expect(canTransitionDomain(legacyState("Updating"), legacyState("Active"))).toBe(true);
    });

    it("should allow Updating to Deprecated transition", () => {
      expect(canTransitionDomain(legacyState("Updating"), legacyState("Deprecated"))).toBe(true);
    });

    it("should allow Deprecated to Archived transition", () => {
      expect(canTransitionDomain(legacyState("Deprecated"), legacyState("Archived"))).toBe(true);
    });

    it("should not allow Draft to Active transition", () => {
      expect(canTransitionDomain(legacyState("Draft"), legacyState("Active"))).toBe(false);
    });

    it("should not allow Archived to any transition", () => {
      expect(canTransitionDomain(legacyState("Archived"), legacyState("Draft"))).toBe(false);
      expect(canTransitionDomain(legacyState("Archived"), legacyState("Validated"))).toBe(false);
    });

    it("should allow validating to certified transition", () => {
      expect(canTransitionDomain("validating", "certified")).toBe(true);
    });

    it("should allow certified to canary transition", () => {
      expect(canTransitionDomain("certified", "canary")).toBe(true);
    });

    it("should allow certified to validating transition", () => {
      expect(canTransitionDomain("certified", "validating")).toBe(true);
    });

    it("should allow canary to active transition", () => {
      expect(canTransitionDomain("canary", "active")).toBe(true);
    });

    it("should allow canary to deprecated transition", () => {
      expect(canTransitionDomain("canary", "deprecated")).toBe(true);
    });

    it("should allow active to canary transition", () => {
      expect(canTransitionDomain("active", "canary")).toBe(true);
    });

    it("should allow active to deprecated transition", () => {
      expect(canTransitionDomain("active", "deprecated")).toBe(true);
    });

    it("should allow deprecated to retired transition", () => {
      expect(canTransitionDomain("deprecated", "retired")).toBe(true);
    });

    it("should not allow retired to any transition", () => {
      expect(canTransitionDomain("retired", "active")).toBe(false);
      expect(canTransitionDomain("retired", "deprecated")).toBe(false);
    });
  });

  describe("validateActiveDomainDescriptor", () => {
    it("should return no findings for valid active domain descriptor", () => {
      const descriptor: DomainDescriptorProfile = {
        domainId: "test_domain",
        lifecycleState: "active",
        executionMode: "supervised",
        hotPathMode: "deterministic_only",
        planningMode: "plan_graph_required",
      };
      expect(validateActiveDomainDescriptor(descriptor)).toEqual([]);
    });

    it("should return finding when lifecycle state is not active", () => {
      const descriptor: DomainDescriptorProfile = {
        domainId: "test_domain",
        lifecycleState: "validating",
        executionMode: "supervised",
        hotPathMode: "deterministic_only",
        planningMode: "plan_graph_required",
      };
      const findings = validateActiveDomainDescriptor(descriptor);
      expect(findings).toContain("domain_descriptor.not_active");
    });

    it("should return finding when planning mode is not plan_graph_required", () => {
      const descriptor: DomainDescriptorProfile = {
        domainId: "test_domain",
        lifecycleState: "active",
        executionMode: "supervised",
        hotPathMode: "deterministic_only",
        planningMode: "legacy_projection",
      };
      const findings = validateActiveDomainDescriptor(descriptor);
      expect(findings).toContain("domain_descriptor.plan_graph_required");
    });

    it("should return finding when full_auto with llm_allowed hot path", () => {
      const descriptor: DomainDescriptorProfile = {
        domainId: "test_domain",
        lifecycleState: "active",
        executionMode: "full_auto",
        hotPathMode: "llm_allowed",
        planningMode: "plan_graph_required",
      };
      const findings = validateActiveDomainDescriptor(descriptor);
      expect(findings).toContain(
        "domain_descriptor.full_auto_hot_path_requires_deterministic_mode",
      );
    });

    it("should return multiple findings when multiple issues exist", () => {
      const descriptor: DomainDescriptorProfile = {
        domainId: "test_domain",
        lifecycleState: "validating",
        executionMode: "full_auto",
        hotPathMode: "llm_allowed",
        planningMode: "legacy_projection",
      };
      const findings = validateActiveDomainDescriptor(descriptor);
      expect(findings.length).toBeGreaterThanOrEqual(3);
    });

    it("should allow full_auto with deterministic_only hot path", () => {
      const descriptor: DomainDescriptorProfile = {
        domainId: "test_domain",
        lifecycleState: "active",
        executionMode: "full_auto",
        hotPathMode: "deterministic_only",
        planningMode: "plan_graph_required",
      };
      expect(validateActiveDomainDescriptor(descriptor)).toEqual([]);
    });
  });

  describe("buildDomainsSdkRemediationEvidence", () => {
    it("should return array of 20 evidence items", () => {
      const evidence = buildDomainsSdkRemediationEvidence();
      expect(evidence).toHaveLength(20);
    });

    it("should return evidence with D- prefix format", () => {
      const evidence = buildDomainsSdkRemediationEvidence();
      expect(evidence[0]).toBe("D-1");
      expect(evidence[19]).toBe("D-20");
    });

    it("should return mutable evidence array", () => {
      const evidence = buildDomainsSdkRemediationEvidence();
      expect(Object.isFrozen(evidence)).toBe(false);
    });
  });

  describe("DOMAIN_META_MODEL_QUESTIONS", () => {
    it("should have 15 questions defined", () => {
      expect(DOMAIN_META_MODEL_QUESTIONS).toHaveLength(15);
    });

    it("should have required field set correctly", () => {
      const requiredQuestions = DOMAIN_META_MODEL_QUESTIONS.filter(
        (q) => q.required,
      );
      expect(requiredQuestions.every((q) => q.required)).toBe(true);
    });

    it("should have valid question IDs (Q1 through Q15)", () => {
      for (let i = 0; i < 15; i++) {
        expect(DOMAIN_META_MODEL_QUESTIONS[i]!.questionId).toBe(`Q${i + 1}`);
      }
    });

    it("should have all required keys", () => {
      const keys = DOMAIN_META_MODEL_QUESTIONS.map((q) => q.key);
      expect(keys).toContain("domain_goal");
      expect(keys).toContain("user_roles");
      expect(keys).toContain("input_sources");
      expect(keys).toContain("output_contracts");
      expect(keys).toContain("tools");
      expect(keys).toContain("data_classes");
      expect(keys).toContain("risk_controls");
      expect(keys).toContain("approval_model");
      expect(keys).toContain("eval_requirements");
      expect(keys).toContain("slo_profile");
      expect(keys).toContain("budget_constraints");
      expect(keys).toContain("knowledge_boundaries");
      expect(keys).toContain("liability_owner");
      expect(keys).toContain("compensation_model");
      expect(keys).toContain("adversarial_scenarios");
    });
  });

  describe("DomainPluginType", () => {
    it("should have correct plugin types exported", () => {
      const pluginType: DomainPluginType = "evaluator";
      expect(pluginType).toBe("evaluator");
    });
  });

  describe("DomainRecipeArchetype", () => {
    it("should have all expected archetypes", () => {
      const archetype: DomainRecipeArchetype = "research_synthesis";
      expect(archetype).toBe("research_synthesis");
    });
  });
});
