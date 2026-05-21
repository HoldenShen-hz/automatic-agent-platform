import { randomUUID } from "node:crypto";

/**
 * GraphQL Adapter Service
 *
 * Provides GraphQL adapter for cross-platform support.
 * Implements §52 "Cross-Platform Adapter Layer" requirement for GraphQL protocol support.
 *
 * @see docs_en/reviews/architecture-design-vs-implementation-review.md §52
 */

/**
 * GraphQL adapter configuration
 */
export interface GraphQLAdapterConfig {
  readonly endpoint: string;
  readonly schemaPath?: string;
  readonly introspectionEnabled?: boolean;
  readonly playgroundEnabled?: boolean;
}

/**
 * GraphQL operation types
 */
export type GraphQLOperationType = "query" | "mutation" | "subscription";

/**
 * GraphQL field definition
 */
export interface GraphQLFieldDefinition {
  readonly name: string;
  readonly type: string;
  readonly args?: readonly GraphQLArgDefinition[];
  readonly required: boolean;
}

/**
 * GraphQL argument definition
 */
export interface GraphQLArgDefinition {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly defaultValue?: unknown;
}

/**
 * GraphQL type definition
 */
export interface GraphQLTypeDefinition {
  readonly name: string;
  readonly fields: readonly GraphQLFieldDefinition[];
  readonly description?: string;
}

/**
 * GraphQL schema definition
 */
export interface GraphQLSchemaDefinition {
  readonly queryType: string;
  readonly mutationType?: string;
  readonly subscriptionType?: string;
  readonly types: readonly GraphQLTypeDefinition[];
}

/**
 * GraphQL request
 */
export interface GraphQLRequest {
  readonly query: string;
  readonly operationName?: string;
  readonly variables?: Record<string, unknown>;
}

/**
 * GraphQL response
 */
export interface GraphQLResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly errors?: readonly GraphQLError[];
}

export interface GraphQLError {
  readonly message: string;
  readonly locations?: readonly { line: number; column: number }[];
  readonly path?: readonly string[];
  readonly extensions?: Record<string, unknown>;
}

/**
 * GraphQL subscription event
 */
export interface GraphQLSubscriptionEvent<T = unknown> {
  readonly data?: T;
  readonly errors?: readonly GraphQLError[];
}

/**
 * GraphQL operation result for subscriptions
 */
export interface GraphQLOperationResult {
  readonly operationId: string;
  readonly operationType: GraphQLOperationType;
}

/**
 * Standard GraphQL error codes
 */
export const GRAPHQL_ERROR_CODES = {
  GRAPHQL_PARSE_ERROR: "GRAPHQL_PARSE_ERROR",
  GRAPHQL_VALIDATION_ERROR: "GRAPHQL_VALIDATION_ERROR",
  GRAPHQL_EXECUTION_ERROR: "GRAPHQL_EXECUTION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
} as const;

/**
 * GraphQL resolver function type
 */
export type GraphQLResolver = (
  args: Record<string, unknown>,
  context: GraphQLContext,
) => Promise<unknown>;

/**
 * GraphQL context passed to resolvers
 */
export interface GraphQLContext {
  readonly requestId: string;
  readonly userId?: string;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * GraphQL schema with resolvers
 */
export interface GraphQLSchemaWithResolvers {
  readonly schema: GraphQLSchemaDefinition;
  readonly resolvers: Readonly<Record<string, GraphQLResolver>>;
}

interface ParsedGraphQLOperation {
  readonly fieldName: string;
  readonly arguments: Record<string, unknown>;
}

/**
 * GraphQL adapter for cross-platform communication
 */
export class GraphQLAdapterService {
  private readonly config: GraphQLAdapterConfig;
  private readonly schemas = new Map<string, GraphQLSchemaWithResolvers>();
  private readonly subscriptions = new Map<string, (event: GraphQLSubscriptionEvent) => void>();

  public constructor(config: GraphQLAdapterConfig) {
    this.config = {
      introspectionEnabled: true,
      playgroundEnabled: false,
      ...config,
    };
  }

  /**
   * Check if GraphQL adapter is available
   */
  public isAvailable(): boolean {
    return true;
  }

  /**
   * Get adapter configuration
   */
  public getConfig(): GraphQLAdapterConfig {
    return { ...this.config };
  }

  /**
   * Register a schema with resolvers
   */
  public registerSchema(name: string, schema: GraphQLSchemaWithResolvers): void {
    this.schemas.set(name, schema);
  }

  /**
   * Get registered schema names
   */
  public getRegisteredSchemas(): readonly string[] {
    return Array.from(this.schemas.keys());
  }

  /**
   * Execute a GraphQL query or mutation
   */
  public async execute<T = unknown>(
    schemaName: string,
    request: GraphQLRequest,
    context?: Partial<GraphQLContext>,
  ): Promise<GraphQLResponse<T>> {
    const schema = this.schemas.get(schemaName);

    if (!schema) {
      return {
        success: false,
        errors: [{
          message: `Schema '${schemaName}' not found`,
          extensions: { code: GRAPHQL_ERROR_CODES.NOT_FOUND },
        }],
      };
    }

    try {
      // Parse the query (simplified - real implementation would use graphql-js)
      const operationType = this.detectOperationType(request.query);

      if (operationType === "subscription") {
        return {
          success: false,
          errors: [{
            message: "Use subscribe() for subscription operations",
            extensions: { code: GRAPHQL_ERROR_CODES.GRAPHQL_EXECUTION_ERROR },
          }],
        };
      }

      // Execute the operation (simplified - real implementation would use graphql-js)
      const result = await this.executeOperation<T>(
        schema,
        request,
        context,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          message: error instanceof Error ? error.message : "Unknown error",
          extensions: { code: GRAPHQL_ERROR_CODES.GRAPHQL_EXECUTION_ERROR },
        }],
      };
    }
  }

  /**
   * Start a subscription
   */
  public subscribe(
    schemaName: string,
    query: string,
    variables: Record<string, unknown>,
    onEvent: (event: GraphQLSubscriptionEvent) => void,
  ): GraphQLOperationResult {
    const schema = this.schemas.get(schemaName);

    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }

    const operationId = `sub_${randomUUID()}`;
    this.subscriptions.set(operationId, onEvent);

    return {
      operationId,
      operationType: "subscription",
    };
  }

  /**
   * Unsubscribe from a subscription
   */
  public unsubscribe(operationId: string): boolean {
    return this.subscriptions.delete(operationId);
  }

  /**
   * Emit an event to a subscription
   */
  public emitSubscriptionEvent(operationId: string, event: GraphQLSubscriptionEvent): void {
    const handler = this.subscriptions.get(operationId);
    if (handler) {
      handler(event);
    }
  }

  /**
   * Validate a GraphQL query against a schema
   */
  public validateQuery(schemaName: string, query: string): { valid: boolean; errors: readonly string[] } {
    const schema = this.schemas.get(schemaName);

    if (!schema) {
      return { valid: false, errors: [`Schema '${schemaName}' not found`] };
    }

    // Simplified validation - real implementation would use graphql-js
    const errors: string[] = [];

    if (!query.trim()) {
      errors.push("Query cannot be empty");
    }

    if (!query.includes("query") && !query.includes("mutation") && !query.includes("subscription")) {
      errors.push("Query must contain query, mutation, or subscription operation");
    }

    if (errors.length === 0) {
      try {
        const operationType = this.detectOperationType(query);
        const fieldName = this.parseOperation(query).fieldName;
        const rootType = this.resolveRootType(schema.schema, operationType);
        const field = this.findField(schema.schema, rootType, fieldName);
        if (!field) {
          errors.push(`Field '${fieldName}' not found on ${rootType}`);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Failed to parse GraphQL query");
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Convert REST request to GraphQL variables
   */
  public static restToGraphQLVariables(restRequest: Record<string, unknown>): Record<string, unknown> {
    return {
      input: restRequest,
      restArgs: restRequest,
    };
  }

  /**
   * Convert GraphQL response to REST format
   */
  public static graphqlToRestResponse<T>(graphqlResponse: GraphQLResponse<T>): Record<string, unknown> {
    return {
      success: graphqlResponse.success,
      data: graphqlResponse.data,
      errors: graphqlResponse.errors?.map((e) => e.message),
    };
  }

  /**
   * Detect operation type from query string
   */
  private detectOperationType(query: string): GraphQLOperationType {
    const normalized = query.toLowerCase().replace(/\s+/g, " ");
    if (normalized.includes("subscription")) return "subscription";
    if (normalized.includes("mutation")) return "mutation";
    return "query";
  }

  /**
   * Execute an operation against the schema
   */
  private async executeOperation<T>(
    schema: GraphQLSchemaWithResolvers,
    request: GraphQLRequest,
    context?: Partial<GraphQLContext>,
  ): Promise<T> {
    const ctx: GraphQLContext = {
      requestId: `req_${Date.now()}`,
      headers: {},
      ...context,
    };
    const operationType = this.detectOperationType(request.query);
    const parsed = this.parseOperation(request.query, request.variables);
    const rootType = this.resolveRootType(schema.schema, operationType);
    const field = this.findField(schema.schema, rootType, parsed.fieldName);

    if (!field) {
      throw new Error(`Field '${parsed.fieldName}' not found on ${rootType}`);
    }

    for (const arg of field.args ?? []) {
      if (arg.required && parsed.arguments[arg.name] === undefined) {
        throw new Error(`Missing required argument '${arg.name}' for field '${field.name}'`);
      }
    }

    const resolverKeyCandidates = [
      `${rootType}.${field.name}`,
      `${operationType}.${field.name}`,
      field.name,
    ];
    const resolver = resolverKeyCandidates
      .map((key) => schema.resolvers[key])
      .find((candidate): candidate is GraphQLResolver => candidate !== undefined);

    const resolvedData = resolver
      ? await resolver(parsed.arguments, ctx)
      : {
        _meta: {
          operationName: request.operationName ?? "anonymous",
          schema: rootType,
          field: field.name,
          context: ctx,
        },
      };

    return {
      [field.name]: resolvedData,
    } as T;
  }

  private resolveRootType(schema: GraphQLSchemaDefinition, operationType: GraphQLOperationType): string {
    if (operationType === "mutation") {
      if (!schema.mutationType) {
        throw new Error("Mutation type is not configured");
      }
      return schema.mutationType;
    }
    if (operationType === "subscription") {
      if (!schema.subscriptionType) {
        throw new Error("Subscription type is not configured");
      }
      return schema.subscriptionType;
    }
    return schema.queryType;
  }

  private findField(schema: GraphQLSchemaDefinition, typeName: string, fieldName: string): GraphQLFieldDefinition | null {
    const type = schema.types.find((item) => item.name === typeName);
    return type?.fields.find((field) => field.name === fieldName) ?? null;
  }

  private parseOperation(query: string, variables?: Record<string, unknown>): ParsedGraphQLOperation {
    const bodyStart = query.indexOf("{");
    const bodyEnd = query.lastIndexOf("}");
    if (bodyStart < 0 || bodyEnd <= bodyStart) {
      throw new Error("Query must include a selection set");
    }

    const body = query.slice(bodyStart + 1, bodyEnd).trim();
    const match = body.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?/);
    if (!match) {
      throw new Error("Unable to determine root field from query");
    }

    const [, fieldName, argList] = match;
    return {
      fieldName: fieldName ?? "",
      arguments: this.parseArguments(argList ?? "", variables),
    };
  }

  private parseArguments(argList: string, variables?: Record<string, unknown>): Record<string, unknown> {
    const args: Record<string, unknown> = {};
    const trimmed = argList.trim();
    if (trimmed.length === 0) {
      return args;
    }

    for (const entry of trimmed.split(",").map((item) => item.trim()).filter(Boolean)) {
      const separatorIndex = entry.indexOf(":");
      if (separatorIndex < 0) {
        continue;
      }
      const name = entry.slice(0, separatorIndex).trim();
      const rawValue = entry.slice(separatorIndex + 1).trim();
      args[name] = this.parseArgumentValue(rawValue, variables);
    }

    return args;
  }

  private parseArgumentValue(rawValue: string, variables?: Record<string, unknown>): unknown {
    if (rawValue.startsWith("$")) {
      return variables?.[rawValue.slice(1)];
    }
    if ((rawValue.startsWith("\"") && rawValue.endsWith("\"")) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
      return rawValue.slice(1, -1);
    }
    if (rawValue === "true") return true;
    if (rawValue === "false") return false;
    if (rawValue === "null") return null;
    if (/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
      return Number(rawValue);
    }
    return rawValue;
  }
}

/**
 * GraphQL schema builder utility
 */
export class GraphQLSchemaBuilder {
  private readonly types: GraphQLTypeDefinition[] = [];
  private queryType?: string;
  private mutationType?: string;
  private subscriptionType?: string;

  public addType(type: GraphQLTypeDefinition): this {
    this.types.push(type);
    return this;
  }

  public setQueryType(name: string): this {
    this.queryType = name;
    return this;
  }

  public setMutationType(name: string): this {
    this.mutationType = name;
    return this;
  }

  public setSubscriptionType(name: string): this {
    this.subscriptionType = name;
    return this;
  }

  public build(): GraphQLSchemaDefinition {
    if (!this.queryType) {
      throw new Error("Query type is required");
    }

    return {
      queryType: this.queryType,
      ...(this.mutationType !== undefined && { mutationType: this.mutationType }),
      ...(this.subscriptionType !== undefined && { subscriptionType: this.subscriptionType }),
      types: this.types,
    };
  }
}

/**
 * Health check query for GraphQL endpoint
 */
export const HEALTH_CHECK_QUERY = `
  query Health {
    __typename
  }
`;

/**
 * Introspection query prefix
 */
export const INTROSPECTION_QUERY_PREFIX = "__schema";
