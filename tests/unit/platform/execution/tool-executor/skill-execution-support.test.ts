import assert from "node:assert/strict";
import test from "node:test";

import type {
  SkillStepDefinition,
  SkillStepModelOverride,
  SkillDefinition,
} from "../../../../../src/platform/five-plane-execution/tool-executor/skill-execution-support.js";

test("SkillStepDefinition type accepts valid onFailure values [skill-execution-support]", () => {
  const step1: SkillStepDefinition = { stepId: "1", toolName: "read", onFailure: "fail" };
  const step2: SkillStepDefinition = { stepId: "2", toolName: "write", onFailure: "continue" };
  const step3: SkillStepDefinition = { stepId: "3", toolName: "edit", onFailure: "retry" };

  assert.equal(step1.onFailure, "fail");
  assert.equal(step2.onFailure, "continue");
  assert.equal(step3.onFailure, "retry");
});

test("SkillStepDefinition allows optional fields [skill-execution-support]", () => {
  const minimal: SkillStepDefinition = { stepId: "1", toolName: "read" };
  assert.equal(minimal.stepId, "1");

  const withAll: SkillStepDefinition = {
    stepId: "1",
    toolName: "read",
    description: "Read a file",
    onFailure: "continue",
    maxAttempts: 3,
    input: { path: "/tmp" },
    modelOverrides: [],
  };

  assert.equal(withAll.description, "Read a file");
  assert.equal(withAll.maxAttempts, 3);
});

test("SkillStepModelOverride type structure [skill-execution-support]", () => {
  const override: SkillStepModelOverride = {
    toolName: "edit",
    profileNames: ["claude-3-5-sonnet"],
    tiers: ["balanced"],
    requiredCapabilities: ["code"],
  };

  assert.equal(override.toolName, "edit");
  assert.ok(override.profileNames!.includes("claude-3-5-sonnet"));
  assert.ok(override.tiers!.includes("balanced"));
  assert.ok(override.requiredCapabilities!.includes("code"));
});

test("SkillStepModelOverride allows minimal definition [skill-execution-support]", () => {
  const override: SkillStepModelOverride = { toolName: "edit" };
  assert.equal(override.toolName, "edit");
});

test("SkillDefinition type structure [skill-execution-support]", () => {
  const skill: SkillDefinition = {
    skillId: "file-editor",
    version: "1.0.0",
    description: "Edits files",
    requiredTools: ["edit", "read"],
    steps: [
      { stepId: "1", toolName: "read" },
      { stepId: "2", toolName: "edit" },
    ],
  };

  assert.equal(skill.skillId, "file-editor");
  assert.equal(skill.version, "1.0.0");
  assert.equal(skill.steps.length, 2);
  assert.ok(skill.requiredTools.includes("edit"));
});
