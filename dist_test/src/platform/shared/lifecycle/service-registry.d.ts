/**
 * @fileoverview Service Registry - Centralized lifecycle management for module-level singletons.
 *
 * Provides a unified registry for all module-level singleton services in the system.
 * Each service can be registered with optional init() and teardown() functions.
 *
 * ## Motivation
 *
 * Previously, 10+ modules used independent `let xxxInstance = null` patterns with
 * no unified teardown mechanism. This caused state leakage between tests and made
 * graceful shutdown difficult.
 *
 * ## Usage
 *
 * ```typescript
 * // Register a service
 * const registry = ServiceRegistry.getInstance();
 * registry.register('model-call-provider', {
 *   init: () => new ModelCallProviderService(),
 *   teardown: (instance) => instance.dispose?.(),
 * });
 *
 * // Get the service
 * const service = registry.get<ModelCallProviderService>('model-call-provider');
 * ```
 *
 * ## Singleton清单
 *
 * | ID | 模块 | 变量 |
 * |----|------|------|
 * | division-loader | divisions/division-loader.ts | defaultRegistryCache |
 * | tool-registry | runtime/dispatcher/index.ts | _toolRegistry |
 * | middleware-context | runtime/middleware-init.ts | middlewareContext |
 * | agent-executor-context | runtime/agent-executor.ts | executorContext |
 * | network-egress-audit | security/network-egress-audit.ts | globalAuditService |
 * | network-egress-policy | security/network-egress-policy.ts | globalPolicyService |
 * | output-continuation | runtime/output-continuation-service.ts | globalContinuationService |
 * | model-call-provider | runtime/model-call-provider.ts | modelCallProviderInstance |
 * | graceful-shutdown | runtime/graceful-shutdown.ts | globalShutdownInstance |
 * | process-tracker | resource/process-tracker.ts | trackerInstance |
 */
type ServiceInitFn<T> = () => T;
type ServiceTeardownFn<T> = (instance: T) => void | Promise<void>;
interface ServiceRegistration<T> {
    init: ServiceInitFn<T>;
    teardown?: ServiceTeardownFn<T>;
    /** List of service IDs that this service depends on */
    dependsOn?: string[];
}
/**
 * Centralized registry for managing singleton service lifecycles.
 *
 * Provides:
 * - Lazy initialization of services
 * - Unified teardown for graceful shutdown
 * - Test isolation via reset()
 */
export declare class ServiceRegistry {
    private static _instance;
    private readonly services;
    private readonly instances;
    private constructor();
    /**
     * Gets the singleton registry instance.
     */
    static getInstance(): ServiceRegistry;
    /**
     * Resets the registry (primarily for testing).
     * Calls teardown on all registered services, clears instances and service registrations,
     * then resets the singleton so the next getInstance() returns a fresh registry.
     */
    reset(): Promise<void>;
    /**
     * Registers a service with the registry.
     * @param name - Unique identifier for the service
     * @param registration - Object with init and optional teardown functions
     */
    register<T>(name: string, registration: ServiceRegistration<T>): void;
    /**
     * Gets a service instance, initializing it lazily if needed.
     * Initializes transitive dependencies first (via getRecursive), then the service itself.
     * @param name - The service identifier
     * @returns The service instance
     * @throws Error if the service is not registered
     */
    get<T>(name: string): T;
    /**
     * Recursive helper that initializes a service and all its transitive dependencies.
     * Uses a visiting set to detect and prevent infinite loops on circular dependencies.
     */
    private getRecursive;
    /**
     * Checks whether a service instance has been initialized.
     */
    isInitialized(name: string): boolean;
    /**
     * Initializes all registered services eagerly.
     */
    initializeAll(): Promise<void>;
    /**
     * Tears down all registered services.
     */
    teardownAll(): Promise<void>;
    /**
     * Performs topological sort of registered services based on dependencies.
     * Services with no dependencies come first, followed by dependent services.
     * Uses Kahn's algorithm for topological sorting.
     *
     * @returns Array of service IDs in topological order (dependencies first)
     */
    topologicalSort(): string[];
}
export {};
