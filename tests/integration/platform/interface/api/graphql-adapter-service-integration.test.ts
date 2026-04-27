/**
 * Integration tests for GraphQL Adapter Service
 *
 * Tests the GraphQL adapter service schema registration, query execution,
 * and subscription handling in a realistic scenario.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  GraphQLAdapterService,
  GraphQLSchemaBuilder,
  HEALTH_CHECK_QUERY,
  INTROSPECTION_QUERY_PREFIX,
  type GraphQLSchemaWithResolvers,
} from "../../../../../src/platform/interface/api/graphql-adapter-service.js";

function createTaskSchema(): GraphQLSchemaWithResolvers {
  const schema = new GraphQLSchemaBuilder()
    .setQueryType("Query")
    .setMutationType("Mutation")
    .setSubscriptionType("Subscription")
    .addType({
      name: "Query",
      fields: [
        { name: "task", type: "Task", required: false, args: [{ name: "id", type: "ID", required: true }] },
        { name: "tasks", type: "[Task]", required: false },
        { name: "taskCount", type: "Int", required: false },
      ],
    })
    .addType({
      name: "Mutation",
      fields: [
        { name: "createTask", type: "Task", required: true, args: [{ name: "title", type: "String", required: true }] },
        { name: "updateTask", type: "Task", required: true, args: [{ name: "id", type: "ID", required: true }, { name: "title", type: "String", required: false }] },
        { name: "deleteTask", type: "Boolean", required: true, args: [{ name: "id", type: "ID", required: true }] },
      ],
    })
    .addType({
      name: "Subscription",
      fields: [
        { name: "taskCreated", type: "Task", required: false },
        { name: "taskUpdated", type: "Task", required: false },
      ],
    })
    .addType({
      name: "Task",
      fields: [
        { name: "id", type: "ID", required: true },
        { name: "title", type: "String", required: true },
        { name: "status", type: "String", required: false },
      ],
    })
    .build();

  // In-memory task store for testing
  const tasks = new Map<string, { id: string; title: string; status: string }>();
  let taskIdCounter = 1;

  return {
    schema,
    resolvers: {
      "Query.task": async (args) => {
        const task = tasks.get(args.id as string);
        return task ?? null;
      },
      "Query.tasks": async () => Array.from(tasks.values()),
      "Query.taskCount": async () => tasks.size,
      "Mutation.createTask": async (args, _context) => {
        const id = `task-${taskIdCounter++}`;
        const task = { id, title: args.title as string, status: "pending" };
        tasks.set(id, task);
        return task;
      },
      "Mutation.updateTask": async (args) => {
        const task = tasks.get(args.id as string);
        if (!task) throw new Error(`Task ${args.id} not found`);
        if (args.title) task.title = args.title as string;
        return task;
      },
      "Mutation.deleteTask": async (args) => {
        return tasks.delete(args.id as string);
      },
    },
  };
}

test("integration: GraphQL adapter service with task schema", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  service.registerSchema("tasks", createTaskSchema());

  const schemas = service.getRegisteredSchemas();
  assert.deepStrictEqual(schemas, ["tasks"]);
});

test("integration: GraphQL adapter executes queries against registered schema", async () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  service.registerSchema("tasks", createTaskSchema());

  // Create a task first via mutation
  const createResult = await service.execute<{ createTask: { id: string; title: string } }>("tasks", {
    query: "mutation { createTask(title: \"Test Task\") { id title } }",
  });
  assert.equal(createResult.success, true);
  assert.ok(createResult.data?.createTask?.id);
  assert.equal(createResult.data?.createTask?.title, "Test Task");
});

test("integration: GraphQL adapter handles query variables", async () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  service.registerSchema("tasks", createTaskSchema());

  // Create a task
  await service.execute("tasks", {
    query: "mutation Create($title: String!) { createTask(title: $title) { id } }",
    variables: { title: "Variable Task" },
  });

  // Query it back
  const queryResult = await service.execute<{ tasks: Array<{ id: string; title: string }> }>("tasks", {
    query: "query { tasks { id title } }",
  });
  assert.equal(queryResult.success, true);
  assert.ok(Array.isArray(queryResult.data?.tasks));
  assert.ok(queryResult.data?.tasks?.some((t) => t.title === "Variable Task"));
});

test("integration: GraphQL adapter subscription lifecycle", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  service.registerSchema("tasks", createTaskSchema());

  let receivedEvents: unknown[] = [];

  // Subscribe to task creation events
  const subscribeResult = service.subscribe(
    "tasks",
    "subscription { taskCreated { id title } }",
    {},
    (event) => {
      receivedEvents.push(event);
    },
  );

  assert.ok(subscribeResult.operationId.startsWith("sub_"));
  assert.equal(subscribeResult.operationType, "subscription");

  // Emit some events
  service.emitSubscriptionEvent(subscribeResult.operationId, {
    data: { id: "task-1", title: "New Task" },
  });
  service.emitSubscriptionEvent(subscribeResult.operationId, {
    data: { id: "task-2", title: "Another Task" },
  });

  assert.equal(receivedEvents.length, 2);

  // Unsubscribe
  const unsubscribeResult = service.unsubscribe(subscribeResult.operationId);
  assert.equal(unsubscribeResult, true);

  // Emit after unsubscribe should not reach handler
  receivedEvents = [];
  service.emitSubscriptionEvent(subscribeResult.operationId, {
    data: { id: "task-3", title: "Should Not Receive" },
  });
  assert.equal(receivedEvents.length, 0);
});

test("integration: GraphQL adapter validates queries", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  service.registerSchema("tasks", createTaskSchema());

  // Valid query
  const validResult = service.validateQuery("tasks", "query { taskCount }");
  assert.equal(validResult.valid, true);
  assert.deepStrictEqual(validResult.errors, []);

  // Empty query
  const emptyResult = service.validateQuery("tasks", "");
  assert.equal(emptyResult.valid, false);
  assert.ok(emptyResult.errors.some((e) => e.includes("empty")));

  // Unknown field
  const unknownFieldResult = service.validateQuery("tasks", "query { unknownField }");
  assert.equal(unknownFieldResult.valid, false);
  assert.ok(unknownFieldResult.errors.some((e) => e.includes("not found")));
});

test("integration: GraphQL adapter handles errors gracefully", async () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  service.registerSchema("tasks", createTaskSchema());

  // Execute with unknown schema
  const unknownSchemaResult = await service.execute("unknown-schema", {
    query: "query { taskCount }",
  });
  assert.equal(unknownSchemaResult.success, false);
  assert.ok(unknownSchemaResult.errors?.some((e) => e.message.includes("not found")));

  // Execute subscription via execute method (should fail)
  const subscriptionResult = await service.execute("tasks", {
    query: "subscription { taskCreated { id } }",
  });
  assert.equal(subscriptionResult.success, false);
  assert.ok(subscriptionResult.errors?.some((e) => e.message.includes("subscription")));
});

test("integration: GraphQL adapter REST conversion utilities", () => {
  // Test restToGraphQLVariables
  const restRequest = { id: "123", name: "Test User", active: true };
  const graphqlVars = GraphQLAdapterService.restToGraphQLVariables(restRequest);
  assert.deepStrictEqual(graphqlVars.input, restRequest);
  assert.deepStrictEqual(graphqlVars.restArgs, restRequest);

  // Test graphqlToRestResponse with success
  const successResponse = {
    success: true,
    data: { task: { id: "1", title: "Test" } },
    errors: undefined,
  };
  const restSuccess = GraphQLAdapterService.graphqlToRestResponse(successResponse);
  assert.equal(restSuccess.success, true);
  assert.deepStrictEqual(restSuccess.data, successResponse.data);

  // Test graphqlToRestResponse with errors
  const errorResponse = {
    success: false,
    data: undefined,
    errors: [
      { message: "Not found", locations: [], path: ["task"] },
      { message: "Unauthorized", locations: [], path: [] },
    ],
  };
  const restError = GraphQLAdapterService.graphqlToRestResponse(errorResponse);
  assert.equal(restError.success, false);
  assert.deepStrictEqual(restError.errors, ["Not found", "Unauthorized"]);
});

test("integration: GraphQL adapter configuration", () => {
  // Default config
  const service1 = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  let config = service1.getConfig();
  assert.equal(config.endpoint, "http://localhost:4000/graphql");
  assert.equal(config.introspectionEnabled, true);
  assert.equal(config.playgroundEnabled, false);

  // Custom config
  const service2 = new GraphQLAdapterService({
    endpoint: "http://localhost:5000/graphql",
    introspectionEnabled: false,
    playgroundEnabled: true,
  });
  config = service2.getConfig();
  assert.equal(config.endpoint, "http://localhost:5000/graphql");
  assert.equal(config.introspectionEnabled, false);
  assert.equal(config.playgroundEnabled, true);
});

test("integration: GraphQL schema builder", () => {
  const builder = new GraphQLSchemaBuilder();

  const schema = builder
    .setQueryType("Query")
    .setMutationType("Mutation")
    .setSubscriptionType("Subscription")
    .addType({
      name: "Query",
      fields: [
        { name: "version", type: "String", required: false },
      ],
    })
    .addType({
      name: "Mutation",
      fields: [
        { name: "ping", type: "Boolean", required: false },
      ],
    })
    .addType({
      name: "Subscription",
      fields: [
        { name: "onEvent", type: "String", required: false },
      ],
    })
    .build();

  assert.equal(schema.queryType, "Query");
  assert.equal(schema.mutationType, "Mutation");
  assert.equal(schema.subscriptionType, "Subscription");
  assert.equal(schema.types.length, 3);
});

test("integration: HEALTH_CHECK_QUERY and INTROSPECTION_QUERY_PREFIX", () => {
  assert.ok(HEALTH_CHECK_QUERY.includes("__typename"));
  assert.ok(HEALTH_CHECK_QUERY.includes("query"));
  assert.equal(INTROSPECTION_QUERY_PREFIX, "__schema");
});
