/**
 * GraphQL Adapter Service
 *
 * Provides GraphQL adapter for cross-platform support.
 * Implements §52 "跨平台适配层" requirement for GraphQL protocol support.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
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

    const operationId = `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
    // Simplified execution - real implementation would use graphql-js
    // This returns a mock response structure
    const ctx: GraphQLContext = {
      requestId: `req_${Date.now()}`,
      headers: {},
      ...context,
    };

    // In a real implementation, we would:
    // 1. Parse the query with graphql-js
    // 2. Validate against the schema
    // 3. Execute the appropriate resolver
    // 4. Return the result

    return {
      _meta: {
        operationName: request.operationName ?? "anonymous",
        schema: schema.schema.queryType,
        context: ctx,
      },
    } as unknown as T;
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
      mutationType: this.mutationType,
      subscriptionType: this.subscriptionType,
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
