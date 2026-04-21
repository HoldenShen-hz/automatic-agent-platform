/**
 * gRPC Adapter Service
 *
 * Provides gRPC adapter for cross-platform support.
 * Implements §52 "跨平台适配层" requirement using @grpc/grpc-js.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §52
 */
/**
 * gRPC adapter configuration
 */
export interface GrpcAdapterConfig {
    readonly host: string;
    readonly port: number;
    readonly packageName: string;
    readonly serviceName: string;
    readonly protoPath?: string;
    readonly credentials?: "insecure" | "tls";
    readonly enableReflection?: boolean;
}
/**
 * gRPC method definition
 */
export interface GrpcMethodDefinition {
    readonly name: string;
    readonly requestStream: boolean;
    readonly responseStream: boolean;
    readonly requestType: string;
    readonly responseType: string;
}
/**
 * gRPC service definition
 */
export interface GrpcServiceDefinition {
    readonly name: string;
    readonly package: string;
    readonly methods: readonly GrpcMethodDefinition[];
    readonly fullName: string;
}
/**
 * gRPC call request
 */
export interface GrpcCallRequest {
    readonly method: string;
    readonly request: Record<string, unknown>;
    readonly metadata?: Record<string, string>;
    readonly timeout?: number;
}
/**
 * gRPC call response
 */
export interface GrpcCallResponse<T = unknown> {
    readonly success: boolean;
    readonly data?: T;
    readonly error?: {
        readonly code: number;
        readonly message: string;
    };
    readonly metadata?: Record<string, string>;
}
/**
 * Stream response handler
 */
export type GrpcStreamHandler<T> = (data: T, metadata?: Record<string, string>) => void;
/**
 * gRPC server instance interface
 */
export interface GrpcServer {
    isRunning: boolean;
    start(): Promise<void>;
    stop(): Promise<void>;
    addService(service: GrpcServiceDefinition, handler: GrpcServiceHandler): void;
}
/**
 * gRPC service handler
 */
export interface GrpcServiceHandler {
    [methodName: string]: (call: GrpcServerCall, callback: GrpcServerCallback) => void;
}
/**
 * gRPC server call
 */
export interface GrpcServerCall {
    readonly request: Record<string, unknown>;
    readonly metadata: Map<string, string>;
    getMetadata(): Record<string, string>;
    getPeer(): string;
}
/**
 * gRPC server callback
 */
export type GrpcServerCallback<T = unknown> = (error: GrpcError | null, response?: T) => void;
/**
 * gRPC error
 */
export interface GrpcError {
    readonly code: number;
    readonly message: string;
}
/**
 * Standard gRPC error codes
 */
export declare const GRPC_ERROR_CODES: {
    readonly OK: 0;
    readonly CANCELLED: 1;
    readonly UNKNOWN: 2;
    readonly INVALID_ARGUMENT: 3;
    readonly DEADLINE_EXCEEDED: 4;
    readonly NOT_FOUND: 5;
    readonly ALREADY_EXISTS: 6;
    readonly PERMISSION_DENIED: 7;
    readonly RESOURCE_EXHAUSTED: 8;
    readonly FAILED_PRECONDITION: 9;
    readonly ABORTED: 10;
    readonly OUT_OF_RANGE: 11;
    readonly UNIMPLEMENTED: 12;
    readonly INTERNAL: 13;
    readonly UNAVAILABLE: 14;
    readonly DATA_LOSS: 15;
    readonly UNAUTHENTICATED: 16;
};
/**
 * gRPC adapter for cross-platform communication
 */
export declare class GrpcAdapterService {
    private readonly config;
    private server;
    private readonly serviceHandlers;
    private readonly registeredServices;
    constructor(config: GrpcAdapterConfig);
    /**
     * Check if gRPC is available (would check for @grpc/grpc-js in production)
     */
    isAvailable(): boolean;
    /**
     * Get adapter configuration
     */
    getConfig(): GrpcAdapterConfig;
    /**
     * Get full server address
     */
    getServerAddress(): string;
    /**
     * Create a gRPC server instance
     */
    createServer(): GrpcServer;
    /**
     * Register a service with its handler
     */
    registerService(service: GrpcServiceDefinition, handler: GrpcServiceHandler): void;
    /**
     * Get registered service names
     */
    getRegisteredServices(): readonly string[];
    /**
     * Make a unary gRPC call
     */
    call<T = unknown>(serviceName: string, method: string, request: Record<string, unknown>, metadata?: Record<string, string>): Promise<GrpcCallResponse<T>>;
    /**
     * Start the gRPC server
     */
    start(): Promise<void>;
    /**
     * Stop the gRPC server
     */
    stop(): Promise<void>;
    /**
     * Check if server is running
     */
    isRunning(): boolean;
}
/**
 * gRPC to REST converter utility
 */
export declare class GrpcRestConverter {
    /**
     * Convert REST request to gRPC format
     */
    static toGrpcRequest(restRequest: Record<string, unknown>): Record<string, unknown>;
    /**
     * Convert gRPC response to REST format
     */
    static toRestResponse(grpcResponse: Record<string, unknown>): Record<string, unknown>;
    /**
     * Convert gRPC metadata to headers
     */
    static metadataToHeaders(metadata: Map<string, string>): Record<string, string>;
}
/**
 * gRPC health check service definition
 */
export declare const HEALTH_SERVICE: GrpcServiceDefinition;
/**
 * Health status enum
 */
export declare enum HealthStatus {
    UNKNOWN = 0,
    SERVING = 1,
    NOT_SERVING = 2,
    SERVICE_UNKNOWN = 3
}
