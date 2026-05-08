import assert from "node:assert/strict";
import test from "node:test";

import {
  DomainCoreDescriptorSchema,
  DomainEvalSpecSchema,
  DomainExecutionProfileSchema,
  DomainGovernanceSpecSchema,
  DomainInteractionSpecSchema,
  DomainKnowledgeSpecSchema,
  DomainRiskSpecSchema,
} from "../../../../src/domains/domain-specs.js";
import { DomainDefinitionSchema } from "../../../../src/domains/registry/domain-model.js";

test("DomainCoreDescriptorSchema parses authoritative core descriptor", () => {
  const result = DomainCoreDescriptorSchema.parse({
    domainId: "legal",
    ownerOrgNodeId: "org-legal",
    primaryEntities: ["case", "clause"],
    recipeArchetype: "compliance",
  });

  assert.equal(result.domainId, "legal");
  assert.equal(result.lifecycleState, "draft");
  assert.deepEqual(result.primaryEntities, ["case", "clause"]);
});

test("DomainRiskSpecSchema requires liability owners and compensation model", () => {
  const result = DomainRiskSpecSchema.parse({
    domainId: "healthcare",
    riskClass: "critical",
    humanAccountable: true,
    deterministicHotPathOnly: true,
    liabilityOwner: ["healthcare-owners"],
    compensationModel: ["manual_repair", "appeal"],
  });

  assert.equal(result.riskClass, "critical");
  assert.equal(result.advisoryOnly, false);
  assert.equal(result.approvalThresholds.manual_review ?? undefined, undefined);
});

test("Domain descriptor satellite schemas apply current defaults", () => {
  const knowledge = DomainKnowledgeSpecSchema.parse({ domainId: "finance" });
  const evalSpec = DomainEvalSpecSchema.parse({ domainId: "finance" });
  const governance = DomainGovernanceSpecSchema.parse({ domainId: "finance" });
  const interaction = DomainInteractionSpecSchema.parse({ domainId: "finance" });

  assert.equal(knowledge.accessControlPolicy, "platform_default");
  assert.deepEqual(evalSpec.evalBaselines, []);
  assert.equal(governance.waiverPolicy, "explicit_waiver_required");
  assert.equal(interaction.dashboardPolicy, "evidence_backed");
});

test("DomainExecutionProfileSchema reflects current runtime defaults", () => {
  const result = DomainExecutionProfileSchema.parse({});

  assert.equal(result.executionMode.planningMode, "llm_assisted");
  assert.equal(result.executionMode.hotPathMode, "llm_allowed");
  assert.equal(result.executionMode.maxHotPathLatencyMs, 1000);
  assert.equal(result.latencyTier, "interactive");
  assert.equal(result.compiledArtifactRef, null);
});

test("DomainDefinitionSchema integrates execution profile and plugin role aliases", () => {
  const result = DomainDefinitionSchema.parse({
    domainId: "descriptor-integration",
    name: "Descriptor Integration",
    description: "Covers the current domain definition shape.",
    workflows: [],
    toolBundles: [],
    outputContracts: [],
    promptOverrides: {},
    capabilities: {
      supportedTaskTypes: ["analysis"],
      requiredTools: [],
      optionalTools: ["search"],
      modelPreferences: { summarize: "gpt-5.5" },
      budgetLimits: { maxTokensPerTask: 8000, maxCostPerTask: 3 },
      securityLevel: "standard",
    },
    pluginBindings: [
      {
        bindingId: "binding-planner",
        domainId: "descriptor-integration",
        pluginType: "planner",
        bindingRole: "planner",
        pluginId: "plugin.planner",
      },
    ],
    executionProfile: {
      executionMode: {
        planningMode: "deterministic_only",
        hotPathMode: "deterministic_only",
        llmInHotPathAllowed: false,
        maxHotPathLatencyMs: 250,
      },
      latencyTier: "realtime",
      compiledArtifactRef: "artifact://compiled/legal-v1",
    },
  });

  assert.equal(result.pluginBindings[0]?.pluginType, "tool");
  assert.equal(result.pluginBindings[0]?.bindingRole, "planner");
  assert.equal(result.executionProfile.latencyTier, "realtime");
  assert.equal(result.executionProfile.executionMode.llmInHotPathAllowed, false);
});
