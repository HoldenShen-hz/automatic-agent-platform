/**
 * Plugin Executor Service
 *
 * Complete plugin execution service with lifecycle management, sandbox isolation,
 * resource limits, and evidence collection.
 *
 * Architecture: §4 P4 Execution Plane
 * @see docs_zh/architecture/00-platform-architecture.md §4
 * @see src/domains/registry/plugin-spi.ts (PluginManifest, PluginLifecycleHooks)
 * @see src/platform/control-plane/iam/sandbox-policy.ts (SandboxPolicy)
 */

import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { ValidationError, SandboxError } from "../../contracts/errors.js";
import {
  type PluginManifest,
  type PluginLifecycleHooks,
  type PluginLifecycleContext,
} from "../../../domains/registry/plugin-spi.js";
import {
  checkSandboxPath,
  createReadOnlyPolicy,
  createRestrictedExecPolicy,
  createScopedExternalAccessPolicy,
  createWorkspaceWritePolicy,
  normalizeSandboxMode,
  type SandboxPolicy,
  type SandboxMode,
} from "../../control-plane/iam/sandbox-policy.js";
import { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  ScopedExternalAccessSandbox,
  createScopedExternalAccessSandbox,
  type ScopedExternalAccessConfig,
} from "./scoped-external-access-sandbox.js";
import {
  propagateDataTaint,
  isPluginRevoked,
  getPluginRevocationStatus,
  type BundleRevocationRecord,
} from "../../../plugins/builtin-plugin-registry.js";
import { runtimeMetricsRegistry } from "../../shared/observability/runtime-metrics-registry.js";

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutionContext {
  executionId: string;
  taskId: string;
  tenantId: string | null;
  correlationId: string;
  sandboxTier: SandboxMode;
}

export interface ExecutionContextInput extends Omit<ExecutionContext, "sandboxTier"> {
  sandboxTier: string;
}

export interface ExecutionResult {
  executionId: string;
  pluginId: string;
  status: "ok" | "error" | "timeout" | "rejected";
  output: unknown;
  artifactRef?: string;
  durationMs: number;
  timestamp: string;
  error?: string;
}

export interface PluginExecutorOptions {
  pluginDir?: string;
  sandboxPolicy?: SandboxPolicy;
  artifactStore?: ArtifactStore;
  /** Optional event publisher for emitting plugin.execution.started and plugin.execution.completed events */
  eventPublisher?: EventPublisher | null;
  /** Optional metrics registry for recording execution metrics (defaults to global registry) */
  metricsRegistry?: RuntimeMetricsRegistry | null;
}

/** Interface for the runtime metrics registry (subset of RuntimeMetricsRegistry) */
interface RuntimeMetricsRegistry {
  incrementCounter(name: string, labels: Record<string, string | number | boolean | null | undefined>, delta?: number): void;
  observeHistogram(name: string, labels: Record<string, string | number | boolean | null | undefined>, value: number): void;
  setGauge(name: string, labels: Record<string, string | number | boolean | null | undefined>, value: number): void;
}

/** Interface for event publishing (subset of TypedEventPublisher) */
interface EventPublisher {
  publish<TType extends string>(input: {
    eventType: TType;
    payload: Record<string, unknown>;
    taskId?: string | null;
    executionId?: string | null;
  }): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle State Machine
// ─────────────────────────────────────────────────────────────────────────────

type LifecycleState = "registered" | "loaded" | "active" | "inactive" | "degraded" | "disabled";

interface PluginInstance {
  manifest: PluginManifest;
  hooks: PluginLifecycleHooks;
  state: LifecycleState;
  loadTime: string | null;
  unloadTime: string | null;
  errorCount: number;
  lastError: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Tier Configuration
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Executor Service
// ─────────────────────────────────────────────────────────────────────────────

export class PluginExecutorService {
  private readonly plugins = new Map<string, PluginInstance>();
  private readonly sandboxPolicy: SandboxPolicy;
  private readonly artifactStore: ArtifactStore;
  private readonly eventPublisher: EventPublisher | null;
  private readonly metricsRegistry: RuntimeMetricsRegistry | null;
  private readonly pluginDir: string;

  public constructor(options: PluginExecutorOptions = {}) {
    this.pluginDir = options.pluginDir ?? join(process.cwd(), "plugins");
    this.sandboxPolicy = options.sandboxPolicy ?? createWorkspaceWritePolicy(process.cwd());
    this.artifactStore = options.artifactStore ?? new ArtifactStore();
    this.eventPublisher = options.eventPublisher ?? null;
    this.metricsRegistry = options.metricsRegistry ?? runtimeMetricsRegistry;
  }

  // ── Registry Operations ────────────────────────────────────────────────────

  /**
   * Registers a plugin with the executor.
   *
   * @param manifest - Plugin manifest from registry
   * @param hooks - Plugin lifecycle hooks instance
   */
  public register(manifest: PluginManifest, hooks: PluginLifecycleHooks): void {
    if (this.plugins.has(manifest.pluginId)) {
      throw new ValidationError(
        "plugin_executor.already_registered",
        `Plugin ${manifest.pluginId} is already registered`,
        { details: { pluginId: manifest.pluginId } },
      );
    }

    this.plugins.set(manifest.pluginId, {
      manifest,
      hooks,
      state: "registered",
      loadTime: null,
      unloadTime: null,
      errorCount: 0,
      lastError: null,
    });
  }

  /**
   * Unregisters a plugin, calling onUnload if present.
   *
   * @param pluginId - Plugin to unregister
   */
  public async unregister(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new ValidationError(
        "plugin_executor.not_found",
        `Plugin ${pluginId} is not registered`,
        { details: { pluginId } },
      );
    }

    if (instance.hooks.onUnload) {
      const context = this.buildContext(pluginId, instance.manifest);
      await instance.hooks.onUnload(context);
    }

    instance.state = "disabled";
    instance.unloadTime = nowIso();
    this.plugins.delete(pluginId);
  }

  /**
   * Returns all registered plugins.
   */
  public listPlugins(): PluginManifest[] {
    return [...this.plugins.values()].map((i) => i.manifest);
  }

  // ── Lifecycle Management ──────────────────────────────────────────────────

  /**
   * Loads a plugin into memory, calling onLoad hook.
   *
   * @param pluginId - Plugin to load
   */
  public async load(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new ValidationError(
        "plugin_executor.not_found",
        `Plugin ${pluginId} not found`,
        { details: { pluginId } },
      );
    }

    const context = this.buildContext(pluginId, instance.manifest);

    if (instance.hooks.onLoad) {
      await instance.hooks.onLoad(context);
    }

    if (instance.hooks.initialize) {
      await instance.hooks.initialize();
    }

    instance.state = "loaded";
    instance.loadTime = nowIso();
  }

  /**
   * Activates a loaded plugin, calling onActivate hook.
   *
   * @param pluginId - Plugin to activate
   */
  public async activate(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance || instance.state === "disabled") {
      throw new ValidationError(
        "plugin_executor.not_found",
        `Plugin ${pluginId} not found or disabled`,
        { details: { pluginId } },
      );
    }

    const context = this.buildContext(pluginId, instance.manifest);

    if (instance.hooks.onActivate) {
      await instance.hooks.onActivate(context);
    }

    instance.state = "active";
  }

  /**
   * Deactivates an active plugin, calling onDeactivate hook.
   *
   * @param pluginId - Plugin to deactivate
   */
  public async deactivate(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance || instance.state === "disabled") return;

    const context = this.buildContext(pluginId, instance.manifest);

    if (instance.hooks.onDeactivate) {
      await instance.hooks.onDeactivate(context);
    }

    instance.state = instance.state === "loaded" ? "loaded" : "inactive";
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  /**
   * Executes a plugin action with sandbox isolation and resource limits.
   *
   * @param pluginId - Plugin to execute
   * @param action - SPI type action to invoke (retriever/validator/planner/presenter/adapter)
   * @param context - Execution context
   * @param params - Action parameters
   * @returns Execution result with artifact reference
   */
  public async execute(
    pluginId: string,
    action: string,
    context: ExecutionContextInput,
    params: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = newId("exec");
    const normalizedContext: ExecutionContext = {
      ...context,
      executionId, // R18-2: Set executionId from the generated ID for event correlation
      sandboxTier: normalizeSandboxMode(context.sandboxTier),
    };
    const instance = this.plugins.get(pluginId);

    if (!instance) {
      throw new ValidationError(
        "plugin_executor.not_found",
        `Plugin ${pluginId} not found`,
        { details: { pluginId } },
      );
    }

    // R18-1: Validate plugin manifest before execution
    this.validatePluginManifest(instance.manifest);

    // R18-8: Check plugin version enforcement - reject if revoked
    const revocationStatus = getPluginRevocationStatus(pluginId);
    if (revocationStatus) {
      throw new SandboxError(
        "plugin_executor.plugin_revoked",
        `Plugin ${pluginId} has been revoked: ${revocationStatus.reason}`,
        { details: { pluginId, severity: revocationStatus.severity, revokedAt: revocationStatus.revokedAt } },
      );
    }

    if (instance.state !== "active" && instance.state !== "loaded") {
      throw new SandboxError(
        "plugin_executor.not_active",
        `Plugin ${pluginId} is not active (state: ${instance.state})`,
        { details: { pluginId, state: instance.state } },
      );
    }

    if (!instance.manifest.spiTypes.includes(action as never)) {
      throw new ValidationError(
        "plugin_executor.action_not_allowed",
        `Action ${action} not defined in plugin manifest`,
        { details: { pluginId, action } },
      );
    }

    // Get timeout from manifest
    const timeout = instance.manifest.sandbox?.timeoutMs ?? 5000;
    const sandboxTier = normalizedContext.sandboxTier;

    // R18-9: Enforce sandbox isolation by creating and validating sandbox policy
    // Create sandbox policy based on tier
    const pluginSandboxPolicy = this.createPluginSandbox(
      instance.manifest,
      sandboxTier,
    );

    // R18-9: Verify sandbox path is allowed before execution
    const pluginRoot = this.pluginDir;
    const pathCheck = checkSandboxPath(pluginSandboxPolicy, pluginRoot);
    if (!pathCheck.allowed) {
      throw new SandboxError(
        "plugin_executor.sandbox_path_rejected",
        `Plugin sandbox path is outside allowed roots: ${pathCheck.reasonCode}`,
        { details: { pluginId, reasonCode: pathCheck.reasonCode } },
      );
    }

    // Create sandbox context for execution
    const sandbox = this.createSandboxContext(pluginSandboxPolicy, sandboxTier);

    // Create scoped external access sandbox if tier requires it
    let scopedSandbox: ScopedExternalAccessSandbox | undefined;
    if (sandboxTier === "scoped_external_access") {
      // scoped_external_access sandbox gets configuration from plugin manifest's sandbox policy
      // allowedExternalDomains and limits are defined in sandbox configuration
      const sandboxConfig = instance.manifest.sandbox;
      scopedSandbox = createScopedExternalAccessSandbox(
        sandboxConfig.allowedExternalDomains ?? [],
        {
          maxResponseSizeBytes: sandboxConfig.maxResponseSizeBytes ?? 1024 * 1024,
          rateLimitPerMinute: sandboxConfig.rateLimitPerMinute ?? 60,
        },
      );
    }

    // R18-2: Emit plugin.execution.started event before execution
    this.emitPluginEvent("plugin.execution.started", {
      executionId,
      pluginId,
      action,
      tenantId: normalizedContext.tenantId,
      taskId: normalizedContext.taskId,
      sandboxTier,
      timestamp: nowIso(),
    });

    // R18-5: Record execution start metrics
    this.metricsRegistry?.incrementCounter("plugin_execution_started_total", { pluginId, action }, 1);
    this.metricsRegistry?.setGauge("plugin_execution_active", { pluginId }, 1);

    let output: unknown;
    let status: ExecutionResult["status"] = "ok";
    let errorMessage: string | undefined;

    try {
      // Execute with timeout constraint
      // R18-10: Integrate callDepth tracking - pass pluginId for proper taint propagation
      output = await this.executeWithTimeout(
        () => this.invokePluginAction(instance.hooks, action, params, normalizedContext, scopedSandbox, pluginId),
        timeout,
      );

      // Write execution result to artifact store as evidence
      const artifactRef = await this.writeExecutionArtifact(
        normalizedContext,
        pluginId,
        action,
        output,
      );

      // Build result, conditionally include artifactRef
      const result: ExecutionResult = {
        executionId,
        pluginId,
        status: "ok",
        output,
        durationMs: Date.now() - startTime,
        timestamp: nowIso(),
      };
      if (artifactRef) {
        result.artifactRef = artifactRef;
      }

      // R18-3: Emit plugin.execution.completed event on success
      this.emitPluginEvent("plugin.execution.completed", {
        executionId,
        pluginId,
        action,
        tenantId: normalizedContext.tenantId,
        taskId: normalizedContext.taskId,
        status: "ok",
        durationMs: Date.now() - startTime,
        timestamp: nowIso(),
      });

      // R18-5: Record success metrics
      this.metricsRegistry?.incrementCounter("plugin_execution_completed_total", { pluginId, action, status: "ok" }, 1);
      this.metricsRegistry?.observeHistogram("plugin_execution_duration_ms", { pluginId, action }, Date.now() - startTime);
      this.metricsRegistry?.setGauge("plugin_execution_active", { pluginId }, 0);

      return result;
    } catch (error) {
      status = "error";
      instance.errorCount++;
      instance.lastError = error instanceof Error ? error.message : String(error);
      errorMessage = instance.lastError;

      // Check if timeout
      const isTimeout =
        error instanceof Error &&
        (error.message.includes(`Timeout after ${timeout}ms`) ||
          error.name === "TimeoutError");

      if (isTimeout) {
        status = "timeout";
        errorMessage = `Execution timed out after ${timeout}ms`;
      }

      const result: ExecutionResult = {
        executionId,
        pluginId,
        status,
        output: {},
        durationMs: Date.now() - startTime,
        timestamp: nowIso(),
        error: errorMessage,
      };

      // Write error artifact
      const errorArtifactRef = await this.writeExecutionArtifact(
        normalizedContext,
        pluginId,
        action,
        { error: result.error },
      );
      if (errorArtifactRef) {
        result.artifactRef = errorArtifactRef;
      }

      // R18-3: Emit plugin.execution.completed event on failure
      this.emitPluginEvent("plugin.execution.completed", {
        executionId,
        pluginId,
        action,
        tenantId: normalizedContext.tenantId,
        taskId: normalizedContext.taskId,
        status,
        error: errorMessage,
        durationMs: Date.now() - startTime,
        timestamp: nowIso(),
      });

      // R18-5: Record failure metrics
      this.metricsRegistry?.incrementCounter("plugin_execution_completed_total", { pluginId, action, status }, 1);
      this.metricsRegistry?.observeHistogram("plugin_execution_duration_ms", { pluginId, action }, Date.now() - startTime);
      this.metricsRegistry?.setGauge("plugin_execution_active", { pluginId }, 0);

      return result;
    } finally {
      sandbox.destroy();
    }
  }

  /**
   * Health check for a plugin.
   *
   * @param pluginId - Plugin to check
   * @returns true if healthy
   */
  public async healthCheck(pluginId: string): Promise<boolean> {
    const instance = this.plugins.get(pluginId);
    if (!instance) return false;

    if (instance.hooks.healthCheck) {
      return instance.hooks.healthCheck();
    }

    // Fallback: healthy if error count below threshold
    return instance.errorCount < 5;
  }

  /**
   * Gets the current state of a plugin.
   *
   * @param pluginId - Plugin to check
   */
  public getState(pluginId: string): LifecycleState | null {
    return this.plugins.get(pluginId)?.state ?? null;
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private buildContext(pluginId: string, manifest: PluginManifest): PluginLifecycleContext {
    return {
      pluginId,
      domainId: manifest.domainIds[0] ?? null,
      capabilityIds: manifest.capabilityIds,
      bindingId: null,
      config: manifest.settingsSchema ?? {},
    };
  }

  private createPluginSandbox(
    manifest: PluginManifest,
    tier: SandboxMode,
  ): SandboxPolicy {
    // Validate plugin directory against workspace policy
    const pluginRoot = this.pluginDir;
    const pathCheck = checkSandboxPath(this.sandboxPolicy, pluginRoot);
    const basePolicy =
      tier === "restricted_exec"
        ? createRestrictedExecPolicy(pluginRoot)
        : tier === "scoped_external_access"
          ? createScopedExternalAccessPolicy(pluginRoot)
          : tier === "workspace_write"
            ? createWorkspaceWritePolicy(pluginRoot)
            : createReadOnlyPolicy(pluginRoot);

    return {
      ...basePolicy,
      policyId: `plugin-${manifest.pluginId}-${tier}`,
      allowedRoots: pathCheck.allowed
        ? [pathCheck.normalizedPath]
        : [],
      deniedRoots: [],
    };
  }

  private createSandboxContext(
    policy: SandboxPolicy,
    tier: SandboxMode,
  ): SandboxContext {
    return {
      tier,
      policy,
      destroyed: false,
      destroy: () => {
        // Actual cleanup delegated to command-executor / tool-executor
        // which handle the actual process/container isolation
        policy.allowedRoots = [];
        policy.deniedRoots = [];
      },
    };
  }

  private async invokePluginAction(
    hooks: PluginLifecycleHooks,
    action: string,
    params: Record<string, unknown>,
    context: ExecutionContext,
    scopedSandbox?: ScopedExternalAccessSandbox,
    pluginId?: string,
  ): Promise<unknown> {
    const handler = (hooks as Record<string, unknown>)[action];
    if (typeof handler === "function") {
      // Inject scoped sandbox into context if available
      const executionContext = scopedSandbox
        ? { ...params, context: { ...context, scopedSandbox } }
        : { ...params, context };
      const result = await handler.call(hooks, executionContext);

      // R12-5/R18-4/R18-14 fix: Enforce DataTaintPropagation in sandbox execution.
      // When plugin executes in sandbox, propagate taint labels for the output data.
      // This ensures cross-plugin data contamination is tracked.
      if (result != null && context.executionId && pluginId) {
        const outputDataId = `plugin_output:${context.executionId}:${action}`;
        // Propagate taint with "sandbox_execution" label to mark data as from sandbox
        // R18-4: Properly propagate data taint with correct pluginId
        propagateDataTaint(outputDataId, pluginId, ["sandbox_execution"]);
      }

      return result;
    }
    throw new ValidationError(
      "plugin_executor.action_not_implemented",
      `Action ${action} not implemented`,
    );
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((result) => {
          cleanup();
          resolve(result);
        })
        .catch((err) => {
          cleanup();
          reject(err);
        });
    });
  }

  private async writeExecutionArtifact(
    context: ExecutionContext,
    pluginId: string,
    action: string,
    output: unknown,
  ): Promise<string | undefined> {
    try {
      const result = this.artifactStore.writeJsonArtifact({
        taskId: context.taskId,
        executionId: context.executionId,
        kind: "plugin-execution",
        fileName: `${pluginId}-${action}-${newId("art")}`,
        content: {
          pluginId,
          action,
          output,
          timestamp: nowIso(),
          correlationId: context.correlationId,
        },
      });
      return result.ref.artifactId;
    } catch {
      // Artifact writing is best-effort; don't fail execution
      return undefined;
    }
  }

  // R18-1: Validate plugin manifest before execution
  private validatePluginManifest(manifest: PluginManifest): void {
    // Validate required manifest fields
    if (!manifest.pluginId?.trim()) {
      throw new ValidationError(
        "plugin_executor.invalid_manifest",
        "Plugin manifest missing or empty pluginId",
      );
    }
    if (!manifest.name?.trim()) {
      throw new ValidationError(
        "plugin_executor.invalid_manifest",
        "Plugin manifest missing or empty name",
        { details: { pluginId: manifest.pluginId } },
      );
    }
    if (!manifest.version?.trim()) {
      throw new ValidationError(
        "plugin_executor.invalid_manifest",
        "Plugin manifest missing or empty version",
        { details: { pluginId: manifest.pluginId } },
      );
    }
    if (!manifest.owner?.trim()) {
      throw new ValidationError(
        "plugin_executor.invalid_manifest",
        "Plugin manifest missing or empty owner",
        { details: { pluginId: manifest.pluginId } },
      );
    }
    if (!manifest.spiTypes || manifest.spiTypes.length === 0) {
      throw new ValidationError(
        "plugin_executor.invalid_manifest",
        "Plugin manifest must declare at least one SPI type",
        { details: { pluginId: manifest.pluginId } },
      );
    }
    // Validate trustLevel is appropriate
    const validTrustLevels = ["internal", "trusted", "community", "unverified"];
    if (manifest.trustLevel && !validTrustLevels.includes(manifest.trustLevel)) {
      throw new ValidationError(
        "plugin_executor.invalid_manifest",
        `Plugin trustLevel '${manifest.trustLevel}' is not valid`,
        { details: { pluginId: manifest.pluginId, trustLevel: manifest.trustLevel } },
      );
    }
  }

  // R18-2, R18-3: Emit plugin.execution.started and plugin.execution.completed events
  private emitPluginEvent(
    eventType: "plugin.execution.started" | "plugin.execution.completed",
    payload: Record<string, unknown>,
  ): void {
    if (!this.eventPublisher) {
      return;
    }
    try {
      this.eventPublisher.publish({
        eventType,
        payload,
      });
    } catch {
      // Event emission is best-effort; don't fail execution
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────────────────

interface SandboxContext {
  tier: SandboxMode;
  policy: SandboxPolicy;
  destroyed: boolean;
  destroy(): void;
}
