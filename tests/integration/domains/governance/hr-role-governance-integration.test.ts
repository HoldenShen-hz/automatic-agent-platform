/**
 * Integration Test: HR Role Governance Service
 *
 * Tests HR role lifecycle management including gap analysis,
 * role proposal creation, and division role assignment.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HrRoleGovernanceService, type HrGapAnalysisRequest } from "../../../../src/domains/governance/hr-role-governance-service.js";
import type { DivisionRegistry, LoadedDivisionDefinition } from "../../../../src/domains/governance/division-loader.js";

function makeDivision(overrides: Partial<LoadedDivisionDefinition> & Pick<LoadedDivisionDefinition, "id" | "roles">): LoadedDivisionDefinition {
  return {
    id: overrides.id,
    version: "1.0.0",
    name: overrides.name ?? overrides.id,
    description: overrides.description ?? `${overrides.id} division`,
    priority: overrides.priority ?? 1,
    triggers: overrides.triggers ?? [],
    defaultWorkflowId: overrides.defaultWorkflowId ?? "default",
    orchestrationWorkflowId: overrides.orchestrationWorkflowId ?? null,
    roles: overrides.roles,
    workflows: overrides.workflows ?? [],
    rootPath: overrides.rootPath ?? `/tmp/${overrides.id}`,
  };
}

function createDivisionRegistry(): DivisionRegistry {
  return {
    divisions: new Map([
      ["engineering", makeDivision({
        id: "engineering",
        roles: [
          {
            id: "code_reviewer",
            name: "Code Reviewer",
            promptPath: "/tmp/engineering/code-reviewer.prompt.md",
            promptText: "Reviews code for quality and correctness.",
            model: "balanced",
            tools: ["read", "question"],
            maxInstances: 2,
          },
          {
            id: "deploy_engineer",
            name: "Deploy Engineer",
            promptPath: "/tmp/engineering/deploy-engineer.prompt.md",
            promptText: "Deploys and releases production services safely.",
            model: "coding",
            tools: ["read", "apply_patch"],
            maxInstances: 1,
          },
        ],
      })],
      ["security_ops", makeDivision({
        id: "security_ops",
        roles: [
          {
            id: "security_analyst",
            name: "Security Analyst",
            promptPath: "/tmp/security/security-analyst.prompt.md",
            promptText: "Performs security audits and vulnerability scans.",
            model: "balanced",
            tools: ["read", "scan", "question"],
            maxInstances: 1,
          },
        ],
      })],
      ["new_division", makeDivision({
        id: "new_division",
        roles: [],
      })],
    ]),
    workflows: new Map(),
  };
}

test("hr role governance: performs gap analysis for missing capability", () => {
  const hrService = new HrRoleGovernanceService(createDivisionRegistry());
  const taskId = "task-gap-test";

  const request: HrGapAnalysisRequest = {
    taskId,
    taskDescription: "Requires deployment capability",
    targetDivisionId: "engineering",
    triggerReason: "no_role_match",
    requestedCapabilities: ["deploy", "release"],
  };

  const result = hrService.analyzeGap(request);

  assert.equal(result.taskId, taskId);
  assert.equal(result.targetDivisionId, "engineering");
  assert.deepEqual(result.matchedRoleIds, ["deploy_engineer"]);
  assert.deepEqual(result.missingCapabilities, []);
});

test("hr role governance: gap analysis identifies missing capabilities", () => {
  const hrService = new HrRoleGovernanceService(createDivisionRegistry());

  const request: HrGapAnalysisRequest = {
    taskId: "task-gap-missing",
    taskDescription: "Requires specialized security capability",
    targetDivisionId: "security_ops",
    triggerReason: "scope_exceeded",
    requestedCapabilities: ["security_audit", "pen_test", "vulnerability_scan"],
  };

  const result = hrService.analyzeGap(request);

  assert.ok(result.missingCapabilities.includes("pen_test"));
});

test("hr role governance: suggests tools based on gap analysis", () => {
  const hrService = new HrRoleGovernanceService(createDivisionRegistry());

  const request: HrGapAnalysisRequest = {
    taskId: "task-gap-tools",
    taskDescription: "Code review task",
    targetDivisionId: "engineering",
    triggerReason: "no_role_match",
    requestedCapabilities: ["code_review", "static_analysis"],
  };

  const result = hrService.analyzeGap(request);

  assert.ok(Array.isArray(result.suggestedToolNames));
  assert.ok(result.divisionToolUnion.includes("read"));
});

test("hr role governance: recommends model based on task type", () => {
  const hrService = new HrRoleGovernanceService(createDivisionRegistry());

  const codingRequest: HrGapAnalysisRequest = {
    taskId: "task-coding",
    taskDescription: "Implement feature",
    targetDivisionId: "engineering",
    triggerReason: "no_role_match",
    requestedCapabilities: ["implement", "patch"],
  };

  const codingResult = hrService.analyzeGap(codingRequest);
  assert.ok(codingResult.recommendedModel === "coding" || codingResult.recommendedModel === "balanced");
});

test("hr role governance: handles division without existing roles", () => {
  const hrService = new HrRoleGovernanceService(createDivisionRegistry());

  const request: HrGapAnalysisRequest = {
    taskId: "task-new-division",
    taskDescription: "New division task",
    targetDivisionId: "new_division",
    triggerReason: "no_role_match",
    requestedCapabilities: ["execute"],
  };

  const result = hrService.analyzeGap(request);

  assert.equal(result.targetDivisionId, "new_division");
  assert.deepEqual(result.matchedRoleIds, []);
  assert.deepEqual(result.divisionToolUnion, []);
});

test("hr role governance: validates role proposal before submission", () => {
  const hrService = new HrRoleGovernanceService(createDivisionRegistry());

  const validProposal = hrService.validateProposal({
    roleId: "role_proposal_1",
    name: "Deployment Engineer",
    divisionId: "engineering",
    promptText: "Deploys code to production",
    model: "coding",
    tools: ["read", "apply_patch"],
    scope: {
      responsibilities: ["deploy code", "release packages"],
      boundaries: ["no production database writes"],
    },
    inputSchema: { required: ["deploymentId"] },
    outputSchema: { required: ["status"] },
    preconditions: [{ check: "has_deploy_cert", description: "Requires deployment certification" }],
  });

  assert.strictEqual(validProposal.valid, true);
});

test("hr role governance: rejects invalid role proposal", () => {
  const hrService = new HrRoleGovernanceService(createDivisionRegistry());

  const invalidProposal = hrService.validateProposal({
    roleId: "",
    name: "",
    divisionId: "engineering",
    promptText: "",
    model: "fast",
    tools: [],
    scope: {
      responsibilities: [],
      boundaries: [],
    },
    inputSchema: { required: [] },
    outputSchema: { required: [] },
    preconditions: [],
  });

  assert.strictEqual(invalidProposal.valid, false);
  assert.ok(invalidProposal.errors.length > 0);
});
