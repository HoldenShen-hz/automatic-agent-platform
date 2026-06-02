import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

import {
  ConversationTemplateExecutor,
  ConversationTemplateRegistry,
  ConversationTemplateSchema,
  type ConversationTemplate,
} from "../../../../src/platform/prompt-engine/conversation-template-service.js";
import {
  loadConversationTemplateConfig,
  getTemplatesFromConfig,
  type ConversationTemplateConfig,
} from "../../../../src/platform/prompt-engine/conversation-template-config-loader.js";

function createTemplate(
  input: Pick<ConversationTemplate, "templateId" | "name" | "description" | "intent" | "steps">
    & Partial<Omit<ConversationTemplate, "templateId" | "name" | "description" | "intent" | "steps">>,
): ConversationTemplate {
  return ConversationTemplateSchema.parse({
    version: "1.0",
    estimatedDurationMinutes: 5,
    tags: [],
    isActive: true,
    ...input,
  });
}

test("integration: loadConversationTemplateConfig loads valid config file", () => {
  const configPath = resolve(
    process.cwd(),
    "tests/fixtures/conversation/test_templates.json",
  );

  const dir = resolve(process.cwd(), "tests/fixtures/conversation");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const testConfig = {
    templates: [
      {
        templateId: "integration_test_template",
        name: "Integration Test Template",
        description: "Template for integration testing",
        intent: "task_create",
        steps: [
          {
            stepId: "test_step",
            prompt: "Enter test value:",
            isRequired: true,
          },
        ],
      },
    ],
    defaultTemplateId: "integration_test_template",
    maxStepsPerTemplate: 10,
    enableTemplateAutoSelection: true,
  };

  writeFileSync(configPath, JSON.stringify(testConfig, null, 2), "utf-8");

  try {
    const config = loadConversationTemplateConfig(configPath);

    assert.equal(config.defaultTemplateId, "integration_test_template");
    assert.equal(config.maxStepsPerTemplate, 10);
    assert.equal(config.enableTemplateAutoSelection, true);
    assert.equal(config.templates.length, 1);
    assert.equal(config.templates[0]!.templateId, "integration_test_template");
  } finally {
    unlinkSync(configPath);
  }
});

test("integration: loadConversationTemplateConfig returns defaults for missing file", () => {
  const config = loadConversationTemplateConfig(
    "/nonexistent/path/config.json",
  );

  assert.deepEqual(config.templates, []);
  assert.equal(config.maxStepsPerTemplate, 10);
  assert.equal(config.enableTemplateAutoSelection, true);
});

test("integration: loadConversationTemplateConfig validates schema on load", () => {
  const configPath = resolve(
    process.cwd(),
    "tests/fixtures/conversation/invalid_config.json",
  );

  const dir = resolve(process.cwd(), "tests/fixtures/conversation");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const invalidConfig = {
    templates: "not_an_array",
    maxStepsPerTemplate: "not_a_number",
  };

  writeFileSync(configPath, JSON.stringify(invalidConfig, null, 2), "utf-8");

  try {
    assert.throws(
      () => loadConversationTemplateConfig(configPath),
      (error: unknown) => error instanceof ValidationError && error.code === "conversation_template_config.invalid",
    );
  } finally {
    unlinkSync(configPath);
  }
});

test("integration: getTemplatesFromConfig extracts templates from config", () => {
  const config: ConversationTemplateConfig = {
    templates: [
      createTemplate({
        templateId: "extract_test",
        name: "Extract Test",
        description: "Testing extraction",
        intent: "task_query",
        steps: [],
      }),
      createTemplate({
        templateId: "extract_test_2",
        name: "Extract Test 2",
        description: "Testing extraction 2",
        intent: "task_create",
        steps: [],
      }),
    ],
    maxStepsPerTemplate: 5,
    enableTemplateAutoSelection: false,
  };

  const templates = getTemplatesFromConfig(config);

  assert.equal(templates.length, 2);
  assert.equal(templates[0]!.templateId, "extract_test");
  assert.equal(templates[1]!.templateId, "extract_test_2");
});

test("integration: loadConversationTemplateConfig uses default path", () => {
  const config = loadConversationTemplateConfig();

  if (config.templates.length > 0) {
    assert.equal(Array.isArray(config.templates), true);
    assert.equal(typeof config.maxStepsPerTemplate, "number");
    assert.equal(typeof config.enableTemplateAutoSelection, "boolean");
  } else {
    assert.deepEqual(config.templates, []);
    assert.equal(config.maxStepsPerTemplate, 10);
    assert.equal(config.enableTemplateAutoSelection, true);
  }
});

test("integration: config-loaded templates can be registered and executed", () => {
  const configPath = resolve(
    process.cwd(),
    "tests/fixtures/conversation/exec_templates.json",
  );

  const dir = resolve(process.cwd(), "tests/fixtures/conversation");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const testConfig = {
    templates: [
      {
        templateId: "config_driven_template",
        name: "Config Driven Template",
        description: "Loaded from config file",
        intent: "task_create",
        steps: [
          {
            stepId: "title",
            prompt: "Enter title:",
            isRequired: true,
          },
          {
            stepId: "description",
            prompt: "Enter description:",
            isRequired: false,
            allowSkip: true,
          },
        ],
        estimatedDurationMinutes: 3,
        tags: ["config", "test"],
      },
    ],
    defaultTemplateId: "config_driven_template",
    maxStepsPerTemplate: 5,
    enableTemplateAutoSelection: true,
  };

  writeFileSync(configPath, JSON.stringify(testConfig, null, 2), "utf-8");

  try {
    const config = loadConversationTemplateConfig(configPath);
    const templates = getTemplatesFromConfig(config);

    const registry = new ConversationTemplateRegistry(templates);
    const executor = new ConversationTemplateExecutor(registry);

    const conversation = executor.start("config_driven_template");

    assert.ok(conversation !== null);
    assert.equal(conversation?.templateId, "config_driven_template");
    assert.equal(conversation?.currentStepIndex, 0);
    assert.equal(conversation?.steps.length, 2);

    const nextConversation = executor.next(conversation!, "My Task Title");
    assert.equal(nextConversation?.currentStepIndex, 1);
    assert.equal(nextConversation?.context.title, "My Task Title");

    const skipResult = executor.skip(nextConversation!);
    assert.ok(skipResult !== null);
    assert.equal(skipResult?.currentStepIndex, 2);
    assert.equal(skipResult?.isComplete, true);
  } finally {
    unlinkSync(configPath);
  }
});

test("integration: loaded templates preserve all schema fields", () => {
  const configPath = resolve(
    process.cwd(),
    "tests/fixtures/conversation/full_schema_templates.json",
  );

  const dir = resolve(process.cwd(), "tests/fixtures/conversation");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const testConfig = {
    templates: [
      {
        templateId: "full_schema_test",
        name: "Full Schema Test",
        description: "Testing all schema fields",
        version: "2.0",
        intent: "approval_action",
        steps: [
          {
            stepId: "approval_type",
            prompt: "Select approval type:",
            responseTemplate: "Selected: {response}",
            expectedEntities: ["approvalType"],
            isRequired: true,
            allowSkip: false,
          },
        ],
        estimatedDurationMinutes: 10,
        tags: ["approval", "workflow", "urgent"],
        isActive: true,
      },
    ],
    maxStepsPerTemplate: 20,
    enableTemplateAutoSelection: false,
  };

  writeFileSync(configPath, JSON.stringify(testConfig, null, 2), "utf-8");

  try {
    const config = loadConversationTemplateConfig(configPath);
    const templates = getTemplatesFromConfig(config);

    assert.equal(templates.length, 1);
    const template = templates[0]!;

    assert.equal(template.templateId, "full_schema_test");
    assert.equal(template.name, "Full Schema Test");
    assert.equal(template.version, "2.0");
    assert.equal(template.intent, "approval_action");
    assert.equal(template.estimatedDurationMinutes, 10);
    assert.deepEqual(template.tags, ["approval", "workflow", "urgent"]);
    assert.equal(template.isActive, true);
    assert.equal(template.steps.length, 1);

    const step = template.steps[0]!;
    assert.equal(step.stepId, "approval_type");
    assert.equal(step.prompt, "Select approval type:");
    assert.equal(step.responseTemplate, "Selected: {response}");
    assert.deepEqual(step.expectedEntities, ["approvalType"]);
    assert.equal(step.isRequired, true);
    assert.equal(step.allowSkip, false);
  } finally {
    unlinkSync(configPath);
  }
});

test("integration: config with all intent types loads correctly", () => {
  const configPath = resolve(
    process.cwd(),
    "tests/fixtures/conversation/all_intents_templates.json",
  );

  const dir = resolve(process.cwd(), "tests/fixtures/conversation");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const allIntents: ConversationTemplate["intent"][] = [
    "task_create",
    "task_query",
    "task_modify",
    "status_inquiry",
    "approval_action",
    "system_config",
  ];

  const testConfig = {
    templates: allIntents.map((intent, index) => ({
      templateId: `intent_${intent}`,
      name: `Template for ${intent}`,
      description: `Testing ${intent} intent`,
      intent,
      steps: [
        {
          stepId: "step1",
          prompt: `Prompt for ${intent}:`,
          isRequired: true,
        },
      ],
    })),
    maxStepsPerTemplate: 10,
    enableTemplateAutoSelection: true,
  };

  writeFileSync(configPath, JSON.stringify(testConfig, null, 2), "utf-8");

  try {
    const config = loadConversationTemplateConfig(configPath);

    assert.equal(config.templates.length, 6);

    const registry = new ConversationTemplateRegistry(config.templates);

    for (const intent of allIntents) {
      const templates = registry.listByIntent(intent);
      assert.equal(templates.length, 1, `Expected 1 template for ${intent}`);
      assert.equal(
        templates[0]!.intent,
        intent,
        `Expected intent ${intent}`,
      );
    }
  } finally {
    unlinkSync(configPath);
  }
});

test("integration: loadConversationTemplateConfig handles empty config file", () => {
  const configPath = resolve(
    process.cwd(),
    "tests/fixtures/conversation/empty_templates.json",
  );

  const dir = resolve(process.cwd(), "tests/fixtures/conversation");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(configPath, "{}", "utf-8");

  try {
    const config = loadConversationTemplateConfig(configPath);

    assert.deepEqual(config.templates, []);
    assert.equal(config.maxStepsPerTemplate, 10);
    assert.equal(config.enableTemplateAutoSelection, true);
  } finally {
    unlinkSync(configPath);
  }
});

test("integration: templates loaded from real config file work with executor", () => {
  const config = loadConversationTemplateConfig();

  if (config.templates.length === 0) {
    assert.ok(true, "No templates in default config, skipping execution test");
    return;
  }

  const registry = new ConversationTemplateRegistry(config.templates);
  const executor = new ConversationTemplateExecutor(registry);

  const firstTemplate = config.templates[0]!;
  const conversation = executor.start(firstTemplate.templateId);

  if (conversation) {
    assert.equal(conversation.templateId, firstTemplate.templateId);
    assert.equal(conversation.currentStepIndex, 0);
    assert.equal(conversation.isComplete, false);

    const advanced = executor.next(conversation, "test response");
    assert.ok(advanced.currentStepIndex > conversation.currentStepIndex);
  }
});
