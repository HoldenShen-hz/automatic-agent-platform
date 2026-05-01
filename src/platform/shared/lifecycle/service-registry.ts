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
 * ## Singleton List
 *
 * | ID | Module | Variable |
 * |----|--------|----------|
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

import { StructuredLogger } from "../observability/structured-logger.js";
import { InternalAppError } from "../../contracts/errors.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

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
export class ServiceRegistry {
  private static _instance: ServiceRegistry | null = null;
  private static readonly bootstrapRegistrars = new Map<string, (registry: ServiceRegistry) => void>();
  private static readonly liveRegistries = new Set<ServiceRegistry>();
  private readonly services = new Map<string, ServiceRegistration<unknown>>();
  private readonly instances = new Map<string, unknown>();
  private readonly initializing = new Set<string>();

  public constructor() {
    ServiceRegistry.liveRegistries.add(this);
    for (const registrar of ServiceRegistry.bootstrapRegistrars.values()) {
      registrar(this);
    }
  }

  /**
   * Gets the singleton registry instance.
   */
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry._instance) {
      ServiceRegistry._instance = new ServiceRegistry();
    }
    return ServiceRegistry._instance;
  }

  /**
   * Creates a new scoped registry instance for multi-tenant/multi-worker isolation.
   * Unlike getInstance(), this always returns a fresh registry that is NOT the global singleton.
   * Use this for isolated contexts (tests, per-tenant workers, etc.).
   */
  public static createScoped(): ServiceRegistry {
    return new ServiceRegistry();
  }

  /**
   * Registers bootstrap wiring that should be replayed for every fresh registry instance.
   */
  public static registerBootstrap(name: string, registrar: (registry: ServiceRegistry) => void): void {
    ServiceRegistry.bootstrapRegistrars.set(name, registrar);
    if (ServiceRegistry.liveRegistries.size === 0) {
      ServiceRegistry.getInstance();
      return;
    }
    for (const registry of ServiceRegistry.liveRegistries) {
      registrar(registry);
    }
  }

  /**
   * Resets the registry (primarily for testing).
   * Calls teardown on all registered services, clears instances and service registrations,
   * then resets the singleton so the next getInstance() returns a fresh registry.
   */
  public async reset(): Promise<void> {
    // Teardown services first (they may need access to other services during teardown)
    const teardownEntries = [...this.instances].map(([name, instance]) => ({
      name,
      instance,
      registration: this.services.get(name),
    }));

    const pending: Promise<void>[] = [];
    for (const { name, instance, registration } of teardownEntries) {
      if (registration?.teardown) {
        try {
          const result = registration.teardown(instance);
          if (result instanceof Promise) {
            pending.push(result.catch((err: unknown) => {
              logger.log({ level: "warn", message: `ServiceRegistry: teardown failed for ${name}`, data: { serviceName: name, error: err instanceof Error ? err.message : String(err) } });
            }));
          }
        } catch (err) {
          logger.log({ level: "warn", message: `ServiceRegistry: teardown failed for ${name}`, data: { serviceName: name, error: err instanceof Error ? err.message : String(err) } });
        }
      }
    }
    await Promise.all(pending);

    // Only clear after teardown completes
    this.instances.clear();
    this.services.clear();
    this.initializing.clear();
    ServiceRegistry.liveRegistries.delete(this);
    ServiceRegistry._instance = null;
  }

  /**
   * Registers a service with the registry.
   * @param name - Unique identifier for the service
   * @param registration - Object with init and optional teardown functions
   */
  public register<T>(name: string, registration: ServiceRegistration<T>): void {
    this.services.set(name, registration as ServiceRegistration<unknown>);
  }

  /**
   * Gets a service instance, initializing it lazily if needed.
   * Initializes transitive dependencies first (via getRecursive), then the service itself.
   * @param name - The service identifier
   * @returns The service instance
   * @throws Error if the service is not registered
   */
  public get<T>(name: string): T {
    return this.getRecursive<T>(name, new Set<string>());
  }

  /**
   * Recursive helper that initializes a service and all its transitive dependencies.
   * Uses a visiting set to detect and prevent infinite loops on circular dependencies.
   */
  private getRecursive<T>(name: string, visiting: Set<string>): T {
    // Already initialized - return cached
    const cached = this.instances.get(name) as T | undefined;
    if (cached !== undefined) return cached;
    if (this.initializing.has(name)) {
      throw new InternalAppError(
        "service_registry.circular_dependency",
        `service_registry.circular_dependency: ServiceRegistry is already initializing "${name}"`,
        { source: "internal", details: { serviceName: name } },
      );
    }

    // Not registered
    const registration = this.services.get(name);
    if (!registration) {
      throw new InternalAppError(
        "service_registry.not_registered",
        `service_registry.not_registered: ServiceRegistry: no service registered with name "${name}"`,
        { source: "internal", details: { serviceName: name } },
      );
    }

    // Initialize transitive dependencies first (depth-first)
    if (registration.dependsOn && !visiting.has(name)) {
      visiting.add(name);
      try {
        for (const dep of registration.dependsOn) {
          if (this.services.has(dep) && !visiting.has(dep)) {
            this.getRecursive(dep, visiting);
          }
        }
      } finally {
        visiting.delete(name);
      }
    }

    // Initialize this service and cache
    this.initializing.add(name);
    try {
      const instance = registration.init() as T;
      this.instances.set(name, instance);
      return instance;
    } finally {
      this.initializing.delete(name);
    }
  }

  /**
   * Checks whether a service instance has been initialized.
   */
  public isInitialized(name: string): boolean {
    return this.instances.has(name);
  }

  /**
   * Initializes all registered services eagerly.
   */
  public async initializeAll(): Promise<void> {
    for (const name of this.services.keys()) {
      this.get(name);
    }
  }

  /**
   * Tears down all registered services.
   */
  public async teardownAll(): Promise<void> {
    // Get services in reverse topological order (dependents first)
    const sorted = this.topologicalSort();
    const reversed = [...sorted].reverse();

    for (const name of reversed) {
      const instance = this.instances.get(name);
      if (instance !== undefined) {
        const registration = this.services.get(name);
        if (registration?.teardown) {
          try {
            const result = registration.teardown(instance);
            if (result instanceof Promise) {
              await result.catch((err: unknown) => {
                logger.log({ level: "warn", message: `ServiceRegistry: teardown failed for ${name}`, data: { serviceName: name, error: err instanceof Error ? err.message : String(err) } });
              });
            }
          } catch (err) {
            logger.log({ level: "warn", message: `ServiceRegistry: teardown failed for ${name}`, data: { serviceName: name, error: err instanceof Error ? err.message : String(err) } });
          }
        }
      }
    }
    this.instances.clear();
  }

  /**
   * Performs topological sort of registered services based on dependencies.
   * Services with no dependencies come first, followed by dependent services.
   * Uses Kahn's algorithm for topological sorting.
   *
   * @returns Array of service IDs in topological order (dependencies first)
   */
  public topologicalSort(): string[] {
    const serviceNames = Array.from(this.services.keys());
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const name of serviceNames) {
      inDegree.set(name, 0);
      adjacency.set(name, []);
    }

    // Build graph and calculate in-degrees
    for (const [name, registration] of this.services) {
      const deps = registration.dependsOn ?? [];
      for (const dep of deps) {
        if (this.services.has(dep)) {
          // dep → name (name depends on dep)
          adjacency.get(dep)!.push(name);
          inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: string[] = [];

    // Start with nodes that have no dependencies
    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check for cycles - if not all services are in result, there's a cycle
    if (result.length !== serviceNames.length) {
      const unsortedServices = serviceNames.filter(n => !result.includes(n));
      throw new InternalAppError(
        "service_registry.circular_dependency",
        `service_registry.circular_dependency: Circular dependency detected in topological sort`,
        { source: "internal", details: { unsortedServices } },
      );
    }

    return result;
  }
}
