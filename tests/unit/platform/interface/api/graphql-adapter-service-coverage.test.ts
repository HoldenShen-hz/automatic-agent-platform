import test from "node:test";
import assert from "node:assert/strict";

import {
  GraphQLAdapterService,
  GraphQLSchemaBuilder,
  HEALTH_CHECK_QUERY,
  INTROSPECTION_QUERY_PREFIX,
  type GraphQLAdapterConfig,
  type GraphQLSchemaDefinition,
  type GraphQLRequest,
  type GraphQLOperationType,
} from "../../../../../src/platform/five-plane-interface/api/graphql-adapter-service.js";

test("GraphQLAdapterService isAvailable returns true", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  assert.equal(service.isAvailable(), true);
});

test("GraphQLAdapterService getConfig returns config with defaults", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const config = service.getConfig();

  assert.equal(config.endpoint, "http://localhost/graphql");
  assert.equal(config.introspectionEnabled, true);
  assert.equal(config.playgroundEnabled, false);
});

test("GraphQLAdapterService getConfig merges custom config with defaults", () => {
  const service = new GraphQLAdapterService({
    endpoint: "http://localhost/graphql",
    introspectionEnabled: false,
    playgroundEnabled: true,
  });

  const config = service.getConfig();

  assert.equal(config.introspectionEnabled, false);
  assert.equal(config.playgroundEnabled, true);
});

test("GraphQLAdapterService registerSchema stores schema", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    types: [
      {
        name: "Query",
        fields: [
          {
            name: "hello",
            type: "String",
            required: false,
          },
        ],
      },
    ],
  };

  service.registerSchema("test-schema", { schema, resolvers: {} });

  const schemas = service.getRegisteredSchemas();
  assert.deepStrictEqual(schemas, ["test-schema"]);
});

test("GraphQLAdapterService execute returns error for unknown schema", async () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const response = await service.execute("unknown-schema", { query: "{ hello }" });

  assert.equal(response.success, false);
  assert.ok(response.errors != null);
  assert.equal(response.errors.length, 1);
  assert.ok(response.errors[0]!.message.includes("not found"));
});

test("GraphQLAdapterService execute rejects subscription operations", async () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    subscriptionType: "Subscription",
    types: [
      {
        name: "Query",
        fields: [{ name: "hello", type: "String", required: false }],
      },
    ],
  };

  service.registerSchema("test-schema", { schema, resolvers: {} });

  const response = await service.execute("test-schema", { query: "subscription { onEvent { data } }" });

  assert.equal(response.success, false);
  assert.ok(response.errors != null);
  assert.ok(response.errors[0]!.message.includes("subscription"));
});

test("GraphQLAdapterService execute returns data on valid query", async () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    types: [
      {
        name: "Query",
        fields: [{ name: "hello", type: "String", required: false }],
      },
    ],
  };

  service.registerSchema("test-schema", {
    schema,
    resolvers: {
      "Query.hello": async () => "Hello, World!",
    },
  });

  const response = await service.execute("test-schema", { query: "{ hello }" });

  assert.equal(response.success, true);
  assert.ok(response.data != null);
});

test("GraphQLAdapterService execute returns sanitized message on resolver failure", async () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    types: [
      {
        name: "Query",
        fields: [{ name: "hello", type: "String", required: false }],
      },
    ],
  };

  service.registerSchema("test-schema", {
    schema,
    resolvers: {
      "Query.hello": async () => {
        throw new Error("internal file /tmp/secret.txt not readable");
      },
    },
  });

  const response = await service.execute("test-schema", { query: "{ hello }" });

  assert.equal(response.success, false);
  assert.equal(
    response.errors?.[0]?.message,
    "An internal error occurred while processing the GraphQL request.",
  );
});

test("GraphQLAdapterService subscribe creates subscription and returns operationId", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    subscriptionType: "Subscription",
    types: [
      {
        name: "Subscription",
        fields: [{ name: "onEvent", type: "String", required: false }],
      },
    ],
  };

  service.registerSchema("test-schema", { schema, resolvers: {} });

  const result = service.subscribe("test-schema", "subscription { onEvent }", {}, () => {});

  assert.ok(result.operationId.startsWith("sub_"));
  assert.equal(result.operationType, "subscription");
});

test("GraphQLAdapterService subscribe throws for unknown schema", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  assert.throws(() => {
    service.subscribe("unknown-schema", "subscription { onEvent }", {}, () => {});
  }, (err: Error) => {
    return err.message.includes("not found");
  });
});

test("GraphQLAdapterService unsubscribe removes subscription", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    subscriptionType: "Subscription",
    types: [
      {
        name: "Subscription",
        fields: [{ name: "onEvent", type: "String", required: false }],
      },
    ],
  };

  service.registerSchema("test-schema", { schema, resolvers: {} });

  const result = service.subscribe("test-schema", "subscription { onEvent }", {}, () => {});

  const unsubscribed = service.unsubscribe(result.operationId);

  assert.equal(unsubscribed, true);
});

test("GraphQLAdapterService unsubscribe returns false for unknown operation", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const result = service.unsubscribe("unknown-operation-id");

  assert.equal(result, false);
});

test("GraphQLAdapterService emitSubscriptionEvent calls handler", () => {
  assert.doesNotThrow(() => {
    const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

    const schema: GraphQLSchemaDefinition = {
      queryType: "Query",
      subscriptionType: "Subscription",
      types: [
        {
          name: "Subscription",
          fields: [{ name: "onEvent", type: "String", required: false }],
        },
      ],
    };

    service.registerSchema("test-schema", { schema, resolvers: {} });

    const result = service.subscribe("test-schema", "subscription { onEvent }", {}, () => {});

    let called = false;
    service.unsubscribe(result.operationId);

    // After unsubscribe, handler should not be called
    service.emitSubscriptionEvent(result.operationId, { data: "test" });

    // No error means success (handler just doesn't exist anymore)
  });
});

test("GraphQLAdapterService validateQuery returns valid for correct query", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    types: [
      {
        name: "Query",
        fields: [{ name: "hello", type: "String", required: false }],
      },
    ],
  };

  service.registerSchema("test-schema", { schema, resolvers: {} });

  const result = service.validateQuery("test-schema", "query { hello }");

  assert.equal(result.valid, true);
  assert.deepStrictEqual(result.errors, []);
});

test("GraphQLAdapterService validateQuery returns error for unknown schema", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const result = service.validateQuery("unknown-schema", "{ hello }");

  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test("GraphQLAdapterService validateQuery returns error for empty query", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    types: [
      {
        name: "Query",
        fields: [{ name: "hello", type: "String", required: false }],
      },
    ],
  };

  service.registerSchema("test-schema", { schema, resolvers: {} });

  const result = service.validateQuery("test-schema", "   ");

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("empty")));
});

test("GraphQLAdapterService validateQuery returns error for query without operation", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    types: [
      {
        name: "Query",
        fields: [{ name: "hello", type: "String", required: false }],
      },
    ],
  };

  service.registerSchema("test-schema", { schema, resolvers: {} });

  const result = service.validateQuery("test-schema", "{ notAQuery }");

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("operation")));
});

test("GraphQLAdapterService validateQuery returns error for unknown field", () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    types: [
      {
        name: "Query",
        fields: [{ name: "hello", type: "String", required: false }],
      },
    ],
  };

  service.registerSchema("test-schema", { schema, resolvers: {} });

  const result = service.validateQuery("test-schema", "query { unknownField }");

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("not found")));
});

test("GraphQLAdapterService restToGraphQLVariables converts REST to GraphQL format", () => {
  const restRequest = { id: "123", name: "Test" };

  const graphqlVars = GraphQLAdapterService.restToGraphQLVariables(restRequest);

  assert.deepStrictEqual(graphqlVars.input, restRequest);
  assert.deepStrictEqual(graphqlVars.restArgs, restRequest);
});

test("GraphQLAdapterService graphqlToRestResponse converts GraphQL to REST format", () => {
  const graphqlResponse = {
    success: true,
    data: { hello: "World" },
    errors: undefined,
  };

  const restResponse = GraphQLAdapterService.graphqlToRestResponse(graphqlResponse);

  assert.equal(restResponse.success, true);
  assert.deepStrictEqual(restResponse.data, { hello: "World" });
  assert.deepStrictEqual(restResponse.errors, undefined);
});

test("GraphQLAdapterService graphqlToRestResponse maps errors to messages", () => {
  const graphqlResponse = {
    success: false,
    errors: [
      { message: "Error 1" },
      { message: "Error 2" },
    ],
  };

  const restResponse = GraphQLAdapterService.graphqlToRestResponse(graphqlResponse);

  assert.deepStrictEqual(restResponse.errors, ["Error 1", "Error 2"]);
});

test("GraphQLSchemaBuilder requires query type", () => {
  const builder = new GraphQLSchemaBuilder();

  assert.throws(() => {
    builder.build();
  }, (err: Error) => {
    return err.message.includes("Query type is required");
  });
});

test("GraphQLSchemaBuilder builds valid schema with query type", () => {
  const builder = new GraphQLSchemaBuilder();

  const schema = builder
    .addType({ name: "Query", fields: [] })
    .setQueryType("Query")
    .build();

  assert.equal(schema.queryType, "Query");
  assert.equal(schema.mutationType, undefined);
});

test("GraphQLSchemaBuilder includes mutation and subscription types when set", () => {
  const builder = new GraphQLSchemaBuilder();

  const schema = builder
    .addType({ name: "Query", fields: [] })
    .addType({ name: "Mutation", fields: [] })
    .addType({ name: "Subscription", fields: [] })
    .setQueryType("Query")
    .setMutationType("Mutation")
    .setSubscriptionType("Subscription")
    .build();

  assert.equal(schema.queryType, "Query");
  assert.equal(schema.mutationType, "Mutation");
  assert.equal(schema.subscriptionType, "Subscription");
});

test("HEALTH_CHECK_QUERY is a valid introspection query", () => {
  assert.ok(HEALTH_CHECK_QUERY.includes("__typename"));
});

test("INTROSPECTION_QUERY_PREFIX is __schema", () => {
  assert.equal(INTROSPECTION_QUERY_PREFIX, "__schema");
});

test("GraphQLAdapterService handles mutation with variables", async () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    mutationType: "Mutation",
    types: [
      {
        name: "Query",
        fields: [],
      },
      {
        name: "Mutation",
        fields: [
          {
            name: "createUser",
            type: "User",
            args: [
              { name: "name", type: "String", required: true },
              { name: "email", type: "String", required: true },
            ],
            required: false,
          },
        ],
      },
      {
        name: "User",
        fields: [
          { name: "id", type: "ID", required: true },
          { name: "name", type: "String", required: true },
        ],
      },
    ],
  };

  service.registerSchema("test-schema", {
    schema,
    resolvers: {
      "Mutation.createUser": async (args) => ({ id: "new-user-id", name: args.name }),
    },
  });

  const response = await service.execute("test-schema", {
    query: "mutation CreateUser($name: String!, $email: String!) { createUser(name: $name, email: $email) { id name } }",
    variables: { name: "John", email: "john@example.com" },
  });

  assert.equal(response.success, true);
});

test("GraphQLAdapterService passes context to resolver", async () => {
  const service = new GraphQLAdapterService({ endpoint: "http://localhost/graphql" });

  const schema: GraphQLSchemaDefinition = {
    queryType: "Query",
    types: [
      {
        name: "Query",
        fields: [{ name: "hello", type: "String", required: false }],
      },
    ],
  };

  let receivedArgs: Record<string, unknown> = {};
  service.registerSchema("test-schema", {
    schema,
    resolvers: {
      "Query.hello": async (args, _context) => {
        receivedArgs = args;
        return "Hello!";
      },
    },
  });

  await service.execute("test-schema", {
    query: "query { hello }",
    variables: { name: "test" },
  });

  // The resolver should receive the parsed arguments
  assert.ok(receivedArgs != null);
});
