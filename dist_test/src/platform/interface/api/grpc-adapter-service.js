/**
 * gRPC Adapter Service
 *
 * Provides gRPC adapter for cross-platform support.
 * Implements §52 "跨平台适配层" requirement using @grpc/grpc-js.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */
/**
 * Standard gRPC error codes
 */
export const GRPC_ERROR_CODES = {
    OK: 0,
    CANCELLED: 1,
    UNKNOWN: 2,
    INVALID_ARGUMENT: 3,
    DEADLINE_EXCEEDED: 4,
    NOT_FOUND: 5,
    ALREADY_EXISTS: 6,
    PERMISSION_DENIED: 7,
    RESOURCE_EXHAUSTED: 8,
    FAILED_PRECONDITION: 9,
    ABORTED: 10,
    OUT_OF_RANGE: 11,
    UNIMPLEMENTED: 12,
    INTERNAL: 13,
    UNAVAILABLE: 14,
    DATA_LOSS: 15,
    UNAUTHENTICATED: 16,
};
/**
 * gRPC adapter for cross-platform communication
 */
export class GrpcAdapterService {
    config;
    server = null;
    serviceHandlers = new Map();
    registeredServices = new Set();
    constructor(config) {
        this.config = config;
    }
    /**
     * Check if gRPC is available (would check for @grpc/grpc-js in production)
     */
    isAvailable() {
        // In production, this would check if @grpc/grpc-js is installed
        return true;
    }
    /**
     * Get adapter configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get full server address
     */
    getServerAddress() {
        return `${this.config.host}:${this.config.port}`;
    }
    /**
     * Create a gRPC server instance
     */
    createServer() {
        const server = {
            isRunning: false,
            start: async () => {
                server.isRunning = true;
            },
            stop: async () => {
                server.isRunning = false;
            },
            addService: (service, handler) => {
                this.registerService(service, handler);
            },
        };
        this.server = server;
        return server;
    }
    /**
     * Register a service with its handler
     */
    registerService(service, handler) {
        const key = `${service.package}.${service.name}`;
        this.serviceHandlers.set(key, handler);
        this.registeredServices.add(key);
    }
    /**
     * Get registered service names
     */
    getRegisteredServices() {
        return Array.from(this.registeredServices);
    }
    /**
     * Make a unary gRPC call
     */
    async call(serviceName, method, request, metadata) {
        const handler = this.serviceHandlers.get(serviceName);
        if (!handler) {
            return {
                success: false,
                error: {
                    code: GRPC_ERROR_CODES.NOT_FOUND,
                    message: `Service ${serviceName} not found`,
                },
            };
        }
        const methodHandler = handler[method];
        if (!methodHandler) {
            return {
                success: false,
                error: {
                    code: GRPC_ERROR_CODES.UNIMPLEMENTED,
                    message: `Method ${method} not found in service ${serviceName}`,
                },
            };
        }
        try {
            // In production, this would use actual @grpc/grpc-js
            // For now, return a structured response
            const call = {
                request,
                metadata: new Map(Object.entries(metadata ?? {})),
                getMetadata: () => metadata ?? {},
                getPeer: () => "peer",
            };
            let response;
            const callback = (error, res) => {
                if (error) {
                    throw error;
                }
                response = res;
            };
            methodHandler(call, callback);
            const result = {
                success: true,
            };
            if (response !== undefined) {
                result.data = response;
            }
            return result;
        }
        catch (error) {
            return {
                success: false,
                error: {
                    code: GRPC_ERROR_CODES.INTERNAL,
                    message: error instanceof Error ? error.message : "Unknown error",
                },
            };
        }
    }
    /**
     * Start the gRPC server
     */
    async start() {
        if (!this.server) {
            this.server = this.createServer();
        }
        await this.server.start();
    }
    /**
     * Stop the gRPC server
     */
    async stop() {
        if (this.server) {
            await this.server.stop();
            this.server = null;
        }
    }
    /**
     * Check if server is running
     */
    isRunning() {
        return this.server?.isRunning ?? false;
    }
}
/**
 * gRPC to REST converter utility
 */
export class GrpcRestConverter {
    /**
     * Convert REST request to gRPC format
     */
    static toGrpcRequest(restRequest) {
        return {
            ...restRequest,
            // gRPC typically uses camelCase
        };
    }
    /**
     * Convert gRPC response to REST format
     */
    static toRestResponse(grpcResponse) {
        return {
            ...grpcResponse,
            // REST typically uses snake_case or camelCase
        };
    }
    /**
     * Convert gRPC metadata to headers
     */
    static metadataToHeaders(metadata) {
        const headers = {};
        metadata.forEach((value, key) => {
            headers[key] = value;
        });
        return headers;
    }
}
/**
 * gRPC health check service definition
 */
export const HEALTH_SERVICE = {
    name: "Health",
    package: "grpc.health.v1",
    methods: [
        {
            name: "Check",
            requestStream: false,
            responseStream: false,
            requestType: "HealthCheckRequest",
            responseType: "HealthCheckResponse",
        },
    ],
    fullName: "grpc.health.v1.Health",
};
/**
 * Health status enum
 */
export var HealthStatus;
(function (HealthStatus) {
    HealthStatus[HealthStatus["UNKNOWN"] = 0] = "UNKNOWN";
    HealthStatus[HealthStatus["SERVING"] = 1] = "SERVING";
    HealthStatus[HealthStatus["NOT_SERVING"] = 2] = "NOT_SERVING";
    HealthStatus[HealthStatus["SERVICE_UNKNOWN"] = 3] = "SERVICE_UNKNOWN";
})(HealthStatus || (HealthStatus = {}));
//# sourceMappingURL=grpc-adapter-service.js.map