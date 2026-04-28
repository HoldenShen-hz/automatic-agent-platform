/**
 * @fileoverview Plugin Context - Runtime context injection
 *
 * Implements §22.4 Plugin lifecycle: PluginContext for runtime context injection.
 */

import { normalizeSandboxMode, type SandboxMode } from "../../platform/control-plane/iam/sandbox-policy.js";

export interface PluginContextConfig {
  pluginId: string;
  packId?: string;
  executionId?: string;
  taskId?: string;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  sandboxTier?: string;
  /** §23.2: Call depth tracking to prevent infinite recursion */
  callDepth?: number;
  /** §23.2: Delegation depth tracking to prevent infinite plugin delegation */
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
      sandboxTier: normalizeSandboxMode(config.sandboxTier),
      callDepth: config.callDepth ?? 0,
      delegationDepth: config.delegationDepth ?? 0,
      resourceLimits: config.resourceLimits ?? {},
    };

    // Initialize with system context
    this.setValue("system.plugin_id", config.pluginId, "system");
    this.setValue("system.timestamp", new Date().toISOString(), "system");
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
   * Get the sandbox tier.
   */
  get sandboxTier(): SandboxMode {
    return this.config.sandboxTier;
  }

  /**
   * Get the call depth.
   * §23.2: Used to prevent infinite plugin call recursion
   */
  get callDepth(): number {
    return this.config.callDepth;
  }

  /**
   * Get the delegation depth.
   * §23.2: Used to prevent infinite plugin delegation recursion
   */
  get delegationDepth(): number {
    return this.config.delegationDepth;
  }

  /**
   * Check if the current call depth exceeds the maximum allowed.
   * §23.2: Prevents infinite recursion attacks
   */
  isCallDepthExceeded(maxDepth: number): boolean {
    return this.config.callDepth >= maxDepth;
  }

  /**
   * Check if the current delegation depth exceeds the maximum allowed.
   * §23.2: Prevents infinite delegation recursion
   */
  isDelegationDepthExceeded(maxDepth: number): boolean {
    return this.config.delegationDepth >= maxDepth;
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
   * §23.2: Increments call and delegation depth to track recursion
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
      sandboxTier: overrides.sandboxTier ?? this.config.sandboxTier,
      callDepth: overrides.callDepth ?? this.config.callDepth + 1,
      delegationDepth: overrides.delegationDepth ?? this.config.delegationDepth,
      resourceLimits: overrides.resourceLimits ?? this.config.resourceLimits,
    });
  }

  /**
   * Create a delegation context for forwarding to another plugin.
   * §23.2: Increments delegation depth to track cross-plugin delegation
   */
  forkForDelegation(): PluginContext {
    return new PluginContext({
      pluginId: this.config.pluginId,
      packId: this.config.packId,
      executionId: this.config.executionId,
      taskId: this.config.taskId,
      tenantId: this.config.tenantId,
      userId: this.config.userId,
      sessionId: this.config.sessionId,
      sandboxTier: this.config.sandboxTier,
      callDepth: this.config.callDepth,
      delegationDepth: this.config.delegationDepth + 1,
      resourceLimits: this.config.resourceLimits,
    });
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

  private setValue(key: string, value: unknown, source: ContextValue["source"]): void {
    this.values.set(key, {
      key,
      value,
      timestamp: new Date().toISOString(),
      source,
    });
  }
}
