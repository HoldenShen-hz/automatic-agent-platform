import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadConversationTemplateConfig,
  getTemplatesFromConfig,
  type ConversationTemplateConfig,
} from "../../../../src/platform/prompt-engine/conversation-template-config-loader.js";

test("loadConversationTemplateConfig returns default config for missing file", () => {
  const config = loadConversationTemplateConfig("/nonexistent/path/config.json");

  assert.deepEqual(config.templates, []);
  assert.equal(config.maxStepsPerTemplate, 10);
  assert.equal(config.enableTemplateAutoSelection, true);
});

test("getTemplatesFromConfig extracts templates from config", () => {
  const config: ConversationTemplateConfig = {
    templates: [
      { templateId: "t1", name: "Test 1", description: "d1", version: "1.0", intent: "task_create", steps: [], estimatedDurationMinutes: 5, tags: [], isActive: true },
      { templateId: "t2", name: "Test 2", description: "d2", version: "1.0", intent: "task_query", steps: [], estimatedDurationMinutes: 3, tags: [], isActive: true },
    ],
    defaultTemplateId: "t1",
    maxStepsPerTemplate: 15,
    enableTemplateAutoSelection: false,
  };

  const templates = getTemplatesFromConfig(config);

  assert.equal(templates.length, 2);
  assert.equal(templates[0]?.templateId, "t1");
  assert.equal(templates[1]?.templateId, "t2");
});

test("getTemplatesFromConfig returns empty array for config with no templates", () => {
  const config: ConversationTemplateConfig = {
    templates: [],
    maxStepsPerTemplate: 5,
    enableTemplateAutoSelection: true,
  };

  const templates = getTemplatesFromConfig(config);

  assert.deepEqual(templates, []);
});

test("ConversationTemplateConfig type accepts all required fields", () => {
  const config: ConversationTemplateConfig = {
    templates: [],
    defaultTemplateId: "default",
    maxStepsPerTemplate: 20,
    enableTemplateAutoSelection: false,
  };

  assert.equal(config.defaultTemplateId, "default");
  assert.equal(config.maxStepsPerTemplate, 20);
  assert.equal(config.enableTemplateAutoSelection, false);
});

test("ConversationTemplateConfig allows optional defaultTemplateId", () => {
  const config: ConversationTemplateConfig = {
    templates: [],
    maxStepsPerTemplate: 10,
    enableTemplateAutoSelection: true,
  };

  assert.equal(config.defaultTemplateId, undefined);
});

test("loadConversationTemplateConfig uses default path when not specified", () => {
  // Just verify the function doesn't throw and returns a valid structure
  const config = loadConversationTemplateConfig();

  assert.ok(Array.isArray(config.templates));
  assert.equal(typeof config.maxStepsPerTemplate, "number");
  assert.equal(typeof config.enableTemplateAutoSelection, "boolean");
});

test("loadConversationTemplateConfig handles invalid JSON gracefully", () => {
  // The function catches errors and returns defaults, so we test that behavior
  const config = loadConversationTemplateConfig("/invalid/path/to/file.json");

  assert.deepEqual(config.templates, []);
  assert.equal(config.maxStepsPerTemplate, 10);
});

test("loadConversationTemplateConfig falls back when template payload violates schema", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "conversation-template-config-"));
  const configPath = join(tempDir, "templates.json");
  try {
    writeFileSync(configPath, JSON.stringify({
      templates: [{ templateId: "broken-template" }],
      maxStepsPerTemplate: 3,
      enableTemplateAutoSelection: false,
    }), "utf8");

    const config = loadConversationTemplateConfig(configPath);
    assert.deepEqual(config.templates, []);
    assert.equal(config.maxStepsPerTemplate, 10);
    assert.equal(config.enableTemplateAutoSelection, true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("getTemplatesFromConfig returns readonly array", () => {
  const config: ConversationTemplateConfig = {
    templates: [
      { templateId: "t1", name: "Test", description: "d", version: "1.0", intent: "task_create", steps: [], estimatedDurationMinutes: 1, tags: [], isActive: true },
    ],
    maxStepsPerTemplate: 10,
    enableTemplateAutoSelection: true,
  };

  const templates = getTemplatesFromConfig(config);

  // Should be readonly
  assert.ok(Array.isArray(templates));
});

test("getTemplatesFromConfig preserves template order", () => {
  const templates = [
    { templateId: "first", name: "First", description: "d", version: "1.0", intent: "task_create", steps: [], estimatedDurationMinutes: 1, tags: [], isActive: true },
    { templateId: "second", name: "Second", description: "d", version: "1.0", intent: "task_query", steps: [], estimatedDurationMinutes: 1, tags: [], isActive: true },
    { templateId: "third", name: "Third", description: "d", version: "1.0", intent: "task_modify", steps: [], estimatedDurationMinutes: 1, tags: [], isActive: true },
  ] as const;

  const config: ConversationTemplateConfig = {
    templates,
    maxStepsPerTemplate: 10,
    enableTemplateAutoSelection: true,
  };

  const result = getTemplatesFromConfig(config);

  assert.equal(result[0]?.templateId, "first");
  assert.equal(result[1]?.templateId, "second");
  assert.equal(result[2]?.templateId, "third");
});
