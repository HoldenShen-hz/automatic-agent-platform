import type { ArtifactRef } from "../../platform/orchestration/oapeflir/ref-types.js";
import type { HumanOutput, MachineOutput, PluginLifecycleContext, PluginLifecycleState, PluginManifest, PluginSpiType, RegisteredPlugin, RetrieverKnowledgeResult } from "./plugin-spi.js";
import type { TypedEventPublisher } from "../../platform/state-evidence/events/typed-event-publisher.js";
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
export declare class PluginSpiRegistry {
    private readonly registry;
    private readonly eventPublisher;
    private readonly maxConsecutiveFailures;
    private readonly activationPromises;
    private readonly invocationWaiters;
    private readonly runtimeHosts;
    constructor(options?: PluginSpiRegistryOptions);
    register<TPlugin extends RegisteredPlugin>(plugin: TPlugin, manifest?: PluginManifest): RegisteredPluginRecord<TPlugin>;
    get(pluginId: string): RegisteredPluginRecord | null;
    list(): RegisteredPluginRecord[];
    listByDomain(domainId: string, spiType?: PluginSpiType): RegisteredPluginRecord[];
    resolve(pluginId: string): RegisteredPlugin | null;
    ensureActive(pluginId: string, overrides?: Partial<PluginLifecycleContext>): Promise<RegisteredPlugin>;
    deactivate(pluginId: string, overrides?: Partial<PluginLifecycleContext>): Promise<void>;
    unload(pluginId: string, overrides?: Partial<PluginLifecycleContext>): Promise<void>;
    invokeRetriever(pluginId: string, input: PluginInvocationOverrides & {
        query: {
            taskId: string;
            intent: string;
            context: Record<string, unknown>;
            tokenBudget: number;
        };
    }): Promise<readonly RetrieverKnowledgeResult[]>;
    invokePresenter(pluginId: string, input: PluginInvocationOverrides & {
        machineOutputs: MachineOutput[];
        artifacts: ArtifactRef[];
        audience: "end_user" | "developer" | "reviewer" | "operator";
    }): Promise<HumanOutput>;
    invokeAdapterAuthenticate(pluginId: string, input: PluginInvocationOverrides & {
        credentials: Record<string, unknown>;
    }): Promise<void>;
    invokeAdapterExecute(pluginId: string, input: PluginInvocationOverrides & {
        action: string;
        params: Record<string, unknown>;
    }): Promise<Record<string, unknown>>;
    private requireRecord;
    private setLifecycleState;
    private isProcessIsolatedRuntime;
    private invokeForkedRuntime;
    private ensureRuntimeHost;
    private disposeRuntimeHost;
    private handleRuntimeHostExit;
    private runLifecycle;
    private runSandboxed;
    private activatePlugin;
    private assertNamespaceAllowed;
    private assertNetworkAllowed;
    private clearCooldownIfExpired;
    private assertNotCoolingDown;
    private recordFailure;
    private resetFailureState;
    private executeInvocation;
    private withInvocationPermit;
    private acquireInvocationPermit;
    private releaseInvocationPermit;
    private publishIsolationEvent;
    private publishInvocationEvent;
}
