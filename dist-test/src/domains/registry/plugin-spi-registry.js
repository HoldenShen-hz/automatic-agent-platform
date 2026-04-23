import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { hasBuiltinPlugin } from "../../plugins/builtin-plugin-registry.js";
import { PluginLifecycleStateSchema, PluginManifestSchema } from "./plugin-spi.js";
import { ContainerizedPluginRuntimeHost, ForkedPluginRuntimeHost } from "./plugin-runtime-host.js";
function defaultManifestFor(plugin) {
    return PluginManifestSchema.parse({
        pluginId: plugin.pluginId,
        name: plugin.pluginId,
        version: "0.0.0",
        owner: "system",
        domainIds: "domainId" in plugin ? [plugin.domainId] : [],
        capabilityIds: [...(plugin.capabilityIds ?? [])],
        spiTypes: [plugin.spiType],
        extensionKind: plugin.spiType === "adapter" ? "external_adapter" : "domain_plugin",
        trustLevel: "trusted",
        publicSdkSurface: "core/domain-registry/plugin-spi",
        settingsSchema: {},
    });
}
function buildContext(record, overrides = {}) {
    return {
        pluginId: record.manifest.pluginId,
        domainId: overrides.domainId ?? record.manifest.domainIds[0] ?? null,
        capabilityIds: overrides.capabilityIds ?? [...record.manifest.capabilityIds],
        bindingId: overrides.bindingId ?? null,
        config: { ...(overrides.config ?? {}) },
    };
}
export class PluginSpiRegistry {
    registry = new Map();
    eventPublisher;
    maxConsecutiveFailures;
    activationPromises = new Map();
    invocationWaiters = new Map();
    runtimeHosts = new Map();
    constructor(options = {}) {
        this.eventPublisher = options.eventPublisher ?? null;
        this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
    }
    register(plugin, manifest) {
        const normalizedManifest = PluginManifestSchema.parse({
            ...defaultManifestFor(plugin),
            ...(plugin.manifest ?? {}),
            ...(manifest ?? {}),
            pluginId: plugin.pluginId,
            spiTypes: Array.from(new Set([plugin.spiType, ...(manifest?.spiTypes ?? plugin.manifest?.spiTypes ?? [])])),
            capabilityIds: Array.from(new Set([...(plugin.capabilityIds ?? []), ...(manifest?.capabilityIds ?? plugin.manifest?.capabilityIds ?? [])])),
            domainIds: "domainId" in plugin
                ? Array.from(new Set([plugin.domainId, ...(manifest?.domainIds ?? plugin.manifest?.domainIds ?? [])]))
                : [...(manifest?.domainIds ?? plugin.manifest?.domainIds ?? [])],
        });
        if (!normalizedManifest.spiTypes.includes(plugin.spiType)) {
            throw new ValidationError("plugin_spi.spi_type_mismatch", "Plugin manifest does not include the plugin spi type.", {
                category: "validation",
                source: "internal",
                details: { pluginId: plugin.pluginId, spiType: plugin.spiType },
            });
        }
        if ((normalizedManifest.sandbox.runtimeIsolation === "forked_process"
            || normalizedManifest.sandbox.runtimeIsolation === "sandboxed_process"
            || normalizedManifest.sandbox.runtimeIsolation === "containerized_process")
            && !hasBuiltinPlugin(plugin.pluginId)) {
            throw new ValidationError("plugin_spi.unsupported_runtime_isolation", `Plugin ${plugin.pluginId} cannot use ${normalizedManifest.sandbox.runtimeIsolation} isolation.`, {
                category: "validation",
                source: "internal",
                details: {
                    pluginId: plugin.pluginId,
                    runtimeIsolation: normalizedManifest.sandbox.runtimeIsolation,
                },
            });
        }
        const record = {
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
    get(pluginId) {
        return this.registry.get(pluginId) ?? null;
    }
    list() {
        return [...this.registry.values()];
    }
    listByDomain(domainId, spiType) {
        return this.list().filter((record) => {
            if (spiType != null && !record.manifest.spiTypes.includes(spiType)) {
                return false;
            }
            return record.manifest.domainIds.length === 0 || record.manifest.domainIds.includes(domainId);
        });
    }
    resolve(pluginId) {
        return this.get(pluginId)?.plugin ?? null;
    }
    async ensureActive(pluginId, overrides = {}) {
        const record = this.requireRecord(pluginId);
        const context = buildContext(record, overrides);
        this.clearCooldownIfExpired(record);
        this.assertNotCoolingDown(record, "activation", context);
        if (record.lifecycleState === "disabled") {
            throw new ValidationError("plugin_spi.plugin_disabled", `Plugin ${pluginId} is disabled.`, {
                category: "validation",
                source: "internal",
                details: { pluginId, disabledReason: record.disabledReason },
            });
        }
        if (record.lifecycleState === "active") {
            return record.plugin;
        }
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
    async deactivate(pluginId, overrides = {}) {
        const record = this.requireRecord(pluginId);
        if (record.lifecycleState !== "active") {
            return;
        }
        const context = buildContext(record, overrides);
        if (this.isProcessIsolatedRuntime(record)) {
            await this.invokeForkedRuntime(record, "deactivate", context);
        }
        else if (record.plugin.onDeactivate) {
            await record.plugin.onDeactivate(context);
        }
        this.setLifecycleState(record, "inactive");
    }
    async unload(pluginId, overrides = {}) {
        const record = this.requireRecord(pluginId);
        const context = buildContext(record, overrides);
        if (record.lifecycleState === "active") {
            await this.deactivate(pluginId, overrides);
        }
        try {
            if (this.isProcessIsolatedRuntime(record)) {
                await this.invokeForkedRuntime(record, "unload", context);
            }
            else if (record.plugin.onUnload) {
                await record.plugin.onUnload(context);
            }
            else if (record.plugin.shutdown) {
                await record.plugin.shutdown();
            }
        }
        finally {
            if (this.isProcessIsolatedRuntime(record)) {
                await this.disposeRuntimeHost(record);
            }
        }
        this.setLifecycleState(record, "unloaded");
    }
    async invokeRetriever(pluginId, input) {
        const plugin = await this.ensureActive(pluginId, input);
        const record = this.requireRecord(pluginId);
        const context = buildContext(record, input);
        if (plugin.spiType !== "retriever") {
            throw new ValidationError("plugin_spi.invalid_operation", `Plugin ${pluginId} is not a retriever.`, {
                category: "validation",
                source: "internal",
            });
        }
        this.assertNamespaceAllowed(record.manifest.sandbox, input.namespace ?? null, pluginId);
        return this.executeInvocation(record, context, "retrieve", async () => {
            if (this.isProcessIsolatedRuntime(record)) {
                return this.invokeForkedRuntime(record, "retrieve", context, input.query);
            }
            return plugin.retrieve(input.query);
        });
    }
    async invokePresenter(pluginId, input) {
        const plugin = await this.ensureActive(pluginId, input);
        const record = this.requireRecord(pluginId);
        const context = buildContext(record, input);
        if (plugin.spiType !== "presenter") {
            throw new ValidationError("plugin_spi.invalid_operation", `Plugin ${pluginId} is not a presenter.`, {
                category: "validation",
                source: "internal",
            });
        }
        return this.executeInvocation(record, context, "present", async () => {
            const presenterInput = {
                machineOutputs: input.machineOutputs,
                artifacts: input.artifacts,
                audience: input.audience,
            };
            if (this.isProcessIsolatedRuntime(record)) {
                return this.invokeForkedRuntime(record, "present", context, presenterInput);
            }
            return plugin.formatOutput(presenterInput);
        });
    }
    async invokeAdapterAuthenticate(pluginId, input) {
        const plugin = await this.ensureActive(pluginId, input);
        const record = this.requireRecord(pluginId);
        const context = buildContext(record, input);
        if (plugin.spiType !== "adapter") {
            throw new ValidationError("plugin_spi.invalid_operation", `Plugin ${pluginId} is not an adapter.`, {
                category: "validation",
                source: "internal",
            });
        }
        this.assertNetworkAllowed(record.manifest.sandbox, pluginId, "authenticate");
        await this.executeInvocation(record, context, "authenticate", async () => {
            if (this.isProcessIsolatedRuntime(record)) {
                await this.invokeForkedRuntime(record, "authenticate", context, input.credentials);
                return;
            }
            await plugin.authenticate(input.credentials);
        });
    }
    async invokeAdapterExecute(pluginId, input) {
        const plugin = await this.ensureActive(pluginId, input);
        const record = this.requireRecord(pluginId);
        const context = buildContext(record, input);
        if (plugin.spiType !== "adapter") {
            throw new ValidationError("plugin_spi.invalid_operation", `Plugin ${pluginId} is not an adapter.`, {
                category: "validation",
                source: "internal",
            });
        }
        this.assertNetworkAllowed(record.manifest.sandbox, pluginId, "execute");
        return this.executeInvocation(record, context, "execute", async () => {
            if (this.isProcessIsolatedRuntime(record)) {
                return this.invokeForkedRuntime(record, "execute", context, {
                    action: input.action,
                    params: input.params,
                });
            }
            return plugin.execute(input.action, input.params);
        });
    }
    requireRecord(pluginId) {
        const record = this.get(pluginId);
        if (!record) {
            throw new ValidationError("plugin_spi.plugin_not_found", `Plugin ${pluginId} is not registered.`, {
                category: "validation",
                source: "internal",
            });
        }
        return record;
    }
    setLifecycleState(record, state) {
        record.lifecycleState = PluginLifecycleStateSchema.parse(state);
    }
    isProcessIsolatedRuntime(record) {
        return record.manifest.sandbox.runtimeIsolation === "forked_process"
            || record.manifest.sandbox.runtimeIsolation === "sandboxed_process"
            || record.manifest.sandbox.runtimeIsolation === "containerized_process";
    }
    async invokeForkedRuntime(record, action, context, input) {
        const host = await this.ensureRuntimeHost(record);
        return host.invoke(action, context, input);
    }
    async ensureRuntimeHost(record) {
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
        }
        catch (error) {
            this.runtimeHosts.delete(record.manifest.pluginId);
            record.runtimeProcessId = null;
            record.runtimeSandboxRoot = null;
            throw error;
        }
    }
    async disposeRuntimeHost(record) {
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
    handleRuntimeHostExit(record, unexpected) {
        this.runtimeHosts.delete(record.manifest.pluginId);
        record.runtimeProcessId = null;
        record.runtimeSandboxRoot = null;
        if (!unexpected) {
            return;
        }
        record.lastErrorAt = nowIso();
        record.lastErrorMessage = `${record.manifest.sandbox.runtimeIsolation} plugin runtime exited unexpectedly.`;
        if (record.lifecycleState === "active" || record.lifecycleState === "loaded") {
            this.setLifecycleState(record, "degraded");
        }
        if (record.activeInvocationCount === 0) {
            this.publishIsolationEvent(record, buildContext(record), "runtime_exit", new Error(record.lastErrorMessage));
        }
    }
    async runLifecycle(record, phase, context, runner) {
        return this.runSandboxed(record, phase, context, runner);
    }
    async runSandboxed(record, phase, context, runner) {
        return this.withInvocationPermit(record, phase, context, async () => {
            const timeoutMs = record.manifest.sandbox.timeoutMs;
            const promise = Promise.resolve().then(runner);
            const timeoutPromise = new Promise((_, reject) => {
                const timer = setTimeout(() => {
                    clearTimeout(timer);
                    reject(new ValidationError("plugin_spi.timeout", `Plugin ${record.manifest.pluginId} timed out during ${phase}.`, {
                        category: "validation",
                        source: "internal",
                        details: { pluginId: record.manifest.pluginId, phase, timeoutMs },
                    }));
                }, timeoutMs);
                promise.finally(() => clearTimeout(timer)).catch(() => undefined);
            });
            try {
                return await Promise.race([promise, timeoutPromise]);
            }
            catch (error) {
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
    async activatePlugin(record, context) {
        const timeoutMs = record.manifest.sandbox.timeoutMs;
        try {
            if (record.lifecycleState === "registered" || record.lifecycleState === "unloaded") {
                await this.runLifecycle(record, "load", context, async () => {
                    if (this.isProcessIsolatedRuntime(record)) {
                        await this.invokeForkedRuntime(record, "load", context);
                    }
                    else if (record.plugin.onLoad) {
                        await record.plugin.onLoad(context);
                    }
                    else if (record.plugin.initialize) {
                        await record.plugin.initialize();
                    }
                });
                this.setLifecycleState(record, "loaded");
            }
            if (record.lifecycleState !== "active") {
                await this.runLifecycle(record, "activate", context, async () => {
                    if (this.isProcessIsolatedRuntime(record)) {
                        await this.invokeForkedRuntime(record, "activate", context);
                    }
                    else if (record.plugin.onActivate) {
                        await record.plugin.onActivate(context);
                    }
                });
            }
            if (record.plugin.healthCheck) {
                const healthy = await this.runLifecycle(record, "health_check", context, async () => {
                    if (this.isProcessIsolatedRuntime(record)) {
                        return this.invokeForkedRuntime(record, "health_check", context);
                    }
                    return record.plugin.healthCheck();
                });
                record.lastHealthCheckAt = nowIso();
                if (!healthy) {
                    throw new ValidationError("plugin_spi.unhealthy_plugin", "Plugin health check failed during activation.", {
                        category: "validation",
                        source: "internal",
                        details: { pluginId: record.manifest.pluginId, timeoutMs },
                    });
                }
            }
        }
        catch (error) {
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
    assertNamespaceAllowed(policy, namespace, pluginId) {
        if (namespace == null || policy.allowedKnowledgeNamespaces.length === 0) {
            return;
        }
        if (!policy.allowedKnowledgeNamespaces.includes(namespace)) {
            throw new ValidationError("plugin_spi.namespace_denied", `Plugin ${pluginId} cannot access namespace ${namespace}.`, {
                category: "validation",
                source: "internal",
                details: { pluginId, namespace, allowedKnowledgeNamespaces: policy.allowedKnowledgeNamespaces },
            });
        }
    }
    assertNetworkAllowed(policy, pluginId, phase) {
        if (policy.allowNetworkEgress) {
            return;
        }
        throw new ValidationError("plugin_spi.network_denied", `Plugin ${pluginId} cannot use network egress during ${phase}.`, {
            category: "validation",
            source: "internal",
            details: { pluginId, phase },
        });
    }
    clearCooldownIfExpired(record) {
        if (!record.cooldownUntil) {
            return;
        }
        if (Date.parse(record.cooldownUntil) <= Date.now()) {
            record.cooldownUntil = null;
        }
    }
    assertNotCoolingDown(record, phase, context) {
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
    recordFailure(record, error, phase, context) {
        record.failureCount += 1;
        record.lastErrorAt = nowIso();
        record.lastErrorMessage = error instanceof Error ? error.message : String(error);
        if (record.manifest.sandbox.cooldownMs > 0) {
            record.cooldownUntil = new Date(Date.now() + record.manifest.sandbox.cooldownMs).toISOString();
        }
        if (record.failureCount >= this.maxConsecutiveFailures) {
            record.disabledReason = phase;
            this.setLifecycleState(record, "disabled");
        }
        else {
            this.setLifecycleState(record, "degraded");
        }
        this.publishIsolationEvent(record, context, phase, error);
    }
    resetFailureState(record) {
        record.failureCount = 0;
        record.lastErrorMessage = null;
        record.lastErrorAt = null;
        record.disabledReason = null;
        record.cooldownUntil = null;
    }
    async executeInvocation(record, context, phase, runner) {
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
        }
        catch (error) {
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
    async withInvocationPermit(record, phase, context, runner) {
        await this.acquireInvocationPermit(record, phase, context);
        record.lastInvocationStartedAt = nowIso();
        try {
            return await runner();
        }
        finally {
            record.activeInvocationCount = Math.max(0, record.activeInvocationCount - 1);
            record.lastInvocationCompletedAt = nowIso();
            this.releaseInvocationPermit(record);
        }
    }
    async acquireInvocationPermit(record, phase, context) {
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
        await new Promise((resolve) => {
            const waiters = this.invocationWaiters.get(record.manifest.pluginId) ?? [];
            waiters.push(() => {
                record.queuedInvocationCount = Math.max(0, record.queuedInvocationCount - 1);
                record.activeInvocationCount += 1;
                resolve();
            });
            this.invocationWaiters.set(record.manifest.pluginId, waiters);
        });
    }
    releaseInvocationPermit(record) {
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
    publishIsolationEvent(record, context, phase, error) {
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
            },
        });
    }
    publishInvocationEvent(eventType, record, context, phase, invocationId, extra) {
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
//# sourceMappingURL=plugin-spi-registry.js.map