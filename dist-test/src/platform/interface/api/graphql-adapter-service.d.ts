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
    readonly locations?: readonly {
        line: number;
        column: number;
    }[];
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
export declare const GRAPHQL_ERROR_CODES: {
    readonly GRAPHQL_PARSE_ERROR: "GRAPHQL_PARSE_ERROR";
    readonly GRAPHQL_VALIDATION_ERROR: "GRAPHQL_VALIDATION_ERROR";
    readonly GRAPHQL_EXECUTION_ERROR: "GRAPHQL_EXECUTION_ERROR";
    readonly UNAUTHENTICATED: "UNAUTHENTICATED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly NOT_FOUND: "NOT_FOUND";
};
/**
 * GraphQL resolver function type
 */
export type GraphQLResolver = (args: Record<string, unknown>, context: GraphQLContext) => Promise<unknown>;
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
export declare class GraphQLAdapterService {
    private readonly config;
    private readonly schemas;
    private readonly subscriptions;
    constructor(config: GraphQLAdapterConfig);
    /**
     * Check if GraphQL adapter is available
     */
    isAvailable(): boolean;
    /**
     * Get adapter configuration
     */
    getConfig(): GraphQLAdapterConfig;
    /**
     * Register a schema with resolvers
     */
    registerSchema(name: string, schema: GraphQLSchemaWithResolvers): void;
    /**
     * Get registered schema names
     */
    getRegisteredSchemas(): readonly string[];
    /**
     * Execute a GraphQL query or mutation
     */
    execute<T = unknown>(schemaName: string, request: GraphQLRequest, context?: Partial<GraphQLContext>): Promise<GraphQLResponse<T>>;
    /**
     * Start a subscription
     */
    subscribe(schemaName: string, query: string, variables: Record<string, unknown>, onEvent: (event: GraphQLSubscriptionEvent) => void): GraphQLOperationResult;
    /**
     * Unsubscribe from a subscription
     */
    unsubscribe(operationId: string): boolean;
    /**
     * Emit an event to a subscription
     */
    emitSubscriptionEvent(operationId: string, event: GraphQLSubscriptionEvent): void;
    /**
     * Validate a GraphQL query against a schema
     */
    validateQuery(schemaName: string, query: string): {
        valid: boolean;
        errors: readonly string[];
    };
    /**
     * Convert REST request to GraphQL variables
     */
    static restToGraphQLVariables(restRequest: Record<string, unknown>): Record<string, unknown>;
    /**
     * Convert GraphQL response to REST format
     */
    static graphqlToRestResponse<T>(graphqlResponse: GraphQLResponse<T>): Record<string, unknown>;
    /**
     * Detect operation type from query string
     */
    private detectOperationType;
    /**
     * Execute an operation against the schema
     */
    private executeOperation;
    private resolveRootType;
    private findField;
    private parseOperation;
    private parseArguments;
    private parseArgumentValue;
}
/**
 * GraphQL schema builder utility
 */
export declare class GraphQLSchemaBuilder {
    private readonly types;
    private queryType?;
    private mutationType?;
    private subscriptionType?;
    addType(type: GraphQLTypeDefinition): this;
    setQueryType(name: string): this;
    setMutationType(name: string): this;
    setSubscriptionType(name: string): this;
    build(): GraphQLSchemaDefinition;
}
/**
 * Health check query for GraphQL endpoint
 */
export declare const HEALTH_CHECK_QUERY = "\n  query Health {\n    __typename\n  }\n";
/**
 * Introspection query prefix
 */
export declare const INTROSPECTION_QUERY_PREFIX = "__schema";
