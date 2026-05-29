import assert from "node:assert/strict";
import test from "node:test";

import { PromptTemplateRegistryService, hashPromptPrefix } from "../../../../src/platform/prompt-engine/registry/index.js";

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

test("prompt registry registers a template and retrieves it by key and version", () => {
  const registry = new PromptTemplateRegistryService();

  const registered = registry.registerTemplate({
    templateKey: "test_reg_basic",
    version: "v1",
    owner: "owner@example.com",
    fixedPrefix: "You are a helpful assistant.",
    domainBlock: "Domain: general",
    variableSuffixTemplate: "Question: {{question}}",
    variableSpecs: [{ key: "question", required: true }],
    compatibilityTags: ["tag1", "tag2"],
  });

  assert.equal(registered.templateKey, "test_reg_basic");
  assert.equal(registered.version, "v1");
  assert.equal(registered.owner, "owner@example.com");
  assert.equal(registered.channel, "system");
  assert.equal(registered.fixedPrefix, "You are a helpful assistant.");
  assert.equal(registered.domainBlock, "Domain: general");
  assert.equal(registered.variableSuffixTemplate, "Question: {{question}}");
  assert.equal(registered.variableSpecs.length, 1);
  assert.equal(registered.variableSpecs[0]!.key, "question");
  assert.equal(registered.compatibilityTags.length, 2);
  assert.ok(registered.fixedPrefixHash.length > 0);
  assert.ok(registered.createdAt.length > 0);
  assert.ok(registered.updatedAt.length > 0);

  const retrieved = registry.getTemplate("test_reg_basic", "v1");
  assert.notEqual(retrieved, null);
  assert.equal(retrieved!.templateKey, "test_reg_basic");
  assert.equal(retrieved!.version, "v1");
});

test("prompt registry throws on duplicate version for same template key", () => {
  const registry = new PromptTemplateRegistryService();

  registry.registerTemplate({
    templateKey: "test_reg_duplicate",
    version: "v1",
    owner: "owner@example.com",
    fixedPrefix: "Prefix",
    domainBlock: "Domain",
  });

  assert.throws(
    () =>
      registry.registerTemplate({
        templateKey: "test_reg_duplicate",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Different prefix",
        domainBlock: "Different domain",
      }),
    (err) => errorCode(err) === "prompt_template.version_conflict:test_reg_duplicate:v1",
  );
});

test("prompt registry lists all versions for a template key", () => {
  const registry = new PromptTemplateRegistryService();

  registry.registerTemplate({
    templateKey: "test_reg_versions",
    version: "v1",
    owner: "owner@example.com",
    fixedPrefix: "Prefix v1",
    domainBlock: "Domain v1",
  });

  registry.registerTemplate({
    templateKey: "test_reg_versions",
    version: "v2",
    owner: "owner@example.com",
    fixedPrefix: "Prefix v2",
    domainBlock: "Domain v2",
  });

  const versions = registry.listVersions("test_reg_versions");
  assert.equal(versions.length, 2);
  const sorted = [...versions].sort((a, b) => a.version.localeCompare(b.version));
  assert.equal(sorted[0]!.version, "v1");
  assert.equal(sorted[1]!.version, "v2");
});

test("prompt registry lists all templates", () => {
  const registry = new PromptTemplateRegistryService();

  registry.registerTemplate({
    templateKey: "test_reg_list_a",
    version: "v1",
    owner: "owner@example.com",
    fixedPrefix: "Prefix A",
    domainBlock: "Domain A",
  });

  registry.registerTemplate({
    templateKey: "test_reg_list_b",
    version: "v1",
    owner: "owner@example.com",
    fixedPrefix: "Prefix B",
    domainBlock: "Domain B",
  });

  const allTemplates = registry.listTemplates();
  const keys = allTemplates.map((t) => t.templateKey);
  assert.ok(keys.includes("test_reg_list_a"));
  assert.ok(keys.includes("test_reg_list_b"));
});

test("prompt registry normalizes and dedupes variable specs", () => {
  const registry = new PromptTemplateRegistryService();

  const template = registry.registerTemplate({
    templateKey: "test_reg_dedupe_vars",
    version: "v1",
    owner: "owner@example.com",
    fixedPrefix: "Prefix",
    domainBlock: "Domain",
    variableSpecs: [
      { key: "var1", required: true, description: "  desc1  ", defaultValue: "  default1  " },
      { key: "var1", required: true },
      { key: "var2", required: false },
    ],
  });

  assert.equal(template.variableSpecs.length, 2);
  const keys = template.variableSpecs.map((s) => s.key);
  assert.ok(keys.includes("var1"));
  assert.ok(keys.includes("var2"));
});

test("prompt registry normalizes and dedupes compatibility tags", () => {
  const registry = new PromptTemplateRegistryService();

  const template = registry.registerTemplate({
    templateKey: "test_reg_dedupe_tags",
    version: "v1",
    owner: "owner@example.com",
    fixedPrefix: "Prefix",
    domainBlock: "Domain",
    compatibilityTags: ["  tag1  ", "tag1", "  tag2", "tag3"],
  });

  assert.equal(template.compatibilityTags.length, 3);
});

test("prompt registry defaults channel to system when not provided", () => {
  const registry = new PromptTemplateRegistryService();

  const template = registry.registerTemplate({
    templateKey: "test_reg_default_channel",
    version: "v1",
    owner: "owner@example.com",
    fixedPrefix: "Prefix",
    domainBlock: "Domain",
  });

  assert.equal(template.channel, "system");
});

test("prompt registry accepts explicit developer channel", () => {
  const registry = new PromptTemplateRegistryService();

  const template = registry.registerTemplate({
    templateKey: "test_reg_dev_channel",
    version: "v1",
    owner: "owner@example.com",
    channel: "developer",
    fixedPrefix: "Prefix",
    domainBlock: "Domain",
  });

  assert.equal(template.channel, "developer");
});

test("prompt registry throws on empty required fields", () => {
  const registry = new PromptTemplateRegistryService();

  assert.throws(
    () =>
      registry.registerTemplate({
        templateKey: "   ",
        version: "v1",
        owner: "owner@example.com",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
      }),
    (err) => errorCode(err) === "prompt_template.invalid_templateKey",
  );

  assert.throws(
    () =>
      registry.registerTemplate({
        templateKey: "valid_key",
        version: "   ",
        owner: "owner@example.com",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
      }),
    (err) => errorCode(err) === "prompt_template.invalid_version",
  );

  assert.throws(
    () =>
      registry.registerTemplate({
        templateKey: "valid_key",
        version: "v1",
        owner: "   ",
        fixedPrefix: "Prefix",
        domainBlock: "Domain",
      }),
    (err) => errorCode(err) === "prompt_template.invalid_owner",
  );
});

test("prompt registry returns null for non-existent template", () => {
  const registry = new PromptTemplateRegistryService();

  const result = registry.getTemplate("non_existent_key", "v1");
  assert.equal(result, null);
});

test("prompt registry returns empty list for non-existent template key versions", () => {
  const registry = new PromptTemplateRegistryService();

  const versions = registry.listVersions("non_existent_key");
  assert.equal(versions.length, 0);
});

test("hashPromptPrefix produces consistent short hash", () => {
  const hash1 = hashPromptPrefix("You are a helpful assistant.");
  const hash2 = hashPromptPrefix("You are a helpful assistant.");
  const hash3 = hashPromptPrefix("Different prompt.");

  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
  assert.equal(hash1.length, 32);
});
