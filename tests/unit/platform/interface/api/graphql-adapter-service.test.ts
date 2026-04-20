/**
 * Unit tests for GraphQL adapter service
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §54
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  GraphQLAdapterService,
  GraphQLSchemaBuilder,
  type GraphQLSchemaWithResolvers,
  type GraphQLRequest,
  GRAPHQL_ERROR_CODES,
} from "../../../../../src/platform/interface/api/graphql-adapter-service.js";

function createTestSchema(): GraphQLSchemaWithResolvers {
  const schema = new GraphQLSchemaBuilder()
    .setQueryType("Query")
    .setMutationType("Mutation")
    .addType({
      name: "Query",
      fields: [
        { name: "hello", type: "String", required: true },
      ],
    })
    .addType({
      name: "Mutation",
      fields: [
        { name: "sendMessage", type: "Boolean", required: true, args: [{ name: "message", type: "String", required: true }] },
      ],
    })
    .build();

  return {
    schema,
    resolvers: {
      "Query.hello": async () => "world",
      "Mutation.sendMessage": async (args) => args.message === "hello",
    },
  };
}

test("GraphQLAdapterService isAvailable returns true", () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  assert.equal(adapter.isAvailable(), true);
});

test("GraphQLAdapterService getConfig returns config", () => {
  const config = { endpoint: "http://localhost:4000/graphql", playgroundEnabled: true };
  const adapter = new GraphQLAdapterService(config);
  const result = adapter.getConfig();

  assert.equal(result.endpoint, "http://localhost:4000/graphql");
  assert.equal(result.playgroundEnabled, true);
});

test("GraphQLAdapterService registerSchema and getRegisteredSchemas", () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  const schema = createTestSchema();

  adapter.registerSchema("test", schema);

  const schemas = adapter.getRegisteredSchemas();
  assert.deepEqual(schemas, ["test"]);
});

test("GraphQLAdapterService execute returns error for missing schema", async () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  const request: GraphQLRequest = { query: "query { hello }" };

  const result = await adapter.execute("nonexistent", request);

  assert.equal(result.success, false);
  assert.equal(result.errors?.[0].message, "Schema 'nonexistent' not found");
  assert.equal(result.errors?.[0].extensions?.code, GRAPHQL_ERROR_CODES.NOT_FOUND);
});

test("GraphQLAdapterService execute returns error for subscription", async () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  const schema = createTestSchema();
  adapter.registerSchema("test", schema);

  const request: GraphQLRequest = { query: "subscription { onMessage { data } }" };

  const result = await adapter.execute("test", request);

  assert.equal(result.success, false);
  assert.equal(result.errors?.[0].message, "Use subscribe() for subscription operations");
});

test("GraphQLAdapterService execute returns success for query", async () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  const schema = createTestSchema();
  adapter.registerSchema("test", schema);

  const request: GraphQLRequest = { query: "query { hello }" };

  const result = await adapter.execute<{ hello: string }>("test", request);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { hello: "world" });
});

test("GraphQLAdapterService execute resolves mutation arguments from variables", async () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  adapter.registerSchema("test", createTestSchema());

  const result = await adapter.execute<{ sendMessage: boolean }>("test", {
    query: "mutation Send($message: String!) { sendMessage(message: $message) }",
    operationName: "Send",
    variables: { message: "hello" },
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { sendMessage: true });
});

test("GraphQLAdapterService execute validates required arguments", async () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  adapter.registerSchema("test", createTestSchema());

  const result = await adapter.execute("test", {
    query: "mutation { sendMessage }",
  });

  assert.equal(result.success, false);
  assert.match(result.errors?.[0]?.message ?? "", /Missing required argument 'message'/);
});

test("GraphQLAdapterService subscribe returns operation result", () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  const schema = createTestSchema();
  adapter.registerSchema("test", schema);

  const result = adapter.subscribe("test", "subscription { onMessage { data } }", {}, () => {});

  assert.ok(result.operationId);
  assert.equal(result.operationType, "subscription");
});

test("GraphQLAdapterService unsubscribe returns true", () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  const schema = createTestSchema();
  adapter.registerSchema("test", schema);

  const sub = adapter.subscribe("test", "subscription { onMessage }", {}, () => {});

  const result = adapter.unsubscribe(sub.operationId);
  assert.equal(result, true);
});

test("GraphQLAdapterService unsubscribe returns false for unknown id", () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  const result = adapter.unsubscribe("unknown-id");
  assert.equal(result, false);
});

test("GraphQLAdapterService emitSubscriptionEvent calls handler", () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  const schema = createTestSchema();
  adapter.registerSchema("test", schema);

  let called = false;
  let receivedData: unknown = null;

  const sub = adapter.subscribe("test", "subscription { onMessage }", {}, (event) => {
    called = true;
    receivedData = event.data;
  });

  adapter.emitSubscriptionEvent(sub.operationId, { data: { message: "hello" } });

  assert.equal(called, true);
  assert.deepEqual(receivedData, { message: "hello" });
});

test("GraphQLAdapterService validateQuery returns valid for good query", () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  const schema = createTestSchema();
  adapter.registerSchema("test", schema);

  const result = adapter.validateQuery("test", "query { hello }");

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("GraphQLAdapterService validateQuery returns error for missing field", () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  adapter.registerSchema("test", createTestSchema());

  const result = adapter.validateQuery("test", "query { unknownField }");

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("Field 'unknownField' not found")));
});

test("GraphQLAdapterService validateQuery returns error for empty query", () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  const schema = createTestSchema();
  adapter.registerSchema("test", schema);

  const result = adapter.validateQuery("test", "");

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("Query cannot be empty"));
});

test("GraphQLAdapterService validateQuery returns error for missing operation", () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });
  const schema = createTestSchema();
  adapter.registerSchema("test", schema);

  const result = adapter.validateQuery("test", "{ hello }");

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("query, mutation, or subscription")));
});

test("GraphQLAdapterService validateQuery returns error for unknown schema", () => {
  const adapter = new GraphQLAdapterService({ endpoint: "http://localhost:4000/graphql" });

  const result = adapter.validateQuery("unknown", "query { hello }");

  assert.equal(result.valid, false);
  assert.equal(result.errors[0], "Schema 'unknown' not found");
});

test("GraphQLAdapterService restToGraphQLVariables converts correctly", () => {
  const rest = { name: "test", value: 42 };
  const result = GraphQLAdapterService.restToGraphQLVariables(rest);

  assert.deepEqual(result.input, rest);
  assert.deepEqual(result.restArgs, rest);
});

test("GraphQLAdapterService graphqlToRestResponse converts correctly", () => {
  const response = {
    success: true,
    data: { hello: "world" },
    errors: [{ message: "error", locations: [], path: [] }],
  };

  const result = GraphQLAdapterService.graphqlToRestResponse(response);

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { hello: "world" });
  assert.deepEqual(result.errors, ["error"]);
});

test("GraphQLSchemaBuilder builds valid schema", () => {
  const builder = new GraphQLSchemaBuilder();
  const schema = builder
    .setQueryType("Query")
    .setMutationType("Mutation")
    .addType({
      name: "Query",
      fields: [{ name: "hello", type: "String", required: true }],
    })
    .build();

  assert.equal(schema.queryType, "Query");
  assert.equal(schema.mutationType, "Mutation");
  assert.equal(schema.types.length, 1);
});

test("GraphQLSchemaBuilder throws when building without query type", () => {
  const builder = new GraphQLSchemaBuilder();

  assert.throws(() => {
    builder.build();
  }, /Query type is required/);
});
