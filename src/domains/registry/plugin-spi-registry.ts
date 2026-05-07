import { createHash, createHmac, createVerify } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { ValidationError, SecurityError } from "../../platform/contracts/errors.js";
import type { ArtifactRef } from "../../platform/orchestration/oapeflir/ref-types.js";
import { hasBuiltinPlugin } from "../../plugins/builtin-plugin-registry.js";
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
import { PluginLifecycleStateSchema, PluginManifestSchema, PluginSignatureSchema } from "./plugin-spi.js";
import type { TypedEventPublisher } from "../../platform/state-evidence/events/typed-event-publisher.js";
import { ContainerizedPluginRuntimeHost, ForkedPluginRuntimeHost } from "./plugin-runtime-host.js";

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

function defaultManifestFor(plugin: RegisteredPlugin): PluginManifest {
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
    publicSdkSurface: ["core/domain-registry/plugin-spi"],
    settingsSchema: {},
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

/**
 * R8-25: SignatureVerificationResult holds the result of signature verification.
 */
export interface SignatureVerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * R8-25: PluginSignatureVerifier handles plugin signature verification.
 * This is a security feature to ensure plugin integrity before loading.
 */
export interface PluginSignatureVerifier {
  /**
   * Verify a plugin manifest signature.
   * @param manifest - The plugin manifest to verify
   * @param signature - The signature to verify against
   * @returns Verification result with valid flag and optional reason
   */
  verify(manifest: PluginManifest, signature: { keyId: string; signature: string; algorithm: string }): SignatureVerificationResult;
}

/**
 * R8-25: Default implementation of PluginSignatureVerifier.
 * Uses Node's crypto module for cryptographic verification.
 */
export class DefaultPluginSignatureVerifier implements PluginSignatureVerifier {
  private readonly publicKeys = new Map<string, string>();

  constructor(publicKeys?: Record<string, string>) {
    if (publicKeys) {
      for (const [keyId, key] of Object.entries(publicKeys)) {
        this.publicKeys.set(keyId, key);
      }
    }
  }

  /**
   * Register a public key for signature verification.
   */
  registerPublicKey(keyId: string, publicKey: string): void {
    this.publicKeys.set(keyId, publicKey);
  }

  /**
   * Get the Node.js signature algorithm name for the given algorithm.
   */
  private getSignatureAlgorithm(alg: string): string {
    switch (alg) {
      case "RS256": return "RSA-SHA256";
      case "RS384": return "RSA-SHA384";
      case "RS512": return "RSA-SHA512";
      case "ES256": return "SHA256";
      case "ES384": return "SHA384";
      case "ES512": return "SHA512";
      default: return "RSA-SHA256";
    }
  }

  /**
   * R8-25: Verify a plugin manifest signature.
   */
  verify(manifest: PluginManifest, signature: { keyId: string; signature: string; algorithm: string }): SignatureVerificationResult {
    // If no signature provided, skip verification (backward compatibility)
    if (!signature || !signature.keyId || !signature.signature || !signature.algorithm) {
      return { valid: true };
    }

    const publicKey = this.publicKeys.get(signature.keyId);
    if (!publicKey) {
      return { valid: false, reason: `plugin.signature.key_not_found: Public key '${signature.keyId}' not found` };
    }

    try {
      // Create a canonical representation of the manifest for signing
      const canonicalManifest = this.canonicalizeManifest(manifest);
      const sigBuffer = Buffer.from(signature.signature, "base64");
      const alg = this.getSignatureAlgorithm(signature.algorithm);

      // Use verify based on algorithm type
      if (signature.algorithm.startsWith("HS")) {
        // HMAC-based verification
        const hmac = createHmac(signature.algorithm.toLowerCase().replace("s", ""), publicKey);
        hmac.update(canonicalManifest);
        const expected = hmac.digest("base64");
        const actual = signature.signature;
        if (expected !== actual) {
          return { valid: false, reason: "plugin.signature.invalid: HMAC signature verification failed" };
        }
        return { valid: true };
      } else if (signature.algorithm.startsWith("RS") || signature.algorithm.startsWith("ES")) {
        // RSA or ECDSA verification
        const verifier = createVerify(alg);
        verifier.update(canonicalManifest);
        const isValid = verifier.verify(publicKey, sigBuffer);
        if (!isValid) {
          return { valid: false, reason: "plugin.signature.invalid: Signature verification failed" };
        }
        return { valid: true };
      } else {
        return { valid: false, reason: `plugin.signature.unsupported_algorithm: Unsupported algorithm '${signature.algorithm}'` };
      }
    } catch (error) {
      return {
        valid: false,
        reason: `plugin.signature.verification_error: Signature verification error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Create a canonical string representation of the manifest for signing.
   * Excludes the signature field itself to allow self-referential signing.
   */
  private canonicalizeManifest(manifest: PluginManifest): string {
    // Create a copy without the signature field
    const { signature: _sig, ...manifestWithoutSig } = manifest as PluginManifest & { signature?: unknown };
    return JSON.stringify(manifestWithoutSig);
  }
}

/**
 * R8-25: Global default verifier instance.
 */
const defaultVerifier = new DefaultPluginSignatureVerifier();

/**
 * R8-25: Get the global plugin signature verifier.
 */
export function getPluginSignatureVerifier(): PluginSignatureVerifier {
  return defaultVerifier;
}

/**
 * R8-25: Register a public key for plugin signature verification.
 */
export function registerPluginSigningKey(keyId: string, publicKey: string): void {
  defaultVerifier.registerPublicKey(keyId, publicKey);
}

/**
 * R8-25: Verify plugin manifest signature.
 * Throws SecurityError if verification fails.
 *
 * Security policy:
 * - Plugins with trustLevel "internal" or "trusted" may omit signature (pre-approved)
 * - Plugins with trustLevel "community" or "unverified" MUST have a valid signature
 * - If a signature is provided, it must be valid
 */
export function verifyPluginSignature(manifest: PluginManifest): void {
  const signature = manifest.signature;
  if (!signature) {
    // No signature provided - check trust level
    const trustLevel = manifest.trustLevel;
    if (trustLevel === "internal" || trustLevel === "trusted") {
      // Pre-approved plugins don't require signatures
      return;
    }
    // Community/unverified plugins must have signatures
    throw new SecurityError(
      "plugin.signature.required",
      `Plugin '${manifest.pluginId}' requires a signature due to trustLevel '${trustLevel}'`,
      {
        details: {
          pluginId: manifest.pluginId,
          trustLevel,
        },
      },
    );
  }

  // Validate signature structure
  const parseResult = PluginSignatureSchema.safeParse(signature);
  if (!parseResult.success) {
    throw new SecurityError(
      "plugin.signature.invalid_structure",
      "Plugin signature has invalid structure",
      {
        details: {
          pluginId: manifest.pluginId,
          errors: parseResult.error.errors.map(e => ({ path: e.path.join("."), message: e.message })),
        },
      },
    );
  }

  const verifier = getPluginSignatureVerifier();
  const result = verifier.verify(manifest, signature);

  if (!result.valid) {
    throw new SecurityError(
      "plugin.signature.verification_failed",
      `Plugin signature verification failed: ${result.reason}`,
      {
        details: {
          pluginId: manifest.pluginId,
          keyId: signature.keyId,
          algorithm: signature.algorithm,
          reason: result.reason,
        },
      },
    );
  }
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
    const normalizedManifest = PluginManifestSchema.parse({
      ...defaultManifestFor(plugin),
      ...(plugin.manifest ?? {}),
      ...(manifest ?? {}),
      pluginId: plugin.pluginId,
      spiTypes: Array.from(new Set([plugin.spiType, ...(manifest?.spiTypes ?? plugin.manifest?.spiTypes ?? [])])),
      capabilityIds: Array.from(new Set([...(plugin.capabilityIds ?? []), ...(manifest?.capabilityIds ?? plugin.manifest?.capabilityIds ?? [])])),
      domainIds:
        "domainId" in plugin
          ? Array.from(new Set([plugin.domainId, ...(manifest?.domainIds ?? plugin.manifest?.domainIds ?? [])]))
          : [...(manifest?.domainIds ?? plugin.manifest?.domainIds ?? [])],
    });

    // R8-25: Verify plugin signature before registration (security requirement)
    verifyPluginSignature(normalizedManifest);

    if (!normalizedManifest.spiTypes.includes(plugin.spiType)) {
      throw new ValidationError("plugin_spi.spi_type_mismatch", "Plugin manifest does not include the plugin spi type.", {
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
      throw new ValidationError("plugin_spi.unsupported_runtime_isolation", `Plugin ${plugin.pluginId} cannot use ${normalizedManifest.sandbox.runtimeIsolation} isolation.`, {
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
      throw new ValidationError("plugin_spi.plugin_disabled", `Plugin ${pluginId} is disabled.`, {
        category: "validation",
        source: "internal",
        details: { pluginId, disabledReason: record.disabledReason },
      });
    }
    if (record.lifecycleState === "active" || record.lifecycleState === "suspended") {
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

  /**
   * Suspend a plugin - puts it in suspended state per contract §4.
   * Plugin may be resumed later without full reload.
   */
  public async suspend(pluginId: string, reason: string, overrides: Partial<PluginLifecycleContext> = {}): Promise<void> {
    const record = this.requireRecord(pluginId);
    if (record.lifecycleState !== "active" && record.lifecycleState !== "inactive") {
      return; // Can only suspend active/inactive plugins
    }
    const context = buildContext(record, overrides);

    // Call the plugin's suspend hook if it exists
    if (record.plugin.suspend) {
      if (this.isProcessIsolatedRuntime(record)) {
        // For isolated runtimes, suspend via the runtime host
        await this.invokeForkedRuntime<void>(record, "suspend", context, { reason });
      } else {
        await record.plugin.suspend(reason);
      }
    }

    this.setLifecycleState(record, "suspended");
    this.eventPublisher?.publish({
      eventType: "plugin:suspended",
      payload: {
        pluginId: record.manifest.pluginId,
        domainId: context.domainId,
        spiType: record.plugin.spiType,
        lifecycleState: "suspended",
        reason,
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
      throw new ValidationError("plugin_spi.plugin_not_found", `Plugin ${pluginId} is not registered.`, {
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
    action: "load" | "activate" | "health_check" | "deactivate" | "unload" | "suspend" | "retrieve" | "present" | "authenticate" | "execute",
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
    if (record.lifecycleState === "active" || record.lifecycleState === "loading") {
      this.setLifecycleState(record, "suspended");
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
      const timeoutMs = record.manifest.sandbox.timeoutMs;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const promise = Promise.resolve().then(runner);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          clearTimeout(timer);
          timer = undefined;
          reject(new ValidationError("plugin_spi.timeout", `Plugin ${record.manifest.pluginId} timed out during ${phase}.`, {
            category: "validation",
            source: "internal",
            details: { pluginId: record.manifest.pluginId, phase, timeoutMs },
          }));
        }, timeoutMs);
      });
      try {
        return await Promise.race([promise, timeoutPromise]);
      } catch (error) {
        // Clean up timer if still active (runner completed before timeout)
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }
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
      if (record.lifecycleState === "registered" || record.lifecycleState === "unloaded") {
        await this.runLifecycle(record, "load", context, async () => {
          if (this.isProcessIsolatedRuntime(record)) {
            await this.invokeForkedRuntime<void>(record, "load", context);
          } else if (record.plugin.onLoad) {
            await record.plugin.onLoad(context);
          } else if (record.plugin.initialize) {
            await record.plugin.initialize();
          }
        });
        this.setLifecycleState(record, "loading");
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
          throw new ValidationError("plugin_spi.unhealthy_plugin", "Plugin health check failed during activation.", {
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
    if (namespace == null || policy.allowedKnowledgeNamespaces.length === 0) {
      return;
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
    if (policy.allowNetworkEgress) {
      return;
    }
    throw new ValidationError("plugin_spi.network_denied", `plugin_spi.network_denied: Plugin ${pluginId} cannot use network egress during ${phase}.`, {
      category: "validation",
      source: "internal",
      details: { pluginId, phase },
    });
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
    if (record.manifest.sandbox.cooldownMs > 0) {
      record.cooldownUntil = new Date(Date.now() + record.manifest.sandbox.cooldownMs).toISOString();
    }
    // §198-2318: Root cause - off-by-one error: >= maxConsecutiveFailures means
    // plugin is disabled after 3rd failure when max=3, but spec requires disabling AFTER 4th.
    // With maxConsecutiveFailures=3: failureCount goes 1,2,3 - at 3>=3 plugin is disabled.
    // But spec says "disable after 4 consecutive failures" means count should be 4.
    // Fix: Use > instead of >= so plugin is disabled on the failure AFTER the threshold.
    if (record.failureCount > this.maxConsecutiveFailures) {
      record.disabledReason = phase;
      this.setLifecycleState(record, "disabled");
    } else {
      this.setLifecycleState(record, "suspended");
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
      if (record.lifecycleState === "suspended") {
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
    await new Promise<void>((resolve) => {
      const waiters = this.invocationWaiters.get(record.manifest.pluginId) ?? [];
      waiters.push(() => {
        record.queuedInvocationCount = Math.max(0, record.queuedInvocationCount - 1);
        record.activeInvocationCount += 1;
        resolve();
      });
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
        phase, // R23-57 FIX: phase field required by PluginIsolationEventPayload
        lifecycleState: record.lifecycleState,
        bindingId: context.bindingId,
        occurredAt: nowIso(),
        reasonCode: error instanceof ValidationError ? error.code : phase,
        errorMessage: error instanceof Error ? error.message : String(error),
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
