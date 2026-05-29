import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  SkillCreatorService,
  slugifySkillName,
} from "../../../../../src/platform/five-plane-execution/tool-executor/skill-creator-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("slugifySkillName normalizes human-readable names into lowercase kebab-case [skill-creator-service]", () => {
  assert.equal(slugifySkillName("My Helpful Skill"), "my-helpful-skill");
  assert.equal(slugifySkillName("Skill__Creator 2"), "skill-creator-2");
});

test("skill creator creates scaffold with required sections and optional resource directories [skill-creator-service]", () => {
  const workspace = createTempWorkspace("aa-skill-creator-unit-");
  try {
    const service = new SkillCreatorService();
    const result = service.createSkill({
      skillRoot: workspace,
      name: "Repo Triage Assistant",
      description: "Helps triage repository work with a small repeatable workflow.",
      requiredTools: ["read", "bash"],
      applicableRoles: ["developer"],
      resourceDirectories: ["scripts", "references"],
      includeOpenAiAgent: true,
    });

    assert.equal(result.skillSlug, "repo-triage-assistant");
    assert.equal(result.registered, false);
    assert.ok(existsSync(join(result.skillPath, "SKILL.md")));
    assert.ok(existsSync(join(result.skillPath, "scripts")));
    assert.ok(existsSync(join(result.skillPath, "references")));
    assert.ok(existsSync(join(result.skillPath, "agents", "openai.yaml")));

    const content = readFileSync(join(result.skillPath, "SKILL.md"), "utf8");
    assert.match(content, /^## Description$/m);
    assert.match(content, /^## When To Use$/m);
    assert.match(content, /^## Inputs$/m);
    assert.match(content, /^## Workflow$/m);
    assert.match(content, /^## Safety Notes$/m);
  } finally {
    cleanupPath(workspace);
  }
});

test("skill creator validate reports missing sections [skill-creator-service]", () => {
  const workspace = createTempWorkspace("aa-skill-creator-validate-");
  try {
    const service = new SkillCreatorService();
    const createResult = service.createSkill({
      skillRoot: workspace,
      name: "Broken Skill",
      description: "This creates a scaffold that will then be intentionally broken.",
    });
    const brokenPath = createResult.skillPath;
    const brokenMarkdown = "# Broken Skill\n\n## Description\n\nOnly one section.\n";
    writeFileSync(join(brokenPath, "SKILL.md"), brokenMarkdown, "utf8");

    const validation = service.validateSkillScaffold({
      skillPath: brokenPath,
    });
    assert.equal(validation.valid, false);
    assert.ok(validation.missingSections.includes("When To Use"));
    assert.ok(validation.missingSections.includes("Workflow"));
  } finally {
    cleanupPath(workspace);
  }
});

test("skill creator slugifies hostile names and writes inert scaffold content [skill-creator-service]", () => {
  const workspace = createTempWorkspace("aa-skill-creator-sanitize-");
  try {
    const service = new SkillCreatorService();
    const result = service.createSkill({
      skillRoot: workspace,
      name: "`${process.exit(1)}` ${danger}",
      description: "Skill description with `${still-plain-text}` content.",
      includeOpenAiAgent: true,
    });

    assert.equal(result.skillSlug, "process-exit-1-danger");
    const skillMarkdown = readFileSync(join(result.skillPath, "SKILL.md"), "utf8");
    const openAiYaml = readFileSync(join(result.skillPath, "agents", "openai.yaml"), "utf8");

    assert.match(skillMarkdown, /# `\$\{process\.exit\(1\)\}` \$\{danger\}/);
    assert.match(openAiYaml, /name: process-exit-1-danger/);
    assert.match(openAiYaml, /description: "Skill description with `\$\{still-plain-text\}` content\."/);
  } finally {
    cleanupPath(workspace);
  }
});
