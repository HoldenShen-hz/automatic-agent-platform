import test from "node:test";
import assert from "node:assert/strict";
import {
  GraphQLAdapterService,
  GraphQLSchemaBuilder,
  type GraphQLSchemaWithResolvers,
} from "../../../../../src/platform/five-plane-interface/api/graphql-adapter-service.js";

test("GraphQLAdapterService - is available", () => {
  const service = new GraphQLAdapterService({ endpoint: "/graphql" });
  assert.equal(service.isAvailable(), true);
});

test("GraphQLAdapterService - returns config", () => {
  const service = new GraphQLAdapterService({ endpoint: "/graphql" });
  const config = service.getConfig();
  assert.equal(config.endpoint, "/graphql");
});

test("GraphQLAdapterService - register schema", () => {
  const service = new GraphQLAdapterService({ endpoint: "/graphql" });
  const schema: GraphQLSchemaWithResolvers = {
    schema: {
      queryType: "Query",
      types: [{
        name: "Query",
        fields: [{
          name: "hello",
          type: "String",
          required: true,
        }],
      }],
    },
    resolvers: {
      "Query.hello": async () => "world",
    },
  };

  service.registerSchema("test-schema", schema);
  const schemas = service.getRegisteredSchemas();
  assert.ok(schemas.includes("test-schema"));
});

test("GraphQLAdapterService - execute query", async () => {
  const service = new GraphQLAdapterService({ endpoint: "/graphql" });

  service.registerSchema("test-schema", {
    schema: {
      queryType: "Query",
      types: [{
        name: "Query",
        fields: [{
          name: "greeting",
          type: "String",
          required: true,
        }],
      }],
    },
    resolvers: {
      "Query.greeting": async () => "Hello, World!",
    },
  });

  const response = await service.execute("test-schema", {
    query: "query { greeting }",
  });

  assert.equal(response.success, true);
  assert.ok(response.data !== undefined);
});

test("GraphQLAdapterService - execute on unknown schema", async () => {
  const service = new GraphQLAdapterService({ endpoint: "/graphql" });

  const response = await service.execute("unknown-schema", {
    query: "query { hello }",
  });

  assert.equal(response.success, false);
  assert.ok(response.errors !== undefined);
  assert.ok(response.errors!.length > 0);
});

test("GraphQLAdapterService - subscribe and unsubscribe", () => {
  const service = new GraphQLAdapterService({ endpoint: "/graphql" });

  service.registerSchema("test-schema", {
    schema: {
      queryType: "Query",
      subscriptionType: "Subscription",
      types: [
        {
          name: "Query",
          fields: [{ name: "dummy", type: "String", required: true }],
        },
        {
          name: "Subscription",
          fields: [{ name: "onEvent", type: "String", required: true }],
        },
      ],
    },
    resolvers: {},
  });

  const result = service.subscribe("test-schema", "subscription { onEvent }", {});
  assert.ok(result.operationId.startsWith("sub_"));

  const unsubscribed = service.unsubscribe(result.operationId);
  assert.equal(unsubscribed, true);
});

test("GraphQLSchemaBuilder - builds schema", () => {
  const schema = new GraphQLSchemaBuilder()
    .addType({ name: "Query", fields: [{ name: "id", type: "ID", required: true }] })
    .setQueryType("Query")
    .build();

  assert.equal(schema.queryType, "Query");
  assert.ok(schema.types.length >= 1);
});
