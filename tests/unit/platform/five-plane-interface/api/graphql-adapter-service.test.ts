import assert from "node:assert/strict";
import test from "node:test";

import {
  GRAPHQL_ERROR_CODES,
  GraphQLAdapterService,
  GraphQLSchemaBuilder,
} from "../../../../../src/platform/five-plane-interface/api/graphql-adapter-service.js";

function registerQuerySchema(service: GraphQLAdapterService): void {
  service.registerSchema("demo", {
    schema: new GraphQLSchemaBuilder()
      .setQueryType("Query")
      .addType({
        name: "Query",
        fields: [
          { name: "hello", type: "String", required: true },
          {
            name: "greet",
            type: "String",
            required: true,
            args: [{ name: "name", type: "String", required: true }],
          },
        ],
      })
      .build(),
    resolvers: {
      "Query.hello": async () => "world",
      "Query.greet": async (args) => `hello ${String(args["name"])}`,
    },
  });
}

test("GraphQLAdapterService exposes immutable config snapshots and schema names", () => {
  const service = new GraphQLAdapterService({ endpoint: "https://api.example.test/graphql" });
  registerQuerySchema(service);

  const config = service.getConfig();
  const nextConfig = service.getConfig();

  assert.notEqual(config, nextConfig);
  assert.equal(config.endpoint, "https://api.example.test/graphql");
  assert.deepEqual(service.getRegisteredSchemas(), ["demo"]);
});

test("GraphQLAdapterService returns not-found errors for unknown schemas", async () => {
  const service = new GraphQLAdapterService({ endpoint: "https://api.example.test/graphql" });

  const result = await service.execute("missing", { query: "query { hello }" });

  assert.equal(result.success, false);
  assert.equal(result.errors?.[0]?.extensions?.code, GRAPHQL_ERROR_CODES.NOT_FOUND);
});

test("GraphQLAdapterService executes query resolvers", async () => {
  const service = new GraphQLAdapterService({ endpoint: "https://api.example.test/graphql" });
  registerQuerySchema(service);

  const result = await service.execute<{ hello: string }>("demo", { query: "query { hello }" });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { hello: "world" });
});

test("GraphQLAdapterService parses arguments and variables for resolvers", async () => {
  const service = new GraphQLAdapterService({ endpoint: "https://api.example.test/graphql" });
  registerQuerySchema(service);

  const result = await service.execute<{ greet: string }>("demo", {
    query: "query { greet(name: $name) }",
    variables: { name: "alice" },
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, { greet: "hello alice" });
});

test("GraphQLAdapterService validates missing required arguments and unknown fields", () => {
  const service = new GraphQLAdapterService({ endpoint: "https://api.example.test/graphql" });
  registerQuerySchema(service);

  assert.deepEqual(service.validateQuery("demo", "query { greet }"), {
    valid: true,
    errors: [],
  });
  const invalidField = service.validateQuery("demo", "query { missingField }");
  assert.equal(invalidField.valid, false);
  assert.ok(invalidField.errors.some((entry) => entry.includes("missingField")));
});

test("GraphQLAdapterService rejects subscription execution through execute()", async () => {
  const service = new GraphQLAdapterService({ endpoint: "https://api.example.test/graphql" });
  service.registerSchema("sub", {
    schema: {
      queryType: "Query",
      subscriptionType: "Subscription",
      types: [
        { name: "Query", fields: [] },
        { name: "Subscription", fields: [{ name: "events", type: "String", required: true }] },
      ],
    },
    resolvers: {},
  });

  const result = await service.execute("sub", { query: "subscription { events }" });

  assert.equal(result.success, false);
  assert.equal(result.errors?.[0]?.extensions?.code, GRAPHQL_ERROR_CODES.GRAPHQL_EXECUTION_ERROR);
});

test("GraphQLAdapterService subscribe/unsubscribe manages live handlers", () => {
  const service = new GraphQLAdapterService({ endpoint: "https://api.example.test/graphql" });
  registerQuerySchema(service);
  const events: Array<{ message: string }> = [];

  const subscription = service.subscribe("demo", "subscription { events }", {}, (event) => {
    const payload = event.data as { message: string };
    events.push(payload);
  });

  service.emitSubscriptionEvent(subscription.operationId, { data: { message: "first" } });
  assert.deepEqual(events, [{ message: "first" }]);
  assert.equal(service.unsubscribe(subscription.operationId), true);
  service.emitSubscriptionEvent(subscription.operationId, { data: { message: "second" } });
  assert.deepEqual(events, [{ message: "first" }]);
});

test("GraphQLAdapterService exposes REST bridge helpers", () => {
  assert.deepEqual(GraphQLAdapterService.restToGraphQLVariables({ tenantId: "t-1" }), {
    input: { tenantId: "t-1" },
    restArgs: { tenantId: "t-1" },
  });
  assert.deepEqual(
    GraphQLAdapterService.graphqlToRestResponse({
      success: false,
      errors: [{ message: "boom" }],
    }),
    { success: false, data: undefined, errors: ["boom"] },
  );
});
