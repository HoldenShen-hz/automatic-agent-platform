/**
 * @fileoverview Plugin Context - Runtime context injection
 *
 * Implements §22.4 Plugin lifecycle: PluginContext for runtime context injection.
 */

import { normalizeSandboxMode, type SandboxMode, type SandboxModeLike } from "../../platform/five-plane-control-plane/iam/sandbox-policy.js";

export interface PluginContextConfig {
  pluginId: string;
  packId?: string;
  executionId?: string;
  taskId?: string;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  sandboxTier?: SandboxModeLike;
  /** R2-11: Call depth tracking for nested plugin invocations */
  callDepth?: number;
  /** R2-11: Delegation depth for plugin-to-plugin delegation chain */
  delegationDepth?: number;
  resourceLimits?: {
    maxMemoryMb?: number;
    maxCpuMs?: number;
    maxDurationMs?: number;
  };
}

type NormalizedPluginContextConfig = Omit<Required<PluginContextConfig>, "sandboxTier"> & {
  sandboxTier: SandboxMode;
  callDepth: number;
  delegationDepth: number;
};

export interface ContextValue {
  key: string;
  value: unknown;
  timestamp: string;
  source: "system" | "plugin" | "pack" | "user";
}

/**
 * PluginContext provides runtime context to plugins during execution.
 * Plugins receive injected context without needing to fetch it themselves.
 */
export class PluginContext {
  private static readonly protectedSystemKeys = new Set([
    "system.plugin_id",
    "system.timestamp",
    "system.call_depth",
    "system.delegation_depth",
  ]);

  private readonly values: Map<string, ContextValue> = new Map();
  private readonly config: NormalizedPluginContextConfig;

  constructor(config: PluginContextConfig) {
    if (!config.pluginId?.trim()) {
      throw new Error("PluginContext requires pluginId");
    }
    this.config = {
      pluginId: config.pluginId,
      packId: config.packId ?? "unknown",
      executionId: config.executionId ?? "unknown",
      taskId: config.taskId ?? "unknown",
      tenantId: config.tenantId ?? "default",
      userId: config.userId ?? "anonymous",
      sessionId: config.sessionId ?? "none",
      callDepth: config.callDepth ?? 0,
      delegationDepth: config.delegationDepth ?? 0,
      sandboxTier: normalizeSandboxMode(config.sandboxTier),
      resourceLimits: config.resourceLimits ?? {},
    };

    // Initialize with system context
    this.setValue("system.plugin_id", config.pluginId, "system", { allowProtectedSystemKey: true });
    this.setValue("system.timestamp", new Date().toISOString(), "system", { allowProtectedSystemKey: true });
    this.setValue("system.call_depth", this.config.callDepth, "system", { allowProtectedSystemKey: true });
    this.setValue("system.delegation_depth", this.config.delegationDepth, "system", { allowProtectedSystemKey: true });
  }

  /**
   * Get the plugin ID.
   */
  get pluginId(): string {
    return this.config.pluginId;
  }

  /**
   * Get the current execution ID.
   */
  get executionId(): string {
    return this.config.executionId;
  }

  /**
   * Get the current task ID.
   */
  get taskId(): string {
    return this.config.taskId;
  }

  /**
   * Get the tenant ID.
   */
  get tenantId(): string {
    return this.config.tenantId;
  }

  /**
   * Get the user ID.
   */
  get userId(): string {
    return this.config.userId;
  }

  /**
   * Get the current session ID.
   */
  get sessionId(): string {
    return this.config.sessionId;
  }

  /**
   * Get the sandbox tier.
   */
  get sandboxTier(): SandboxMode {
    return this.config.sandboxTier;
  }

  /**
   * R2-11: Get the current call depth for nested plugin invocations.
   */
  get callDepth(): number {
    return this.config.callDepth;
  }

  /**
   * R2-11: Get the current delegation depth for plugin-to-plugin delegation.
   */
  get delegationDepth(): number {
    return this.config.delegationDepth;
  }

  /**
   * Get a context value by key.
   */
  get(key: string): unknown {
    const entry = this.values.get(key);
    return entry?.value;
  }

  /**
   * Set a context value.
   */
  set(key: string, value: unknown, source: ContextValue["source"] = "plugin"): void {
    this.setValue(key, value, source);
  }

  /**
   * Set multiple context values.
   */
  setValues(entries: Record<string, unknown>, source: ContextValue["source"] = "plugin"): void {
    for (const [key, value] of Object.entries(entries)) {
      this.setValue(key, value, source);
    }
  }

  /**
   * Get all context keys.
   */
  keys(): string[] {
    return Array.from(this.values.keys());
  }

  /**
   * Check if a key exists.
   */
  has(key: string): boolean {
    return this.values.has(key);
  }

  /**
   * Get resource limits.
   */
  getResourceLimits(): Required<NonNullable<PluginContextConfig["resourceLimits"]>> {
    return {
      maxMemoryMb: this.config.resourceLimits.maxMemoryMb ?? 512,
      maxCpuMs: this.config.resourceLimits.maxCpuMs ?? 5000,
      maxDurationMs: this.config.resourceLimits.maxDurationMs ?? 30000,
    };
  }

  /**
   * Create a child context for sub-execution.
   * R2-11: Forks automatically increment callDepth; delegationDepth increments on explicit delegation.
   */
  fork(overrides: Partial<PluginContextConfig>): PluginContext {
    return new PluginContext({
      pluginId: this.config.pluginId,
      packId: overrides.packId ?? this.config.packId,
      executionId: overrides.executionId ?? this.config.executionId,
      taskId: overrides.taskId ?? this.config.taskId,
      tenantId: overrides.tenantId ?? this.config.tenantId,
      userId: overrides.userId ?? this.config.userId,
      sessionId: overrides.sessionId ?? this.config.sessionId,
      callDepth: overrides.callDepth ?? (this.config.callDepth + 1),
      delegationDepth: overrides.delegationDepth ?? this.config.delegationDepth,
      sandboxTier: overrides.sandboxTier ?? this.config.sandboxTier,
      resourceLimits: overrides.resourceLimits ?? this.config.resourceLimits,
    });
  }

  /**
   * Create a child context for explicit plugin delegation.
   */
  forkForDelegation(overrides: Partial<PluginContextConfig> = {}): PluginContext {
    return new PluginContext({
      pluginId: this.config.pluginId,
      packId: overrides.packId ?? this.config.packId,
      executionId: overrides.executionId ?? this.config.executionId,
      taskId: overrides.taskId ?? this.config.taskId,
      tenantId: overrides.tenantId ?? this.config.tenantId,
      userId: overrides.userId ?? this.config.userId,
      sessionId: overrides.sessionId ?? this.config.sessionId,
      callDepth: overrides.callDepth ?? this.config.callDepth,
      delegationDepth: overrides.delegationDepth ?? (this.config.delegationDepth + 1),
      sandboxTier: overrides.sandboxTier ?? this.config.sandboxTier,
      resourceLimits: overrides.resourceLimits ?? this.config.resourceLimits,
    });
  }

  /**
   * Check whether the call depth has reached the configured limit.
   */
  isCallDepthExceeded(maxDepth: number): boolean {
    return this.config.callDepth >= maxDepth;
  }

  /**
   * Check whether the delegation depth has reached the configured limit.
   */
  isDelegationDepthExceeded(maxDepth: number): boolean {
    return this.config.delegationDepth >= maxDepth;
  }

  /**
   * Get all values as a plain object.
   */
  toRecord(): Record<string, unknown> {
    const record: Record<string, unknown> = {};
    for (const [key, entry] of this.values.entries()) {
      record[key] = entry.value;
    }
    return record;
  }

  private setValue(
    key: string,
    value: unknown,
    _source: ContextValue["source"],
    options: { allowProtectedSystemKey?: boolean } = {},
  ): void {
    if (PluginContext.protectedSystemKeys.has(key) && !options.allowProtectedSystemKey) {
      throw new Error(`PluginContext forbids setting reserved key namespace: ${key}`);
    }
    this.values.set(key, {
      key,
      value,
      timestamp: new Date().toISOString(),
      source: _source,
    });
  }
}
