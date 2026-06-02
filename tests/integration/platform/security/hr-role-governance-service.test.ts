import assert from "node:assert/strict";
import test from "node:test";

import type { DivisionRegistry } from "../../../../src/domains/governance/division-loader.js";
import { HrRoleGovernanceService, type HrRoleProposal } from "../../../../src/org-governance/org-model/hr-role-governance-service.js";

function createRegistry(): DivisionRegistry {
  return {
    divisions: new Map([
      ["engineering-ops", {
        id: "engineering-ops",
        version: "1",
        name: "Engineering Ops",
        description: "Engineering workflows",
        priority: 50,
        triggers: ["code"],
        defaultWorkflowId: "engineering_default",
        orchestrationWorkflowId: null,
        roles: [
          {
            id: "engineer",
            name: "Engineer",
            promptPath: "/tmp/engineering-ops/roles/engineer.prompt.md",
            promptText: "Implement code changes and verify with bash when needed.",
            model: "coding",
            tools: ["read", "edit", "bash"],
            maxInstances: 4,
          },
          {
            id: "reviewer",
            name: "Reviewer",
            promptPath: "/tmp/engineering-ops/roles/reviewer.prompt.md",
            promptText: "Review code changes and inspect results.",
            model: "reasoning",
            tools: ["read"],
            maxInstances: 2,
          },
        ],
        workflows: [],
        rootPath: "/tmp/engineering-ops",
      }],
    ]),
    workflows: new Map(),
  };
}

function createProposal(): HrRoleProposal {
  return {
    divisionId: "engineering-ops",
    roleId: "release_operator",
    name: "Release Operator",
    promptText: "Prepare release candidate notes for approved engineering changes.",
    model: "balanced",
    tools: ["read"],
    maxInstances: 1,
    scope: {
      responsibilities: ["summarize approved release changes"],
      boundaries: ["Only read approved execution artifacts."],
    },
    inputSchema: {
      required: ["change_summary"],
      optional: [],
    },
    outputSchema: {
      required: ["release_note"],
      optional: [],
    },
    preconditions: [
      {
        check: "change_summary_present",
        description: "Approved change summary must exist.",
      },
    ],
    workflowSuggestion: null,
  };
}

test("HrRoleGovernanceService fail-closes proposals that attempt privilege escalation or auto-apply workflow changes", () => {
  const service = new HrRoleGovernanceService(createRegistry());

  const result = service.validateProposal({
    ...createProposal(),
    roleId: "unsafe_release_operator",
    tools: ["read", "todo_write"],
    workflowSuggestion: {
      insertAfterStepId: "build",
      step: {
        stepId: "publish_release",
        roleId: "unsafe_release_operator",
        outputKey: "release_note",
        timeoutMs: 10_000,
        maxAttempts: 1,
        autoApply: true,
      },
    },
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.includes("hr.tool_outside_division_subset:engineering-ops:unsafe_release_operator:todo_write"),
  );
  assert.ok(
    result.errors.includes("hr.workflow_auto_apply_denied:engineering-ops:unsafe_release_operator"),
  );
});

test("HrRoleGovernanceService refuses registry registration before explicit approval", () => {
  const service = new HrRoleGovernanceService(createRegistry());

  assert.throws(
    () => service.registerApprovedRole({
      proposal: createProposal(),
      // @ts-expect-error runtime guard coverage
      approvalStatus: "pending",
    }),
    /hr\.role_registration_requires_approval/,
  );
});
