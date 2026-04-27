import assert from "node:assert/strict";
import test from "node:test";

import {
  ConversationTemplateRegistry,
  ConversationTemplateExecutor,
  ConversationTemplateSchema,
  ConversationTemplateStepSchema,
  type ConversationTemplate,
  type ConversationTemplateStep,
  type ConversationTemplateIntent,
} from "../../../../src/platform/prompt-engine/conversation-template-service.js";

test("ConversationTemplateRegistry allows custom initial templates", () => {
  const customTemplates: ConversationTemplate[] = [
    {
      templateId: "custom_001",
      name: "Custom Template",
      description: "A custom template for testing",
      version: "1.0",
      intent: "task_create",
      steps: [
        {
          stepId: "step1",
          prompt: "Enter your name:",
          isRequired: true,
          expectedEntities: ["name"],
          allowSkip: false,
        },
      ],
      estimatedDurationMinutes: 2,
      tags: ["custom", "test"],
      isActive: true,
    },
  ];

  const registry = new ConversationTemplateRegistry(customTemplates);

  const retrieved = registry.get("custom_001");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.name, "Custom Template");
});

test("ConversationTemplateRegistry can register inactive template", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "inactive_template",
    name: "Inactive Template",
    description: "An inactive template",
    intent: "task_query",
    steps: [],
    isActive: false,
  });

  const retrieved = registry.get("inactive_template");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.isActive, false);
});

test("ConversationTemplateRegistry.listActive excludes inactive templates", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "active_template",
    name: "Active Template",
    description: "An active template",
    intent: "task_create",
    steps: [],
    isActive: true,
  });

  registry.register({
    templateId: "inactive_template",
    name: "Inactive Template",
    description: "An inactive template",
    intent: "task_create",
    steps: [],
    isActive: false,
  });

  const activeTemplates = registry.listActive();

  assert.ok(activeTemplates.some(t => t.templateId === "active_template"));
  assert.ok(!activeTemplates.some(t => t.templateId === "inactive_template"));
});

test("ConversationTemplateRegistry.search finds by description", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "search_test",
    name: "Search Test",
    description: "This template is specifically for testing search functionality",
    intent: "task_create",
    steps: [],
  });

  const results = registry.search("testing search");

  assert.ok(results.length > 0);
  assert.ok(results.some(t => t.templateId === "search_test"));
});

test("ConversationTemplateRegistry.search is case insensitive", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "case_test",
    name: "Case Test Template",
    description: "Testing case insensitive search",
    intent: "task_query",
    steps: [],
  });

  const resultsLower = registry.search("case test");
  const resultsUpper = registry.search("CASE TEST");
  const resultsMixed = registry.search("CaSe TeSt");

  assert.ok(resultsLower.length > 0);
  assert.ok(resultsUpper.length > 0);
  assert.ok(resultsMixed.length > 0);
});

test("ConversationTemplateExecutor.getRegistry returns the registry", () => {
  const registry = new ConversationTemplateRegistry();
  const executor = new ConversationTemplateExecutor(registry);

  const returnedRegistry = executor.getRegistry();

  assert.equal(returnedRegistry, registry);
});

test("ConversationTemplateExecutor can use custom registry", () => {
  const customTemplates: ConversationTemplate[] = [
    {
      templateId: "executor_custom",
      name: "Executor Custom",
      description: "Custom template for executor",
      version: "1.0",
      intent: "task_modify",
      steps: [
        {
          stepId: "modify_step1",
          prompt: "What would you like to modify?",
          isRequired: true,
          expectedEntities: [],
          allowSkip: false,
        },
      ],
    },
  ];

  const registry = new ConversationTemplateRegistry(customTemplates);
  const executor = new ConversationTemplateExecutor(registry);

  const conversation = executor.start("executor_custom");

  assert.ok(conversation !== null);
  assert.equal(conversation?.templateId, "executor_custom");
});

test("ConversationTemplateExecutor handles inactive template", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "inactive_exec_test",
    name: "Inactive Exec Test",
    description: "An inactive template",
    intent: "task_create",
    steps: [
      {
        stepId: "step1",
        prompt: "This should not appear",
        isRequired: true,
        expectedEntities: [],
        allowSkip: false,
      },
    ],
    isActive: false,
  });

  const executor = new ConversationTemplateExecutor(registry);
  const conversation = executor.start("inactive_exec_test");

  assert.equal(conversation, null);
});

test("ConversationTemplateExecutor.next updates context correctly", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "context_test",
    name: "Context Test",
    description: "Testing context updates",
    intent: "task_create",
    steps: [
      {
        stepId: "title",
        prompt: "Enter title:",
        isRequired: true,
        expectedEntities: [],
        allowSkip: false,
      },
      {
        stepId: "description",
        prompt: "Enter description:",
        isRequired: false,
        expectedEntities: [],
        allowSkip: true,
      },
    ],
  });

  const executor = new ConversationTemplateExecutor(registry);

  let conversation = executor.start("context_test");
  assert.equal(conversation?.context.title, undefined);

  conversation = executor.next(conversation!, "My Task Title");
  assert.equal(conversation?.context.title, "My Task Title");

  conversation = executor.next(conversation!, "My task description");
  assert.equal(conversation?.context.description, "My task description");
});

test("ConversationTemplateExecutor.next merges context updates", () => {
  const executor = new ConversationTemplateExecutor();

  let conversation = executor.start("task_create_standard");

  conversation = executor.next(conversation!, "Task 1", { userId: "user_123", sessionId: "sess_456" });
  assert.equal(conversation?.context.userId, "user_123");
  assert.equal(conversation?.context.sessionId, "sess_456");

  conversation = executor.next(conversation!, "Task 2", { userId: "user_789" });
  assert.equal(conversation?.context.userId, "user_789");
  assert.equal(conversation?.context.sessionId, "sess_456");
});

test("ConversationTemplateExecutor calculates progress for 1-step template", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "single_step",
    name: "Single Step",
    description: "A single step template",
    intent: "task_create",
    steps: [
      {
        stepId: "only_step",
        prompt: "The only step",
        isRequired: true,
        expectedEntities: [],
        allowSkip: false,
      },
    ],
  });

  const executor = new ConversationTemplateExecutor(registry);

  let conversation = executor.start("single_step");
  assert.equal(conversation?.progress, 0);

  conversation = executor.next(conversation!, "response");
  assert.equal(conversation?.progress, 100);
});

test("ConversationTemplateExecutor handles missing nextPrompt at completion", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "two_step",
    name: "Two Step",
    description: "A two step template",
    intent: "task_query",
    steps: [
      {
        stepId: "step1",
        prompt: "First step",
        isRequired: true,
        expectedEntities: [],
        allowSkip: false,
      },
      {
        stepId: "step2",
        prompt: "Second step",
        isRequired: true,
        expectedEntities: [],
        allowSkip: false,
      },
    ],
  });

  const executor = new ConversationTemplateExecutor(registry);

  let conversation = executor.start("two_step");
  assert.ok(conversation?.nextPrompt !== undefined);

  conversation = executor.next(conversation!, "First");
  assert.ok(conversation?.nextPrompt !== undefined);

  conversation = executor.next(conversation!, "Second");
  assert.ok(conversation?.nextPrompt === undefined);
  assert.equal(conversation?.isComplete, true);
});

test("ConversationTemplateExecutor handles template without response", () => {
  const executor = new ConversationTemplateExecutor();

  let conversation = executor.start("task_create_standard");

  conversation = executor.next(conversation!, undefined, { customContext: "value" });

  assert.equal(conversation?.context.customContext, "value");
});

test("ConversationTemplateExecutor validates schema on register", () => {
  const registry = new ConversationTemplateRegistry();

  assert.throws(() => {
    registry.register({
      templateId: "invalid_no_steps",
      name: "Invalid",
      description: "Missing steps field",
      intent: "task_create",
    } as ConversationTemplate);
  });
});

test("ConversationTemplateRegistry can override existing template", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "override_test",
    name: "Original Name",
    description: "Original description",
    intent: "task_create",
    steps: [],
  });

  registry.register({
    templateId: "override_test",
    name: "Updated Name",
    description: "Updated description",
    intent: "task_modify",
    steps: [],
  });

  const retrieved = registry.get("override_test");

  assert.equal(retrieved?.name, "Updated Name");
  assert.equal(retrieved?.intent, "task_modify");
});

test("ConversationTemplateRegistry handles multiple intents correctly", () => {
  const registry = new ConversationTemplateRegistry();

  const intents: ConversationTemplateIntent[] = [
    "task_create",
    "task_query",
    "task_modify",
    "status_inquiry",
    "approval_action",
    "system_config",
  ];

  for (const intent of intents) {
    registry.register({
      templateId: `intent_${intent}`,
      name: `${intent} template`,
      description: `Template for ${intent}`,
      intent,
      steps: [],
    });
  }

  for (const intent of intents) {
    const templates = registry.listByIntent(intent);
    assert.ok(templates.some(t => t.templateId === `intent_${intent}`));
  }
});

test("ConversationTemplateRegistry handles tag filtering", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "tag_test_1",
    name: "Tag Test 1",
    description: "First tagged template",
    intent: "task_create",
    steps: [],
    tags: ["urgent", "high-priority"],
  });

  registry.register({
    templateId: "tag_test_2",
    name: "Tag Test 2",
    description: "Second tagged template",
    intent: "task_create",
    steps: [],
    tags: ["urgent", "low-priority"],
  });

  registry.register({
    templateId: "tag_test_3",
    name: "Tag Test 3",
    description: "Third tagged template",
    intent: "task_create",
    steps: [],
    tags: ["normal"],
  });

  const urgentTemplates = registry.listByTag("urgent");
  assert.equal(urgentTemplates.length, 2);

  const priorityTags = registry.listByTag("high-priority");
  assert.equal(priorityTags.length, 1);
  assert.equal(priorityTags[0]?.templateId, "tag_test_1");
});

test("ConversationTemplateExecutor handles template with all optional fields", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "fully_optional",
    name: "Fully Optional",
    description: "Template with all optional fields",
    version: "2.0",
    intent: "task_query",
    steps: [
      {
        stepId: "step1",
        prompt: "Step prompt",
        responseTemplate: "Thank you for {{response}}",
        expectedEntities: ["entity1", "entity2"],
        isRequired: false,
        allowSkip: true,
      },
    ],
    estimatedDurationMinutes: 10,
    tags: ["optional", "test"],
    isActive: true,
  });

  const executor = new ConversationTemplateExecutor(registry);
  const conversation = executor.start("fully_optional");

  assert.ok(conversation !== null);
  assert.equal(conversation?.templateId, "fully_optional");
});

test("ConversationTemplateExecutor calculates progress correctly at boundary", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "three_step",
    name: "Three Step",
    description: "A three step template",
    intent: "task_create",
    steps: [
      { stepId: "s1", prompt: "Step 1", isRequired: true, expectedEntities: [], allowSkip: false },
      { stepId: "s2", prompt: "Step 2", isRequired: true, expectedEntities: [], allowSkip: false },
      { stepId: "s3", prompt: "Step 3", isRequired: true, expectedEntities: [], allowSkip: false },
    ],
  });

  const executor = new ConversationTemplateExecutor(registry);

  let conversation = executor.start("three_step");
  assert.equal(conversation?.progress, 0);

  conversation = executor.next(conversation!, "r1");
  assert.equal(conversation?.progress, 33);

  conversation = executor.next(conversation!, "r2");
  // (2/3) * 100 = 66.67, rounds to 67
  assert.equal(conversation?.progress, 67);

  conversation = executor.next(conversation!, "r3");
  assert.equal(conversation?.progress, 100);
});

test("ConversationTemplateSchema validates required fields", () => {
  const validTemplate = {
    templateId: "validate_test",
    name: "Validation Test",
    description: "Testing schema validation",
    intent: "task_create",
    steps: [],
  };

  const result = ConversationTemplateSchema.safeParse(validTemplate);
  assert.equal(result.success, true);
});

test("ConversationTemplateStepSchema validates step structure", () => {
  const validStep = {
    stepId: "step1",
    prompt: "Enter value:",
    responseTemplate: "You entered {{response}}",
    expectedEntities: ["value"],
    isRequired: true,
    allowSkip: false,
  };

  const result = ConversationTemplateStepSchema.safeParse(validStep);
  assert.equal(result.success, true);
});

test("ConversationTemplateStepSchema applies defaults", () => {
  const minimalStep = {
    stepId: "step1",
    prompt: "Enter value:",
  };

  const result = ConversationTemplateStepSchema.parse(minimalStep);

  assert.deepEqual(result.expectedEntities, []);
  assert.equal(result.isRequired, true);
  assert.equal(result.allowSkip, false);
});

test("ConversationTemplateExecutor.start sets correct initial state", () => {
  const executor = new ConversationTemplateExecutor();

  const conversation = executor.start("task_create_standard");

  assert.ok(conversation !== null);
  assert.equal(conversation?.currentStepIndex, 0);
  assert.equal(conversation?.isComplete, false);
  assert.equal(conversation?.progress, 0);
  assert.ok(conversation?.nextPrompt !== undefined);
  assert.deepEqual(conversation?.context, {});
});
