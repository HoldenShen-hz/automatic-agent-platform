import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import type { ArtifactRef } from "../../platform/five-plane-orchestration/oapeflir/ref-types.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { getBuiltinPluginManifest, hasBuiltinPlugin } from "../../plugins/builtin-plugin-registry.js";
import type {
  HumanOutput,
  MachineOutput,
  PluginLifecycleContext,
  PluginLifecycleState,
  PluginManifest,
  PluginSandboxPolicy,
  PluginSpiType,
  RegisteredPlugin,
  RetrieverKnowledgeResult,
} from "./plugin-spi.js";
import { PluginLifecycleStateSchema, PluginManifestSchema } from "./plugin-spi.js";
import type { TypedEventPublisher } from "../../platform/five-plane-state-evidence/events/typed-event-publisher.js";
import { ContainerizedPluginRuntimeHost, ForkedPluginRuntimeHost } from "./plugin-runtime-host.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export interface RegisteredPluginRecord<TPlugin extends RegisteredPlugin = RegisteredPlugin> {
  manifest: PluginManifest;
  plugin: TPlugin;
  lifecycleState: PluginLifecycleState;
  lastHealthCheckAt: string | null;
  failureCount: number;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
  disabledReason: string | null;
  cooldownUntil: string | null;
  activeInvocationCount: number;
  queuedInvocationCount: number;
  lastInvocationStartedAt: string | null;
  lastInvocationCompletedAt: string | null;
  runtimeProcessId: number | null;
  runtimeSandboxRoot: string | null;
}

export interface PluginInvocationOverrides extends Partial<PluginLifecycleContext> {
  namespace?: string | null;
}

export interface PluginSpiRegistryOptions {
  eventPublisher?: TypedEventPublisher;
  maxConsecutiveFailures?: number;
}

function resolveCapabilityIds(
  plugin: RegisteredPlugin,
  builtinManifest: PluginManifest | undefined,
  manifest: PluginManifest | undefined,
): string[] {
  const explicitCapabilityIds =
    manifest?.capabilityIds
    ?? plugin.manifest?.capabilityIds
    ?? plugin.capabilityIds
    ?? builtinManifest?.capabilityIds
    ?? [];
  return Array.from(new Set(explicitCapabilityIds));
}

function defaultManifestFor(plugin: RegisteredPlugin): PluginManifest {
  return PluginManifestSchema.parse({
    pluginId: plugin.pluginId,
    name: plugin.pluginId,
    version: plugin.manifest?.version ?? "0.0.0",
    owner: "system",
    domainIds: "domainId" in plugin ? [plugin.domainId] : [],
    capabilityIds: [...(plugin.capabilityIds ?? [])],
    spiTypes: [plugin.spiType],
    extensionKind: plugin.spiType === "adapter" ? "external_adapter" : "domain_plugin",
    trustLevel: "trusted",
    publicSdkSurface: "core/domain-registry/plugin-spi",
    settingsSchema: {},
    sandbox: {
      timeoutMs: 5000,
      allowFilesystemWrite: false,
      allowNetworkEgress: false,
      allowedKnowledgeNamespaces: [],
      maxConcurrentInvocations: 1,
      maxQueuedInvocations: 8,
      runtimeIsolation: "serialized_in_process",
      cooldownMs: 0,
      allowedExternalDomains: [],
      maxResponseSizeBytes: 5 * 1024 * 1024,
      rateLimitPerMinute: 60,
    },
  });
}

function buildContext(
  record: RegisteredPluginRecord,
  overrides: Partial<PluginLifecycleContext> = {},
): PluginLifecycleContext {
  return {
    pluginId: record.manifest.pluginId,
    domainId: overrides.domainId ?? record.manifest.domainIds[0] ?? null,
    capabilityIds: overrides.capabilityIds ?? [...record.manifest.capabilityIds],
    bindingId: overrides.bindingId ?? null,
    config: { ...(overrides.config ?? {}) },
  };
}

export class PluginSpiRegistry {
  private readonly registry = new Map<string, RegisteredPluginRecord>();
  private readonly eventPublisher: TypedEventPublisher | null;
  private readonly maxConsecutiveFailures: number;
  private readonly activationPromises = new Map<string, Promise<RegisteredPlugin>>();
  private readonly invocationWaiters = new Map<string, Array<() => void>>();
  private readonly runtimeHosts = new Map<string, ForkedPluginRuntimeHost | ContainerizedPluginRuntimeHost>();

  public constructor(options: PluginSpiRegistryOptions = {}) {
    this.eventPublisher = options.eventPublisher ?? null;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
  }

  public register<TPlugin extends RegisteredPlugin>(plugin: TPlugin, manifest?: PluginManifest): RegisteredPluginRecord<TPlugin> {
    if (this.registry.has(plugin.pluginId)) {
      throw new ValidationError("plugin_spi.duplicate_plugin_id", `plugin_spi.duplicate_plugin_id: Plugin ${plugin.pluginId} is already registered.`, {
        category: "validation",
        source: "internal",
        details: { pluginId: plugin.pluginId },
      });
    }
    const defaultManifest = defaultManifestFor(plugin);
    const builtinManifest = getBuiltinPluginManifest(plugin.pluginId) ?? undefined;
    const declaredSpiTypes = manifest?.spiTypes ?? plugin.manifest?.spiTypes;
    if (declaredSpiTypes != null && !declaredSpiTypes.includes(plugin.spiType)) {
      throw new ValidationError("plugin_spi.spi_type_mismatch", "plugin_spi.spi_type_mismatch: Plugin manifest does not include the plugin spi type.", {
        category: "validation",
        source: "internal",
        details: { pluginId: plugin.pluginId, spiType: plugin.spiType },
      });
    }
    const inheritedBuiltinManifest = builtinManifest == null
      ? undefined
      : {
          ...builtinManifest,
          sandbox: {
            ...defaultManifest.sandbox,
            ...builtinManifest.sandbox,
            ...(plugin.manifest?.sandbox == null && manifest?.sandbox == null
              ? { runtimeIsolation: defaultManifest.sandbox.runtimeIsolation }
              : {}),
          },
        };
    const normalizedManifest = PluginManifestSchema.parse({
      ...defaultManifest,
      ...(inheritedBuiltinManifest ?? {}),
      ...(plugin.manifest ?? {}),
      ...(manifest ?? {}),
      pluginId: plugin.pluginId,
      spiTypes: Array.from(new Set([
        plugin.spiType,
        ...(builtinManifest?.spiTypes ?? []),
        ...(plugin.manifest?.spiTypes ?? []),
        ...(manifest?.spiTypes ?? []),
      ])),
      capabilityIds: resolveCapabilityIds(plugin, builtinManifest, manifest),
      domainIds:
        "domainId" in plugin
          ? Array.from(new Set([
              plugin.domainId,
              ...(builtinManifest?.domainIds ?? []),
              ...(plugin.manifest?.domainIds ?? []),
              ...(manifest?.domainIds ?? []),
            ]))
          : Array.from(new Set([
              ...(builtinManifest?.domainIds ?? []),
              ...(plugin.manifest?.domainIds ?? []),
              ...(manifest?.domainIds ?? []),
            ])),
    });

    if (!normalizedManifest.spiTypes.includes(plugin.spiType)) {
      throw new ValidationError("plugin_spi.spi_type_mismatch", "plugin_spi.spi_type_mismatch: Plugin manifest does not include the plugin spi type.", {
        category: "validation",
        source: "internal",
        details: { pluginId: plugin.pluginId, spiType: plugin.spiType },
      });
    }
    if (
      (normalizedManifest.sandbox.runtimeIsolation === "forked_process"
        || normalizedManifest.sandbox.runtimeIsolation === "sandboxed_process"
        || normalizedManifest.sandbox.runtimeIsolation === "containerized_process")
      && !hasBuiltinPlugin(plugin.pluginId)
    ) {
      throw new ValidationError("plugin_spi.unsupported_runtime_isolation", `plugin_spi.unsupported_runtime_isolation: Plugin ${plugin.pluginId} cannot use ${normalizedManifest.sandbox.runtimeIsolation} isolation.`, {
        category: "validation",
        source: "internal",
        details: {
          pluginId: plugin.pluginId,
          runtimeIsolation: normalizedManifest.sandbox.runtimeIsolation,
        },
      });
    }

    const record: RegisteredPluginRecord<TPlugin> = {
      manifest: normalizedManifest,
      plugin,
      lifecycleState: "registered",
      lastHealthCheckAt: null,
      failureCount: 0,
      lastErrorMessage: null,
      lastErrorAt: null,
      disabledReason: null,
      cooldownUntil: null,
      activeInvocationCount: 0,
      queuedInvocationCount: 0,
      lastInvocationStartedAt: null,
      lastInvocationCompletedAt: null,
      runtimeProcessId: null,
      runtimeSandboxRoot: null,
    };
    this.registry.set(plugin.pluginId, record);
    this.eventPublisher?.publish({
      eventType: "plugin:spi_registered",
      payload: {
        pluginId: plugin.pluginId,
        domainId: "domainId" in plugin ? plugin.domainId : normalizedManifest.domainIds[0] ?? null,
        spiType: plugin.spiType,
        lifecycleState: record.lifecycleState,
        occurredAt: nowIso(),
      },
    });
    return record;
  }

  public get(pluginId: string): RegisteredPluginRecord | null {
    return this.registry.get(pluginId) ?? null;
  }

  public list(): RegisteredPluginRecord[] {
    return [...this.registry.values()];
  }

  public listByDomain(domainId: string, spiType?: PluginSpiType): RegisteredPluginRecord[] {
    return this.list().filter((record) => {
      if (spiType != null && !record.manifest.spiTypes.includes(spiType)) {
        return false;
      }
      if (domainId.trim().length === 0) {
        return true;
      }
      return record.manifest.domainIds.length === 0 || record.manifest.domainIds.includes(domainId);
    });
  }

  public resolve(pluginId: string): RegisteredPlugin | null {
    return this.get(pluginId)?.plugin ?? null;
  }

  public async ensureActive(pluginId: string, overrides: Partial<PluginLifecycleContext> = {}): Promise<RegisteredPlugin> {
    const record = this.requireRecord(pluginId);
    const context = buildContext(record, overrides);
    this.clearCooldownIfExpired(record);

    if (record.lifecycleState === "disabled") {
      throw new ValidationError("plugin_spi.plugin_disabled", `plugin_spi.plugin_disabled: Plugin ${pluginId} is disabled.`, {
        category: "validation",
        source: "internal",
        details: { pluginId, disabledReason: record.disabledReason },
      });
    }
    if (record.lifecycleState === "unloaded") {
      throw new ValidationError("plugin_spi.plugin_unloaded", `plugin_spi.plugin_unloaded: Plugin ${pluginId} was unloaded and must be re-registered before activation.`, {
        category: "validation",
        source: "internal",
        details: { pluginId },
      });
    }
    if (record.lifecycleState === "active") {
      return record.plugin;
    }
    this.assertNotCoolingDown(record, "activation", context);
    const inFlightActivation = this.activationPromises.get(pluginId);
    if (inFlightActivation) {
      return inFlightActivation;
    }

    const activation = this.activatePlugin(record, context)
      .finally(() => {
        if (this.activationPromises.get(pluginId) === activation) {
          this.activationPromises.delete(pluginId);
        }
      });
    this.activationPromises.set(pluginId, activation);
    return activation;
  }

  public async deactivate(pluginId: string, overrides: Partial<PluginLifecycleContext> = {}): Promise<void> {
    const record = this.requireRecord(pluginId);
    if (record.lifecycleState !== "active") {
      return;
    }
    const context = buildContext(record, overrides);
    if (this.isProcessIsolatedRuntime(record)) {
      await this.invokeForkedRuntime<void>(record, "deactivate", context);
    } else if (record.plugin.onDeactivate) {
      await record.plugin.onDeactivate(context);
    }
    this.setLifecycleState(record, "inactive");
  }

  public async suspend(pluginId: string, reason: string, overrides: Partial<PluginLifecycleContext> = {}): Promise<void> {
    const record = this.requireRecord(pluginId);
    if (record.lifecycleState === "registered" || record.lifecycleState === "disabled" || record.lifecycleState === "suspended") {
      return;
    }

    const context = buildContext(record, overrides);
    if (record.lifecycleState === "active") {
      if (typeof record.plugin.suspend === "function") {
        await record.plugin.suspend(reason, context);
      } else if (record.plugin.onDeactivate) {
        await record.plugin.onDeactivate(context);
      }
    } else if (record.lifecycleState === "inactive" && typeof record.plugin.suspend === "function") {
      await record.plugin.suspend(reason, context);
    }

    this.setLifecycleState(record, "suspended");
    this.eventPublisher?.publish({
      eventType: "plugin:suspended",
      payload: {
        pluginId: record.manifest.pluginId,
        domainId: context.domainId,
        spiType: record.plugin.spiType,
        lifecycleState: "suspended",
        bindingId: context.bindingId,
        reasonCode: reason,
        occurredAt: nowIso(),
      },
    });
  }

  public async unload(pluginId: string, overrides: Partial<PluginLifecycleContext> = {}): Promise<void> {
    const record = this.requireRecord(pluginId);
    const context = buildContext(record, overrides);
    if (record.lifecycleState === "active") {
      await this.deactivate(pluginId, overrides);
    }
    try {
      if (this.isProcessIsolatedRuntime(record)) {
        await this.invokeForkedRuntime<void>(record, "unload", context);
      } else if (record.plugin.onUnload) {
        await record.plugin.onUnload(context);
      } else if (record.plugin.shutdown) {
        await record.plugin.shutdown();
      }
    } finally {
      if (this.isProcessIsolatedRuntime(record)) {
        await this.disposeRuntimeHost(record);
      }
    }
    this.setLifecycleState(record, "unloaded");
  }

  public async invokeRetriever(
    pluginId: string,
    input: PluginInvocationOverrides & {
      query: {
        taskId: string;
        intent: string;
        context: Record<string, unknown>;
        tokenBudget: number;
      };
    },
  ): Promise<readonly RetrieverKnowledgeResult[]> {
    const record = this.requireRecord(pluginId);
    if (record.plugin.spiType !== "retriever") {
      throw new ValidationError("plugin_spi.invalid_operation", `Plugin ${pluginId} is not a retriever.`, {
        category: "validation",
        source: "internal",
      });
    }
    await this.ensureActive(pluginId, input);
    const plugin = record.plugin;
    const context = buildContext(record, input);
    this.assertNamespaceAllowed(record.manifest.sandbox, input.namespace ?? null, pluginId);
    return this.executeInvocation(record, context, "retrieve", async () => {
      if (this.isProcessIsolatedRuntime(record)) {
        return this.invokeForkedRuntime<readonly RetrieverKnowledgeResult[]>(record, "retrieve", context, input.query);
      }
      return plugin.retrieve(input.query);
    });
  }

  public async invokePresenter(
    pluginId: string,
    input: PluginInvocationOverrides & {
      machineOutputs: MachineOutput[];
      artifacts: ArtifactRef[];
      audience: "end_user" | "developer" | "reviewer" | "operator";
    },
  ): Promise<HumanOutput> {
    const record = this.requireRecord(pluginId);
    if (record.plugin.spiType !== "presenter") {
      throw new ValidationError("plugin_spi.invalid_operation", `Plugin ${pluginId} is not a presenter.`, {
        category: "validation",
        source: "internal",
      });
    }
    await this.ensureActive(pluginId, input);
    const plugin = record.plugin;
    const context = buildContext(record, input);
    return this.executeInvocation(record, context, "present", async () => {
      const presenterInput = {
        machineOutputs: input.machineOutputs,
        artifacts: input.artifacts,
        audience: input.audience,
      } as const;
      if (this.isProcessIsolatedRuntime(record)) {
        return this.invokeForkedRuntime<HumanOutput>(record, "present", context, presenterInput);
      }
      return plugin.formatOutput(presenterInput);
    });
  }

  public async invokeAdapterAuthenticate(
    pluginId: string,
    input: PluginInvocationOverrides & {
      credentials: Record<string, unknown>;
    },
  ): Promise<void> {
    const record = this.requireRecord(pluginId);
    if (record.plugin.spiType !== "adapter") {
      throw new ValidationError("plugin_spi.invalid_operation", `Plugin ${pluginId} is not an adapter.`, {
        category: "validation",
        source: "internal",
      });
    }
    const plugin = record.plugin;
    const context = buildContext(record, input);
    this.assertNetworkAllowed(record.manifest.sandbox, pluginId, "authenticate");
    await this.executeInvocation(record, context, "authenticate", async () => {
      if (this.isProcessIsolatedRuntime(record)) {
        await this.invokeForkedRuntime<void>(record, "authenticate", context, input.credentials);
        return;
      }
      await plugin.authenticate(input.credentials);
    });
  }

  public async invokeAdapterExecute(
    pluginId: string,
    input: PluginInvocationOverrides & {
      action: string;
      params: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>> {
    const record = this.requireRecord(pluginId);
    if (record.plugin.spiType !== "adapter") {
      throw new ValidationError("plugin_spi.invalid_operation", `Plugin ${pluginId} is not an adapter.`, {
        category: "validation",
        source: "internal",
      });
    }
    await this.ensureActive(pluginId, input);
    const plugin = record.plugin;
    const context = buildContext(record, input);
    this.assertNetworkAllowed(record.manifest.sandbox, pluginId, "execute");
    return this.executeInvocation(record, context, "execute", async () => {
      if (this.isProcessIsolatedRuntime(record)) {
        return this.invokeForkedRuntime<Record<string, unknown>>(record, "execute", context, {
          action: input.action,
          params: input.params,
        });
      }
      return plugin.execute(input.action, input.params);
    });
  }

  private requireRecord(pluginId: string): RegisteredPluginRecord {
    const record = this.get(pluginId);
    if (!record) {
      throw new ValidationError("plugin_spi.plugin_not_found", `plugin_spi.plugin_not_found: Plugin ${pluginId} was not found or is not registered.`, {
        category: "validation",
        source: "internal",
      });
    }
    return record;
  }

  private setLifecycleState(record: RegisteredPluginRecord, state: PluginLifecycleState): void {
    record.lifecycleState = PluginLifecycleStateSchema.parse(state);
  }

  private isProcessIsolatedRuntime(record: RegisteredPluginRecord): boolean {
    return record.manifest.sandbox.runtimeIsolation === "forked_process"
      || record.manifest.sandbox.runtimeIsolation === "sandboxed_process"
      || record.manifest.sandbox.runtimeIsolation === "containerized_process";
  }

  private async invokeForkedRuntime<T>(
    record: RegisteredPluginRecord,
    action: "load" | "activate" | "health_check" | "deactivate" | "unload" | "retrieve" | "present" | "authenticate" | "execute",
    context: PluginLifecycleContext,
    input?: unknown,
  ): Promise<T> {
    const host = await this.ensureRuntimeHost(record);
    return host.invoke<T>(action, context, input);
  }

  private async ensureRuntimeHost(record: RegisteredPluginRecord): Promise<ForkedPluginRuntimeHost | ContainerizedPluginRuntimeHost> {
    const existing = this.runtimeHosts.get(record.manifest.pluginId);
    if (existing) {
      await existing.start();
      return existing;
    }
    const host = record.manifest.sandbox.runtimeIsolation === "containerized_process"
      ? new ContainerizedPluginRuntimeHost({
          pluginId: record.manifest.pluginId,
          isolation: record.manifest.sandbox.runtimeIsolation,
          sandboxPolicy: record.manifest.sandbox,
          onReady: ({ pid, sandboxRoot }) => {
            record.runtimeProcessId = pid;
            record.runtimeSandboxRoot = sandboxRoot;
          },
          onExit: (unexpected) => {
            this.handleRuntimeHostExit(record, unexpected);
          },
        })
      : new ForkedPluginRuntimeHost({
      pluginId: record.manifest.pluginId,
      isolation: record.manifest.sandbox.runtimeIsolation,
      sandboxPolicy: record.manifest.sandbox,
      onReady: ({ pid, sandboxRoot }) => {
        record.runtimeProcessId = pid;
        record.runtimeSandboxRoot = sandboxRoot;
      },
      onExit: (unexpected) => {
        this.handleRuntimeHostExit(record, unexpected);
      },
    });
    this.runtimeHosts.set(record.manifest.pluginId, host);
    try {
      await host.start();
      return host;
    } catch (error) {
      this.runtimeHosts.delete(record.manifest.pluginId);
      record.runtimeProcessId = null;
      record.runtimeSandboxRoot = null;
      logger.error("plugin_spi.runtime_host_start_failed", {
        pluginId: record.manifest.pluginId,
        runtimeIsolation: record.manifest.sandbox.runtimeIsolation,
        error: error instanceof Error ? error.stack ?? error.message : String(error),
      });
      throw error;
    }
  }

  private async disposeRuntimeHost(record: RegisteredPluginRecord): Promise<void> {
    const host = this.runtimeHosts.get(record.manifest.pluginId);
    if (!host) {
      record.runtimeProcessId = null;
      record.runtimeSandboxRoot = null;
      return;
    }
    this.runtimeHosts.delete(record.manifest.pluginId);
    await host.stop();
    record.runtimeProcessId = null;
    record.runtimeSandboxRoot = null;
  }

  private handleRuntimeHostExit(record: RegisteredPluginRecord, unexpected: boolean): void {
    this.runtimeHosts.delete(record.manifest.pluginId);
    record.runtimeProcessId = null;
    record.runtimeSandboxRoot = null;
    if (!unexpected) {
      return;
    }
    record.lastErrorAt = nowIso();
    record.lastErrorMessage = `${record.manifest.sandbox.runtimeIsolation} plugin runtime exited unexpectedly.`;
    if (
      record.lifecycleState === "active"
      || record.lifecycleState === "loading"
      || record.lifecycleState === "loaded"
      || record.lifecycleState === "initialized"
    ) {
      this.setLifecycleState(record, "degraded");
    }
    if (record.activeInvocationCount === 0) {
      this.publishIsolationEvent(record, buildContext(record), "runtime_exit", new Error(record.lastErrorMessage));
    }
  }

  private async runLifecycle<T>(
    record: RegisteredPluginRecord,
    phase: string,
    context: PluginLifecycleContext,
    runner: () => Promise<T> | T,
  ): Promise<T> {
    return this.runSandboxed(record, phase, context, runner);
  }

  private async runSandboxed<T>(
    record: RegisteredPluginRecord,
    phase: string,
    context: PluginLifecycleContext,
    runner: () => Promise<T> | T,
  ): Promise<T> {
    return this.withInvocationPermit(record, phase, context, async () => {
      const timeoutMs = this.normalizeTimeoutMs(record.manifest.sandbox.timeoutMs, record.manifest.pluginId, phase);
      const promise = Promise.resolve().then(runner);
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          clearTimeout(timer);
          reject(new ValidationError("plugin_spi.timeout", `Plugin ${record.manifest.pluginId} timed out during ${phase}.`, {
            category: "validation",
            source: "internal",
            details: { pluginId: record.manifest.pluginId, phase, timeoutMs },
          }));
        }, timeoutMs);
        void promise.then(
          () => clearTimeout(timer),
          () => clearTimeout(timer),
        );
      });
      try {
        return await Promise.race([promise, timeoutPromise]);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        throw new ValidationError("plugin_spi.isolated_failure", `Plugin ${record.manifest.pluginId} failed during ${phase}.`, {
          category: "validation",
          source: "internal",
          details: {
            pluginId: record.manifest.pluginId,
            phase,
            errorMessage: error instanceof Error ? error.message : String(error),
            domainId: context.domainId,
            bindingId: context.bindingId,
          },
        });
      }
    });
  }

  private async activatePlugin(
    record: RegisteredPluginRecord,
    context: PluginLifecycleContext,
  ): Promise<RegisteredPlugin> {
    const timeoutMs = record.manifest.sandbox.timeoutMs;
    try {
      if (record.lifecycleState === "registered") {
        this.setLifecycleState(record, "loading");
        await this.runLifecycle(record, "load", context, async () => {
          if (this.isProcessIsolatedRuntime(record)) {
            await this.invokeForkedRuntime<void>(record, "load", context);
          } else if (record.plugin.onLoad) {
            await record.plugin.onLoad(context);
          } else if (record.plugin.initialize) {
            await record.plugin.initialize();
          }
        });
        this.setLifecycleState(record, "initialized");
      }

      if (record.lifecycleState !== "active") {
        await this.runLifecycle(record, "activate", context, async () => {
          if (this.isProcessIsolatedRuntime(record)) {
            await this.invokeForkedRuntime<void>(record, "activate", context);
          } else if (record.plugin.onActivate) {
            await record.plugin.onActivate(context);
          }
        });
      }

      if (record.plugin.healthCheck) {
        const healthy = await this.runLifecycle(record, "health_check", context, async () => {
          if (this.isProcessIsolatedRuntime(record)) {
            return this.invokeForkedRuntime<boolean>(record, "health_check", context);
          }
          return record.plugin.healthCheck!();
        });
        record.lastHealthCheckAt = nowIso();
        if (!healthy) {
          throw new ValidationError("plugin_spi.unhealthy_plugin", "Plugin unhealthy: health check failed during activation.", {
            category: "validation",
            source: "internal",
            details: { pluginId: record.manifest.pluginId, timeoutMs },
          });
        }
      }
    } catch (error) {
      if (this.isProcessIsolatedRuntime(record)) {
        await this.disposeRuntimeHost(record);
      }
      this.recordFailure(record, error, "activation", context);
      throw error;
    }

    this.resetFailureState(record);
    this.setLifecycleState(record, "active");
    this.eventPublisher?.publish({
      eventType: "plugin:activated",
      payload: {
        pluginId: record.manifest.pluginId,
        domainId: context.domainId,
        spiType: record.plugin.spiType,
        lifecycleState: "active",
        bindingId: context.bindingId,
        occurredAt: nowIso(),
      },
    });
    return record.plugin;
  }

  private assertNamespaceAllowed(policy: PluginSandboxPolicy, namespace: string | null, pluginId: string): void {
    // `null` means the caller is not asking for any namespaced knowledge access.
    // The allowlist only constrains explicit namespace reads/writes.
    if (namespace == null) {
      return;
    }
    if (policy.allowedKnowledgeNamespaces.length === 0) {
      throw new ValidationError("plugin_spi.namespace_denied", `plugin_spi.namespace_denied: Plugin ${pluginId} cannot access namespace ${namespace} because no namespaces are allowlisted.`, {
        category: "validation",
        source: "internal",
        details: { pluginId, namespace, allowedKnowledgeNamespaces: [] },
      });
    }
    if (!policy.allowedKnowledgeNamespaces.includes(namespace)) {
      throw new ValidationError("plugin_spi.namespace_denied", `plugin_spi.namespace_denied: Plugin ${pluginId} cannot access namespace ${namespace}.`, {
        category: "validation",
        source: "internal",
        details: { pluginId, namespace, allowedKnowledgeNamespaces: policy.allowedKnowledgeNamespaces },
      });
    }
  }

  private assertNetworkAllowed(policy: PluginSandboxPolicy, pluginId: string, phase: string): void {
    if (policy.allowNetworkEgress && policy.allowedExternalDomains.length > 0) {
      return;
    }
    throw new ValidationError("plugin_spi.network_denied", `plugin_spi.network_denied: Plugin ${pluginId} cannot use network egress during ${phase}.`, {
      category: "validation",
      source: "internal",
      details: { pluginId, phase, allowedExternalDomains: policy.allowedExternalDomains },
    });
  }

  private normalizeTimeoutMs(timeoutMs: number, pluginId: string, phase: string): number {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
      throw new ValidationError("plugin_spi.invalid_timeout", `plugin_spi.invalid_timeout: Plugin ${pluginId} timeout must be at least 1ms during ${phase}.`, {
        category: "validation",
        source: "internal",
        details: { pluginId, phase, timeoutMs },
      });
    }
    return timeoutMs;
  }

  private clearCooldownIfExpired(record: RegisteredPluginRecord): void {
    if (!record.cooldownUntil) {
      return;
    }
    if (Date.parse(record.cooldownUntil) <= Date.now()) {
      record.cooldownUntil = null;
    }
  }

  private assertNotCoolingDown(
    record: RegisteredPluginRecord,
    phase: string,
    context: PluginLifecycleContext,
  ): void {
    if (!record.cooldownUntil) {
      return;
    }
    const error = new ValidationError("plugin_spi.cooldown_active", `Plugin ${record.manifest.pluginId} is cooling down during ${phase}.`, {
      category: "validation",
      source: "internal",
      details: {
        pluginId: record.manifest.pluginId,
        phase,
        cooldownUntil: record.cooldownUntil,
      },
    });
    this.publishIsolationEvent(record, context, phase, error);
    throw error;
  }

  private recordFailure(
    record: RegisteredPluginRecord,
    error: unknown,
    phase: string,
    context: PluginLifecycleContext,
  ): void {
    record.failureCount += 1;
    record.lastErrorAt = nowIso();
    record.lastErrorMessage = extractPluginErrorMessage(error);
    logger.error("plugin_spi.operation_failed", {
      pluginId: record.manifest.pluginId,
      phase,
      domainId: context.domainId,
      bindingId: context.bindingId,
      failureCount: record.failureCount,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    });
    if (record.manifest.sandbox.cooldownMs > 0) {
      record.cooldownUntil = new Date(Date.now() + record.manifest.sandbox.cooldownMs).toISOString();
    }
    if (record.failureCount >= this.maxConsecutiveFailures) {
      record.disabledReason = phase;
      this.setLifecycleState(record, "disabled");
    } else if (phase === "activation" || phase === "load" || phase === "health_check") {
      this.setLifecycleState(record, "suspended");
    } else {
      this.setLifecycleState(record, "degraded");
    }
    this.publishIsolationEvent(record, context, phase, error);
  }

  private resetFailureState(record: RegisteredPluginRecord): void {
    record.failureCount = 0;
    record.lastErrorMessage = null;
    record.lastErrorAt = null;
    record.disabledReason = null;
    record.cooldownUntil = null;
  }

  private async executeInvocation<T>(
    record: RegisteredPluginRecord,
    context: PluginLifecycleContext,
    phase: string,
    runner: () => Promise<T>,
  ): Promise<T> {
    this.clearCooldownIfExpired(record);
    this.assertNotCoolingDown(record, phase, context);
    const invocationId = newId("plugin_invocation");
    const startedAt = Date.now();
    this.publishInvocationEvent("plugin:invocation_started", record, context, phase, invocationId, {
      status: "started",
    });
    try {
      const result = await this.runSandboxed(record, phase, context, runner);
      this.resetFailureState(record);
      if (record.lifecycleState === "degraded") {
        this.setLifecycleState(record, "active");
      }
      this.publishInvocationEvent("plugin:invocation_completed", record, context, phase, invocationId, {
        status: "completed",
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      this.recordFailure(record, error, phase, context);
      this.publishInvocationEvent("plugin:invocation_completed", record, context, phase, invocationId, {
        status: "failed",
        durationMs: Date.now() - startedAt,
        reasonCode: error instanceof ValidationError ? error.code : phase,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async withInvocationPermit<T>(
    record: RegisteredPluginRecord,
    phase: string,
    context: PluginLifecycleContext,
    runner: () => Promise<T>,
  ): Promise<T> {
    await this.acquireInvocationPermit(record, phase, context);
    record.lastInvocationStartedAt = nowIso();
    try {
      return await runner();
    } finally {
      record.activeInvocationCount = Math.max(0, record.activeInvocationCount - 1);
      record.lastInvocationCompletedAt = nowIso();
      this.releaseInvocationPermit(record);
    }
  }

  private async acquireInvocationPermit(
    record: RegisteredPluginRecord,
    phase: string,
    context: PluginLifecycleContext,
  ): Promise<void> {
    const maxConcurrentInvocations = record.manifest.sandbox.maxConcurrentInvocations;
    if (record.activeInvocationCount < maxConcurrentInvocations) {
      record.activeInvocationCount += 1;
      return;
    }

    const maxQueuedInvocations = record.manifest.sandbox.maxQueuedInvocations;
    if (record.queuedInvocationCount >= maxQueuedInvocations) {
      throw new ValidationError("plugin_spi.queue_overflow", `Plugin ${record.manifest.pluginId} exceeded the queued invocation limit during ${phase}.`, {
        category: "validation",
        source: "internal",
        details: {
          pluginId: record.manifest.pluginId,
          phase,
          domainId: context.domainId,
          bindingId: context.bindingId,
          maxConcurrentInvocations,
          maxQueuedInvocations,
        },
      });
    }

    record.queuedInvocationCount += 1;
    await new Promise<void>((resolve, reject) => {
      const waiters = this.invocationWaiters.get(record.manifest.pluginId) ?? [];
      const cleanup = (): void => {
        const current = this.invocationWaiters.get(record.manifest.pluginId);
        if (!current) {
          return;
        }
        const index = current.indexOf(waiter);
        if (index >= 0) {
          current.splice(index, 1);
        }
        if (current.length === 0) {
          this.invocationWaiters.delete(record.manifest.pluginId);
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        record.queuedInvocationCount = Math.max(0, record.queuedInvocationCount - 1);
        reject(new ValidationError("plugin_spi.queue_wait_timeout", `Plugin ${record.manifest.pluginId} timed out waiting for an invocation slot during ${phase}.`, {
          category: "validation",
          source: "internal",
          details: {
            pluginId: record.manifest.pluginId,
            phase,
            domainId: context.domainId,
            bindingId: context.bindingId,
          },
        }));
      }, this.normalizeTimeoutMs(record.manifest.sandbox.timeoutMs, record.manifest.pluginId, phase));
      const waiter = () => {
        clearTimeout(timer);
        record.queuedInvocationCount = Math.max(0, record.queuedInvocationCount - 1);
        record.activeInvocationCount += 1;
        resolve();
      };
      waiters.push(waiter);
      this.invocationWaiters.set(record.manifest.pluginId, waiters);
    });
  }

  private releaseInvocationPermit(record: RegisteredPluginRecord): void {
    const waiters = this.invocationWaiters.get(record.manifest.pluginId);
    if (!waiters || waiters.length === 0) {
      this.invocationWaiters.delete(record.manifest.pluginId);
      return;
    }
    const availableSlots = Math.max(0, record.manifest.sandbox.maxConcurrentInvocations - record.activeInvocationCount);
    for (let count = 0; count < availableSlots; count++) {
      const next = waiters.shift();
      if (!next) {
        break;
      }
      next();
    }
    if (waiters.length === 0) {
      this.invocationWaiters.delete(record.manifest.pluginId);
    }
  }

  private publishIsolationEvent(
    record: RegisteredPluginRecord,
    context: PluginLifecycleContext,
    phase: string,
    error: unknown,
  ): void {
    this.eventPublisher?.publish({
      eventType: "plugin:error_isolated",
      payload: {
        pluginId: record.manifest.pluginId,
        domainId: context.domainId,
        spiType: record.plugin.spiType,
        lifecycleState: record.lifecycleState,
        bindingId: context.bindingId,
        occurredAt: nowIso(),
        reasonCode: error instanceof ValidationError ? error.code : phase,
        errorMessage: error instanceof Error ? error.message : String(error),
        phase,
      },
    });
  }

  private publishInvocationEvent(
    eventType: "plugin:invocation_started" | "plugin:invocation_completed",
    record: RegisteredPluginRecord,
    context: PluginLifecycleContext,
    phase: string,
    invocationId: string,
    extra: {
      status: "started" | "completed" | "failed";
      durationMs?: number;
      reasonCode?: string | null;
      errorMessage?: string | null;
    },
  ): void {
    this.eventPublisher?.publish({
      eventType,
      payload: {
        pluginId: record.manifest.pluginId,
        domainId: context.domainId,
        spiType: record.plugin.spiType,
        phase,
        invocationId,
        lifecycleState: record.lifecycleState,
        runtimeIsolation: record.manifest.sandbox.runtimeIsolation,
        activeInvocationCount: record.activeInvocationCount,
        queuedInvocationCount: record.queuedInvocationCount,
        bindingId: context.bindingId,
        occurredAt: nowIso(),
        status: extra.status,
        reasonCode: extra.reasonCode ?? null,
        errorMessage: extra.errorMessage ?? null,
        ...(extra.durationMs != null ? { durationMs: extra.durationMs } : {}),
      },
    });
  }
}

function extractPluginErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    const details = error.details as { errorMessage?: unknown } | undefined;
    if (typeof details?.errorMessage === "string" && details.errorMessage.length > 0) {
      return details.errorMessage;
    }
  }
  return error instanceof Error ? error.message : String(error);
}
