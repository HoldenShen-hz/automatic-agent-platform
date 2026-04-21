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
import { join } from "node:path";
import { ValidationError, SandboxError } from "../../contracts/errors.js";
import { checkSandboxPath, createWorkspaceWritePolicy, } from "../../control-plane/iam/sandbox-policy.js";
import { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { createScopedExternalAccessSandbox, } from "./scoped-external-access-sandbox.js";
// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Tier Configuration
// ─────────────────────────────────────────────────────────────────────────────
const SANDBOX_MODE_MAP = {
    none: "danger_full_access",
    process: "read_only",
    container: "workspace_write",
    scoped_external_access: "workspace_write",
};
// ─────────────────────────────────────────────────────────────────────────────
// Plugin Executor Service
// ─────────────────────────────────────────────────────────────────────────────
export class PluginExecutorService {
    plugins = new Map();
    sandboxPolicy;
    artifactStore;
    pluginDir;
    constructor(options = {}) {
        this.pluginDir = options.pluginDir ?? join(process.cwd(), "plugins");
        this.sandboxPolicy = options.sandboxPolicy ?? createWorkspaceWritePolicy(process.cwd());
        this.artifactStore = options.artifactStore ?? new ArtifactStore();
    }
    // ── Registry Operations ────────────────────────────────────────────────────
    /**
     * Registers a plugin with the executor.
     *
     * @param manifest - Plugin manifest from registry
     * @param hooks - Plugin lifecycle hooks instance
     */
    register(manifest, hooks) {
        if (this.plugins.has(manifest.pluginId)) {
            throw new ValidationError("plugin_executor.already_registered", `Plugin ${manifest.pluginId} is already registered`, { details: { pluginId: manifest.pluginId } });
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
    async unregister(pluginId) {
        const instance = this.plugins.get(pluginId);
        if (!instance) {
            throw new ValidationError("plugin_executor.not_found", `Plugin ${pluginId} is not registered`, { details: { pluginId } });
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
    listPlugins() {
        return [...this.plugins.values()].map((i) => i.manifest);
    }
    // ── Lifecycle Management ──────────────────────────────────────────────────
    /**
     * Loads a plugin into memory, calling onLoad hook.
     *
     * @param pluginId - Plugin to load
     */
    async load(pluginId) {
        const instance = this.plugins.get(pluginId);
        if (!instance) {
            throw new ValidationError("plugin_executor.not_found", `Plugin ${pluginId} not found`, { details: { pluginId } });
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
    async activate(pluginId) {
        const instance = this.plugins.get(pluginId);
        if (!instance || instance.state === "disabled") {
            throw new ValidationError("plugin_executor.not_found", `Plugin ${pluginId} not found or disabled`, { details: { pluginId } });
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
    async deactivate(pluginId) {
        const instance = this.plugins.get(pluginId);
        if (!instance || instance.state === "disabled")
            return;
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
    async execute(pluginId, action, context, params) {
        const startTime = Date.now();
        const instance = this.plugins.get(pluginId);
        if (!instance) {
            throw new ValidationError("plugin_executor.not_found", `Plugin ${pluginId} not found`, { details: { pluginId } });
        }
        if (instance.state !== "active" && instance.state !== "loaded") {
            throw new SandboxError("plugin_executor.not_active", `Plugin ${pluginId} is not active (state: ${instance.state})`, { details: { pluginId, state: instance.state } });
        }
        if (!instance.manifest.spiTypes.includes(action)) {
            throw new ValidationError("plugin_executor.action_not_allowed", `Action ${action} not defined in plugin manifest`, { details: { pluginId, action } });
        }
        // Get timeout from manifest
        const timeout = instance.manifest.sandbox?.timeoutMs ?? 5000;
        const sandboxTier = context.sandboxTier;
        // Create sandbox policy based on tier
        const pluginSandboxPolicy = this.createPluginSandbox(instance.manifest, sandboxTier);
        // Create sandbox context for execution
        const sandbox = this.createSandboxContext(pluginSandboxPolicy, sandboxTier);
        // Create scoped external access sandbox if tier requires it
        let scopedSandbox;
        if (sandboxTier === "scoped_external_access") {
            // scoped_external_access sandbox gets configuration from plugin manifest's sandbox policy
            // allowedExternalDomains and limits are defined in sandbox configuration
            const sandboxConfig = instance.manifest.sandbox;
            scopedSandbox = createScopedExternalAccessSandbox(sandboxConfig.allowedExternalDomains ?? [], {
                maxResponseSizeBytes: sandboxConfig.maxResponseSizeBytes ?? 1024 * 1024,
                rateLimitPerMinute: sandboxConfig.rateLimitPerMinute ?? 60,
            });
        }
        try {
            // Execute with timeout constraint
            const output = await this.executeWithTimeout(() => this.invokePluginAction(instance.hooks, action, params, context, scopedSandbox), timeout);
            // Write execution result to artifact store as evidence
            const artifactRef = await this.writeExecutionArtifact(context, pluginId, action, output);
            // Build result, conditionally include artifactRef
            const result = {
                executionId: newId("exec"),
                pluginId,
                status: "ok",
                output,
                durationMs: Date.now() - startTime,
                timestamp: nowIso(),
            };
            if (artifactRef) {
                result.artifactRef = artifactRef;
            }
            return result;
        }
        catch (error) {
            instance.errorCount++;
            instance.lastError = error instanceof Error ? error.message : String(error);
            // Check if timeout
            const isTimeout = error instanceof Error &&
                (error.message.includes(`Timeout after ${timeout}ms`) ||
                    error.name === "TimeoutError");
            const result = {
                executionId: newId("exec"),
                pluginId,
                status: isTimeout ? "timeout" : "error",
                output: {},
                durationMs: Date.now() - startTime,
                timestamp: nowIso(),
                error: isTimeout
                    ? `Execution timed out after ${timeout}ms`
                    : instance.lastError ?? "Unknown error",
            };
            // Write error artifact
            const errorArtifactRef = await this.writeExecutionArtifact(context, pluginId, action, { error: result.error });
            if (errorArtifactRef) {
                result.artifactRef = errorArtifactRef;
            }
            return result;
        }
        finally {
            sandbox.destroy();
        }
    }
    /**
     * Health check for a plugin.
     *
     * @param pluginId - Plugin to check
     * @returns true if healthy
     */
    async healthCheck(pluginId) {
        const instance = this.plugins.get(pluginId);
        if (!instance)
            return false;
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
    getState(pluginId) {
        return this.plugins.get(pluginId)?.state ?? null;
    }
    // ── Private Helpers ───────────────────────────────────────────────────────
    buildContext(pluginId, manifest) {
        return {
            pluginId,
            domainId: manifest.domainIds[0] ?? null,
            capabilityIds: manifest.capabilityIds,
            bindingId: null,
            config: manifest.settingsSchema ?? {},
        };
    }
    createPluginSandbox(manifest, tier) {
        const mode = SANDBOX_MODE_MAP[tier] ?? "read_only";
        // Validate plugin directory against workspace policy
        const pluginRoot = this.pluginDir;
        const pathCheck = checkSandboxPath(this.sandboxPolicy, pluginRoot);
        return {
            policyId: `plugin-${manifest.pluginId}-${tier}`,
            mode,
            allowedRoots: pathCheck.allowed
                ? [pathCheck.normalizedPath]
                : [],
            deniedRoots: [],
            realpathEnforced: true,
            symlinkPolicy: "deny",
            processRuleMode: tier === "none" ? "allow" : "deny",
        };
    }
    createSandboxContext(policy, tier) {
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
    async invokePluginAction(hooks, action, params, context, scopedSandbox) {
        const handler = hooks[action];
        if (typeof handler === "function") {
            // Inject scoped sandbox into context if available
            const executionContext = scopedSandbox
                ? { ...params, context: { ...context, scopedSandbox } }
                : { ...params, context };
            return handler.call(hooks, executionContext);
        }
        throw new ValidationError("plugin_executor.action_not_implemented", `Action ${action} not implemented`);
    }
    async executeWithTimeout(fn, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout after ${timeoutMs}ms`));
            }, timeoutMs);
            fn()
                .then((result) => {
                clearTimeout(timer);
                resolve(result);
            })
                .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }
    async writeExecutionArtifact(context, pluginId, action, output) {
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
        }
        catch {
            // Artifact writing is best-effort; don't fail execution
            return undefined;
        }
    }
}
//# sourceMappingURL=plugin-executor.service.js.map