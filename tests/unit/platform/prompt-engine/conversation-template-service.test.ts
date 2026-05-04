import test from "node:test";
import assert from "node:assert/strict";
import {
  ConversationTemplateRegistry,
  ConversationTemplateExecutor,
  type ConversationTemplate,
} from "../../../../src/platform/prompt-engine/conversation-template-service.js";

test("ConversationTemplateRegistry registers and retrieves templates", () => {
  const registry = new ConversationTemplateRegistry();

  const template: ConversationTemplate = {
    templateId: "test_template",
    name: "测试模板",
    description: "一个测试模板",
    intent: "task_create",
    version: "1.0",
    tags: ["test"],
    estimatedDurationMinutes: 5,
    isActive: true,
    steps: [
      {
        stepId: "step1",
        prompt: "第一步：",
        isRequired: true,
        expectedEntities: [],
        allowSkip: false,
      },
    ],
  };

  registry.register(template);

  const retrieved = registry.get("test_template");
  assert.ok(retrieved !== undefined);
  assert.equal(retrieved?.name, "测试模板");
});

test("ConversationTemplateRegistry has built-in templates", () => {
  const registry = new ConversationTemplateRegistry();

  const templates = registry.listActive();

  assert.ok(templates.length > 0);
  assert.ok(registry.get("task_create_standard") !== undefined);
  assert.ok(registry.get("task_query_status") !== undefined);
});

test("ConversationTemplateRegistry lists by intent", () => {
  const registry = new ConversationTemplateRegistry();

  const taskCreateTemplates = registry.listByIntent("task_create");
  const taskQueryTemplates = registry.listByIntent("task_query");

  assert.ok(taskCreateTemplates.length > 0);
  assert.ok(taskQueryTemplates.length > 0);
  for (const t of taskCreateTemplates) {
    assert.equal(t.intent, "task_create");
  }
});

test("ConversationTemplateRegistry searches by name", () => {
  const registry = new ConversationTemplateRegistry();

  const results = registry.search("任务创建");

  assert.ok(results.length > 0);
  assert.ok(
    results.some((t) =>
      t.name.includes("任务创建") || t.description.includes("任务创建")
    ),
  );
});

test("ConversationTemplateRegistry lists by tag", () => {
  const registry = new ConversationTemplateRegistry();

  const results = registry.listByTag("task");

  assert.ok(results.length > 0);
  for (const t of results) {
    assert.ok(t.tags.includes("task"));
  }
});

test("ConversationTemplateExecutor starts a conversation", () => {
  const executor = new ConversationTemplateExecutor();

  const conversation = executor.start("task_create_standard");

  assert.ok(conversation !== null);
  assert.equal(conversation?.templateId, "task_create_standard");
  assert.equal(conversation?.currentStepIndex, 0);
  assert.equal(conversation?.isComplete, false);
  assert.ok(conversation?.nextPrompt !== undefined);
});

test("ConversationTemplateExecutor advances through steps", () => {
  const executor = new ConversationTemplateExecutor();

  let conversation = executor.start("task_create_standard");
  assert.equal(conversation?.currentStepIndex, 0);

  conversation = executor.next(conversation!, "测试任务标题");
  assert.equal(conversation?.currentStepIndex, 1);

  conversation = executor.next(conversation!, "这是描述");
  assert.equal(conversation?.currentStepIndex, 2);
});

test("ConversationTemplateExecutor completes conversation", () => {
  const executor = new ConversationTemplateExecutor();

  // task_query_status has 2 steps
  let conversation = executor.start("task_query_status");

  conversation = executor.next(conversation!, "task_123");
  assert.equal(conversation?.isComplete, false);

  conversation = executor.next(conversation!, "状态");
  assert.equal(conversation?.isComplete, true);
  assert.ok(conversation?.nextPrompt === undefined);
});

test("ConversationTemplateExecutor.next returns the existing conversation when template is no longer available mid-flow", () => {
  const registry = new ConversationTemplateRegistry();
  registry.register({
    templateId: "missing_mid_flow",
    name: "Missing Mid Flow",
    description: "Template removed after start",
    intent: "task_create",
    steps: [
      {
        stepId: "step1",
        prompt: "step1",
        isRequired: true,
        expectedEntities: [],
        allowSkip: false,
      },
      {
        stepId: "step2",
        prompt: "step2",
        isRequired: true,
        expectedEntities: [],
        allowSkip: false,
      },
    ],
    isActive: true,
  });

  const executor = new ConversationTemplateExecutor(registry);
  const conversation = executor.start("missing_mid_flow");
  assert.ok(conversation !== null);

  const originalGet = registry.get.bind(registry);
  (registry as { get: (templateId: string) => ConversationTemplate | undefined }).get = (templateId: string) =>
    templateId === "missing_mid_flow" ? undefined : originalGet(templateId);

  const advanced = executor.next(conversation!, "response");
  assert.equal(advanced, conversation);
  assert.equal(advanced.currentStepIndex, 0);
});

test("ConversationTemplateExecutor tracks progress", () => {
  const executor = new ConversationTemplateExecutor();

  let conversation = executor.start("task_create_standard");

  // task_create_standard has 5 steps
  assert.equal(conversation?.progress, 0);

  conversation = executor.next(conversation!, "step1 response");
  assert.equal(conversation?.progress, 20);

  conversation = executor.next(conversation!, "step2 response");
  assert.equal(conversation?.progress, 40);
});

test("ConversationTemplateExecutor skips allowed steps", () => {
  const executor = new ConversationTemplateExecutor();

  let conversation = executor.start("task_create_standard");

  // First step is required, skip should return null
  const skipped = executor.skip(conversation!);
  assert.equal(skipped, null);

  // Advance to a skippable step (priority)
  conversation = executor.next(conversation!, "测试");
  conversation = executor.next(conversation!, "描述");

  // Now we should be at a skippable step
  const skipped2 = executor.skip(conversation!);
  assert.ok(skipped2 !== null);
});

test("ConversationTemplateExecutor updates context", () => {
  const executor = new ConversationTemplateExecutor();

  let conversation = executor.start("task_create_standard");

  conversation = executor.next(conversation!, "任务标题", {
    userId: "user_123",
  });

  assert.equal(conversation?.context.title, "任务标题");
  assert.equal(conversation?.context.userId, "user_123");
});

test("ConversationTemplateExecutor returns null for unknown template", () => {
  const executor = new ConversationTemplateExecutor();

  const conversation = executor.start("nonexistent_template");

  assert.equal(conversation, null);
});

test("ConversationTemplateRegistry validates template schema", () => {
  const registry = new ConversationTemplateRegistry();

  const invalidTemplate = {
    templateId: "invalid",
    name: "Invalid",
    // missing required fields
  };

  assert.throws(() => {
    registry.register(invalidTemplate as ConversationTemplate);
  });
});

test("ConversationTemplateExecutor handles template with no steps", () => {
  const registry = new ConversationTemplateRegistry();

  registry.register({
    templateId: "empty_template",
    name: "Empty",
    description: "Template with no steps",
    intent: "task_query",
    steps: [],
  });

  const executor = new ConversationTemplateExecutor(registry);
  const conversation = executor.start("empty_template");

  assert.ok(conversation !== null);
  assert.equal(conversation?.isComplete, true);
  assert.equal(conversation?.progress, 100);
});

test("ConversationTemplateExecutor calculates progress correctly", () => {
  const executor = new ConversationTemplateExecutor();

  // task_create_standard has 5 steps
  let conversation = executor.start("task_create_standard");

  // 0/5 = 0%
  assert.equal(conversation?.progress, 0);

  // 1/5 = 20%
  conversation = executor.next(conversation!, "s1");
  assert.equal(conversation?.progress, 20);

  // 2/5 = 40%
  conversation = executor.next(conversation!, "s2");
  assert.equal(conversation?.progress, 40);

  // 3/5 = 60%
  conversation = executor.next(conversation!, "s3");
  assert.equal(conversation?.progress, 60);

  // 4/5 = 80%
  conversation = executor.next(conversation!, "s4");
  assert.equal(conversation?.progress, 80);

  // 5/5 = 100%
  conversation = executor.next(conversation!, "s5");
  assert.equal(conversation?.progress, 100);
});
