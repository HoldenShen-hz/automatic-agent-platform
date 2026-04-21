/**
 * GraphQL Adapter Service
 *
 * Provides GraphQL adapter for cross-platform support.
 * Implements §52 "跨平台适配层" requirement for GraphQL protocol support.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */
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
};
/**
 * GraphQL adapter for cross-platform communication
 */
export class GraphQLAdapterService {
    config;
    schemas = new Map();
    subscriptions = new Map();
    constructor(config) {
        this.config = {
            introspectionEnabled: true,
            playgroundEnabled: false,
            ...config,
        };
    }
    /**
     * Check if GraphQL adapter is available
     */
    isAvailable() {
        return true;
    }
    /**
     * Get adapter configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Register a schema with resolvers
     */
    registerSchema(name, schema) {
        this.schemas.set(name, schema);
    }
    /**
     * Get registered schema names
     */
    getRegisteredSchemas() {
        return Array.from(this.schemas.keys());
    }
    /**
     * Execute a GraphQL query or mutation
     */
    async execute(schemaName, request, context) {
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
            const result = await this.executeOperation(schema, request, context);
            return {
                success: true,
                data: result,
            };
        }
        catch (error) {
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
    subscribe(schemaName, query, variables, onEvent) {
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
    unsubscribe(operationId) {
        return this.subscriptions.delete(operationId);
    }
    /**
     * Emit an event to a subscription
     */
    emitSubscriptionEvent(operationId, event) {
        const handler = this.subscriptions.get(operationId);
        if (handler) {
            handler(event);
        }
    }
    /**
     * Validate a GraphQL query against a schema
     */
    validateQuery(schemaName, query) {
        const schema = this.schemas.get(schemaName);
        if (!schema) {
            return { valid: false, errors: [`Schema '${schemaName}' not found`] };
        }
        // Simplified validation - real implementation would use graphql-js
        const errors = [];
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
            }
            catch (error) {
                errors.push(error instanceof Error ? error.message : "Failed to parse GraphQL query");
            }
        }
        return { valid: errors.length === 0, errors };
    }
    /**
     * Convert REST request to GraphQL variables
     */
    static restToGraphQLVariables(restRequest) {
        return {
            input: restRequest,
            restArgs: restRequest,
        };
    }
    /**
     * Convert GraphQL response to REST format
     */
    static graphqlToRestResponse(graphqlResponse) {
        return {
            success: graphqlResponse.success,
            data: graphqlResponse.data,
            errors: graphqlResponse.errors?.map((e) => e.message),
        };
    }
    /**
     * Detect operation type from query string
     */
    detectOperationType(query) {
        const normalized = query.toLowerCase().replace(/\s+/g, " ");
        if (normalized.includes("subscription"))
            return "subscription";
        if (normalized.includes("mutation"))
            return "mutation";
        return "query";
    }
    /**
     * Execute an operation against the schema
     */
    async executeOperation(schema, request, context) {
        const ctx = {
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
            .find((candidate) => candidate !== undefined);
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
        };
    }
    resolveRootType(schema, operationType) {
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
    findField(schema, typeName, fieldName) {
        const type = schema.types.find((item) => item.name === typeName);
        return type?.fields.find((field) => field.name === fieldName) ?? null;
    }
    parseOperation(query, variables) {
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
    parseArguments(argList, variables) {
        const args = {};
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
    parseArgumentValue(rawValue, variables) {
        if (rawValue.startsWith("$")) {
            return variables?.[rawValue.slice(1)];
        }
        if ((rawValue.startsWith("\"") && rawValue.endsWith("\"")) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
            return rawValue.slice(1, -1);
        }
        if (rawValue === "true")
            return true;
        if (rawValue === "false")
            return false;
        if (rawValue === "null")
            return null;
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
    types = [];
    queryType;
    mutationType;
    subscriptionType;
    addType(type) {
        this.types.push(type);
        return this;
    }
    setQueryType(name) {
        this.queryType = name;
        return this;
    }
    setMutationType(name) {
        this.mutationType = name;
        return this;
    }
    setSubscriptionType(name) {
        this.subscriptionType = name;
        return this;
    }
    build() {
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
//# sourceMappingURL=graphql-adapter-service.js.map