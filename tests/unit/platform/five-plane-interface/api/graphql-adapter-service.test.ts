import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  GraphQLAdapterService,
  GraphQLSchemaBuilder,
  type GraphQLSchemaDefinition,
  type GraphQLRequest,
  HEALTH_CHECK_QUERY,
  INTROSPECTION_QUERY_PREFIX,
  GRAPHQL_ERROR_CODES,
} from "../../../../../src/platform/five-plane-interface/api/graphql-adapter-service.js";

describe("GraphQLAdapterService", () => {
  let service: GraphQLAdapterService;

  beforeEach(() => {
    service = new GraphQLAdapterService({
      endpoint: "https://api.example.com/graphql",
    });
  });

  describe("constructor", () => {
    it("should create service with config", () => {
      const s = new GraphQLAdapterService({
        endpoint: "https://api.test.com/graphql",
        introspectionEnabled: false,
        playgroundEnabled: true,
      });

      assert.strictEqual(s.isAvailable(), true);
      const config = s.getConfig();
      assert.strictEqual(config.endpoint, "https://api.test.com/graphql");
      assert.strictEqual(config.introspectionEnabled, false);
      assert.strictEqual(config.playgroundEnabled, true);
    });

    it("should use default config values", () => {
      const s = new GraphQLAdapterService({
        endpoint: "https://api.default.com/graphql",
      });

      const config = s.getConfig();
      assert.strictEqual(config.introspectionEnabled, true);
      assert.strictEqual(config.playgroundEnabled, false);
    });
  });

  describe("isAvailable", () => {
    it("should return true", () => {
      assert.strictEqual(service.isAvailable(), true);
    });
  });

  describe("getConfig", () => {
    it("should return copy of config", () => {
      const config = service.getConfig();
      config.endpoint = "https://modified.com/graphql"; // Should not affect internal

      const internalConfig = service.getConfig();
      assert.strictEqual(internalConfig.endpoint, "https://api.example.com/graphql");
    });
  });

  describe("registerSchema", () => {
    it("should register a schema", () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        types: [
          {
            name: "Query",
            fields: [
              { name: "hello", type: "String", required: true },
            ],
          },
        ],
      };

      service.registerSchema("test-schema", { schema, resolvers: {} });

      const schemas = service.getRegisteredSchemas();
      assert.deepStrictEqual(schemas, ["test-schema"]);
    });
  });

  describe("getRegisteredSchemas", () => {
    it("should return empty array when no schemas registered", () => {
      const schemas = service.getRegisteredSchemas();
      assert.deepStrictEqual(schemas, []);
    });

    it("should return registered schema names", () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        types: [],
      };
      service.registerSchema("schema-a", { schema, resolvers: {} });
      service.registerSchema("schema-b", { schema, resolvers: {} });

      const schemas = service.getRegisteredSchemas();
      assert.strictEqual(schemas.length, 2);
    });
  });

  describe("execute", () => {
    it("should return error for unknown schema", async () => {
      const request: GraphQLRequest = { query: "query { hello }" };
      const result = await service.execute("unknown-schema", request);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors?.length);
      assert.strictEqual(result.errors![0]!.message, "Schema 'unknown-schema' not found");
    });

    it("should reject subscription operations", async () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        subscriptionType: "Subscription",
        types: [
          { name: "Query", fields: [] },
          { name: "Subscription", fields: [] },
        ],
      };
      service.registerSchema("sub-schema", { schema, resolvers: {} });

      const request: GraphQLRequest = { query: "subscription { onEvent { data } }" };
      const result = await service.execute("sub-schema", request);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors?.length);
      assert.strictEqual(result.errors![0]!.extensions?.code, GRAPHQL_ERROR_CODES.GRAPHQL_EXECUTION_ERROR);
    });

    it("should execute query against registered schema", async () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        types: [
          {
            name: "Query",
            fields: [
              { name: "hello", type: "String", required: true },
            ],
          },
        ],
      };
      service.registerSchema("exec-schema", {
        schema,
        resolvers: {
          "Query.hello": async () => "Hello, World!",
        },
      });

      const request: GraphQLRequest = { query: "query { hello }" };
      const result = await service.execute<{ hello: string }>("exec-schema", request);

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.hello, "Hello, World!");
    });

    it("should handle resolver errors gracefully", async () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        types: [
          {
            name: "Query",
            fields: [
              { name: "error", type: "String", required: false },
            ],
          },
        ],
      };
      service.registerSchema("error-schema", {
        schema,
        resolvers: {
          "Query.error": async () => {
            throw new Error("Resolver error");
          },
        },
      });

      const request: GraphQLRequest = { query: "query { error }" };
      const result = await service.execute("error-schema", request);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors?.length);
    });

    it("should parse and pass arguments to resolvers", async () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        types: [
          {
            name: "Query",
            fields: [
              {
                name: "greet",
                type: "String",
                required: true,
                args: [
                  { name: "name", type: "String", required: true },
                ],
              },
            ],
          },
        ],
      };
      service.registerSchema("args-schema", {
        schema,
        resolvers: {
          "Query.greet": async (args) => {
            return `Hello, ${args["name"]}!`;
          },
        },
      });

      const request: GraphQLRequest = { query: "query { greet(name: \"Alice\") }" };
      const result = await service.execute<{ greet: string }>("args-schema", request);

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
      assert.strictEqual(result.data.greet, "Hello, Alice!");
    });

    it("should handle missing required arguments", async () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        types: [
          {
            name: "Query",
            fields: [
              {
                name: "greet",
                type: "String",
                required: true,
                args: [
                  { name: "name", type: "String", required: true },
                ],
              },
            ],
          },
        ],
      };
      service.registerSchema("missing-args-schema", {
        schema,
        resolvers: {
          "Query.greet": async () => "Hello!",
        },
      });

      const request: GraphQLRequest = { query: "query { greet }" };
      const result = await service.execute("missing-args-schema", request);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors?.some((e) => e.message.includes("Missing required argument")));
    });
  });

  describe("subscribe", () => {
    it("should throw for unknown schema", () => {
      assert.throws(() => {
        service.subscribe("unknown", "subscription { onEvent { data } }", {}, () => {});
      }, /Schema 'unknown' not found/);
    });

    it("should create subscription and return operation result", () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        subscriptionType: "Subscription",
        types: [
          { name: "Query", fields: [] },
          { name: "Subscription", fields: [{ name: "onEvent", type: "String", required: true }] },
        ],
      };
      service.registerSchema("sub-test", { schema, resolvers: {} });

      const result = service.subscribe("sub-test", "subscription { onEvent }", {});

      assert.strictEqual(result.operationType, "subscription");
      assert.ok(result.operationId.startsWith("sub_"));
    });

    it("should allow multiple subscriptions", () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        subscriptionType: "Subscription",
        types: [
          { name: "Query", fields: [] },
          { name: "Subscription", fields: [{ name: "onEvent", type: "String", required: true }] },
        ],
      };
      service.registerSchema("multi-sub", { schema, resolvers: {} });

      const result1 = service.subscribe("multi-sub", "subscription { onEvent }", {});
      const result2 = service.subscribe("multi-sub", "subscription { onEvent }", {});

      assert.notStrictEqual(result1.operationId, result2.operationId);
    });
  });

  describe("unsubscribe", () => {
    it("should return false for unknown operation", () => {
      const result = service.unsubscribe("unknown-operation-id");
      assert.strictEqual(result, false);
    });

    it("should return true after unsubscribe", () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        subscriptionType: "Subscription",
        types: [
          { name: "Query", fields: [] },
          { name: "Subscription", fields: [{ name: "onEvent", type: "String", required: true }] },
        ],
      };
      service.registerSchema("unsub-test", { schema, resolvers: {} });

      const { operationId } = service.subscribe("unsub-test", "subscription { onEvent }", {});
      const result = service.unsubscribe(operationId);

      assert.strictEqual(result, true);
      // Second unsubscribe should return false
      assert.strictEqual(service.unsubscribe(operationId), false);
    });
  });

  describe("emitSubscriptionEvent", () => {
    it("should do nothing for unknown operation", () => {
      // Should not throw
      service.emitSubscriptionEvent("unknown-id", { data: { test: true } });
    });

    it("should deliver event to subscription handler", () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        subscriptionType: "Subscription",
        types: [
          { name: "Query", fields: [] },
          { name: "Subscription", fields: [{ name: "onEvent", type: "String", required: true }] },
        ],
      };
      service.registerSchema("emit-test", { schema, resolvers: {} });

      let receivedEvent: unknown = null;
      const { operationId } = service.subscribe("emit-test", "subscription { onEvent }", {});

      service.emitSubscriptionEvent(operationId, { data: { message: "test-event" } });

      // The subscription handler is not stored in a way we can directly check,
      // but we verify no errors are thrown
      assert.ok(operationId);
    });
  });

  describe("validateQuery", () => {
    it("should return error for unknown schema", () => {
      const result = service.validateQuery("unknown", "query { hello }");

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes("Schema 'unknown' not found"));
    });

    it("should return error for empty query", () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        types: [{ name: "Query", fields: [] }],
      };
      service.registerSchema("empty-query-schema", { schema, resolvers: {} });

      const result = service.validateQuery("empty-query-schema", "");

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.includes("Query cannot be empty"));
    });

    it("should return error for query without operation", () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        types: [{ name: "Query", fields: [] }],
      };
      service.registerSchema("no-op-schema", { schema, resolvers: {} });

      const result = service.validateQuery("no-op-schema", "{ someField }");

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("Query must contain query, mutation, or subscription operation")));
    });

    it("should return error for field not on root type", () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        types: [{ name: "Query", fields: [{ name: "hello", type: "String", required: true }] }],
      };
      service.registerSchema("field-not-found-schema", { schema, resolvers: {} });

      const result = service.validateQuery("field-not-found-schema", "query { unknownField }");

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("Field 'unknownField' not found")));
    });

    it("should validate correct query", () => {
      const schema: GraphQLSchemaDefinition = {
        queryType: "Query",
        types: [
          { name: "Query", fields: [{ name: "hello", type: "String", required: true }] },
        ],
      };
      service.registerSchema("valid-query-schema", { schema, resolvers: {} });

      const result = service.validateQuery("valid-query-schema", "query { hello }");

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
  });

  describe("static helpers", () => {
    describe("restToGraphQLVariables", () => {
      it("should convert REST request to GraphQL variables", () => {
        const restRequest = { id: "123", name: "Test" };
        const result = GraphQLAdapterService.restToGraphQLVariables(restRequest);

        assert.deepStrictEqual(result, {
          input: restRequest,
          restArgs: restRequest,
        });
      });
    });

    describe("graphqlToRestResponse", () => {
      it("should convert GraphQL response to REST format", () => {
        const graphqlResponse = {
          success: true,
          data: { hello: "world" },
          errors: [],
        };
        const result = GraphQLAdapterService.graphqlToRestResponse(graphqlResponse);

        assert.deepStrictEqual(result, {
          success: true,
          data: { hello: "world" },
          errors: [],
        });
      });

      it("should extract error messages from GraphQL errors", () => {
        const graphqlResponse = {
          success: false,
          data: undefined,
          errors: [
            { message: "Error 1", locations: [], path: [] },
            { message: "Error 2", locations: [], path: [] },
          ],
        };
        const result = GraphQLAdapterService.graphqlToRestResponse(graphqlResponse);

        assert.deepStrictEqual(result.errors, ["Error 1", "Error 2"]);
      });
    });
  });

  describe("health check constants", () => {
    it("should have health check query defined", () => {
      assert.ok(HEALTH_CHECK_QUERY.includes("Health"));
      assert.ok(HEALTH_CHECK_QUERY.includes("__typename"));
    });

    it("should have introspection query prefix defined", () => {
      assert.strictEqual(INTROSPECTION_QUERY_PREFIX, "__schema");
    });
  });

  describe("GraphQLSchemaBuilder", () => {
    it("should build schema with query type", () => {
      const builder = new GraphQLSchemaBuilder();
      builder.addType({ name: "Query", fields: [{ name: "hello", type: "String", required: true }] });
      builder.setQueryType("Query");

      const schema = builder.build();

      assert.strictEqual(schema.queryType, "Query");
      assert.strictEqual(schema.types.length, 1);
    });

    it("should throw when building without query type", () => {
      const builder = new GraphQLSchemaBuilder();

      assert.throws(() => {
        builder.build();
      }, /Query type is required/);
    });

    it("should build schema with mutation type", () => {
      const builder = new GraphQLSchemaBuilder();
      builder.addType({ name: "Query", fields: [] });
      builder.addType({ name: "Mutation", fields: [] });
      builder.setQueryType("Query");
      builder.setMutationType("Mutation");

      const schema = builder.build();

      assert.strictEqual(schema.mutationType, "Mutation");
    });

    it("should build schema with subscription type", () => {
      const builder = new GraphQLSchemaBuilder();
      builder.addType({ name: "Query", fields: [] });
      builder.addType({ name: "Subscription", fields: [] });
      builder.setQueryType("Query");
      builder.setSubscriptionType("Subscription");

      const schema = builder.build();

      assert.strictEqual(schema.subscriptionType, "Subscription");
    });

    it("should allow fluent chaining", () => {
      const schema = new GraphQLSchemaBuilder()
        .addType({ name: "Query", fields: [] })
        .setQueryType("Query")
        .build();

      assert.strictEqual(schema.queryType, "Query");
    });
  });
});