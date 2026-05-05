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
  /**
   * Optional health check function that verifies the service is ready.
   * Called after init() and before the service instance is returned/cached.
   * Should return true if healthy, false otherwise.
   * Can return a Promise for async health checks.
   * If not provided, service is considered healthy by default.
   */
  healthCheck?: () => boolean | Promise<boolean>;
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
    // R20-31 FIX: Use sequential teardown to respect service dependencies.
    // Previously used Promise.all(parallel) which could cause issues when a service
    // being torn down depends on another service that hasn't been torn down yet.
    // Teardown in reverse topological order (dependents first), like teardownAll().
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
    if (visiting.has(name)) {
      throw new InternalAppError(
        "service_registry.circular_dependency",
        `service_registry.circular_dependency: Circular dependency detected while resolving "${name}"`,
        { source: "internal", details: { serviceName: name } },
      );
    }
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
    if (registration.dependsOn) {
      visiting.add(name);
      try {
        for (const dep of registration.dependsOn) {
          if (!this.services.has(dep)) {
            continue;
          }
          if (visiting.has(dep)) {
            throw new InternalAppError(
              "service_registry.circular_dependency",
              `service_registry.circular_dependency: Circular dependency detected between "${name}" and "${dep}"`,
              { source: "internal", details: { serviceName: name, dependencyName: dep } },
            );
          }
          this.getRecursive(dep, visiting);
        }
      } finally {
        visiting.delete(name);
      }
    }

    // Initialize this service
    this.initializing.add(name);
    let instance: T;
    try {
      instance = registration.init() as T;
    } finally {
      this.initializing.delete(name);
    }

    // R9-23: Cache instance BEFORE health check so that if healthCheck() calls get()
    // on the same service, it finds the cached instance and returns without recursion.
    // The instance is only returned/usable if healthCheck passes.
    this.instances.set(name, instance);

    // Health gate - verify service is ready before returning
    if (registration.healthCheck !== undefined) {
      const healthy = registration.healthCheck();
      if (healthy instanceof Promise) {
        throw new InternalAppError(
          "service_registry.async_health_check",
          `service_registry.async_health_check: Async healthCheck not yet supported for "${name}"`,
          { source: "internal", details: { serviceName: name } },
        );
      }
      if (!healthy) {
        // Remove from cache since health check failed
        this.instances.delete(name);
        throw new InternalAppError(
          "service_registry.unhealthy",
          `service_registry.unhealthy: Service "${name}" failed health check and is not ready`,
          { source: "internal", details: { serviceName: name } },
        );
      }
    }

    return instance;
  }

  /**
   * Checks whether a service is registered.
   */
  public has(name: string): boolean {
    return this.services.has(name);
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
      // P1-2135: Throw instead of warn so cycled services are NOT silently skipped.
      // Skipping teardown of cycled services would leak resources (DB connections,
      // file handles, pending async operations). Throw to force the cycle to be fixed.
      throw new InternalAppError(
        "service_registry.circular_dependency",
        `service_registry.circular_dependency: Circular dependency detected in topological sort`,
        { source: "internal", details: { unsortedServices } },
      );
    }

    return result;
  }
}
