import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { CircuitBreaker } from "../../platform/stability/circuit-breaker.js";
import { GitHubConnector } from "./connectors/github-connector.js";
import { JiraConnector } from "./connectors/jira-connector.js";
import { ServiceNowConnector } from "./connectors/servicenow-connector.js";
import { SlackConnector } from "./connectors/slack-connector.js";
import {
  ConnectorManifestSchema,
  listEnabledConnectors,
  type ConnectorManifest,
  type NormalizedConnectorManifest,
} from "./connector-registry/index.js";
import {
  buildConnectorExecutionKey,
  ConnectorExecutionRequestSchema,
  invokeCallback,
  type ConnectorExecutionRequest,
  type ConnectorExecutionResult,
} from "./connector-runtime/index.js";
import {
  summarizeConnectorHealth,
  type ConnectorHealthReport,
} from "./health-monitor/index.js";

export interface ConnectorBinding {
  readonly bindingId: string;
  readonly connectorId: string;
  readonly tenantId: string;
  readonly environment: "dev" | "staging" | "prod";
  readonly boundAt: string;
}

export type RegisteredConnectorManifest = NormalizedConnectorManifest;
type ConnectorExecutor = {
  execute(request: ConnectorExecutionRequest): Promise<ConnectorExecutionResult> | ConnectorExecutionResult;
};

export interface ConnectorFrameworkServiceOptions {
  readonly storageDir?: string | null;
  readonly maxBindingAgeMs?: number;
  readonly healthRetentionCount?: number;
  readonly maxBindings?: number;
  readonly maxHealthConnectors?: number;
  readonly executors?: Readonly<Record<string, (request: ConnectorExecutionRequest) => Promise<ConnectorExecutionResult> | ConnectorExecutionResult>>;
}

/**
 * R20-51 FIX: manifests and bindings are stored in in-memory Maps.
 * There is no persistence layer - all registered connectors and bindings
 * are lost on process restart. A durable storage adapter (e.g., truth store)
 * must be introduced to persist these across restarts.
 *
 * FIX APPLIED: File-based persistence via JSON files in a configurable storage directory.
 * Manifests are persisted to {storageDir}/connector-manifests.json
 * Bindings are persisted to {storageDir}/connector-bindings.json
 * Health reports are persisted to {storageDir}/connector-health.json
 */
export class ConnectorFrameworkService {
  private readonly manifests = new Map<string, RegisteredConnectorManifest>();
  private readonly bindings = new Map<string, ConnectorBinding[]>();
  private readonly health = new Map<string, ConnectorHealthReport[]>();
  private readonly connectorInstances = new Map<string, ConnectorExecutor>();
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly storageDir: string | null;
  /** Evict bindings older than this (default 30 days in ms). */
  private readonly maxBindingAgeMs: number;
  /** Retain at most this many health reports per connector (default 100). */
  private readonly healthRetentionCount: number;
  /** Maximum number of connector bindings to retain total (LRU eviction). */
  private readonly maxBindings: number;
  /** Maximum number of connectors with health reports (LRU eviction). */
  private readonly maxHealthConnectors: number;
  /** LRU tracking for bindings map entries (connectorId -> true when accessed). */
  private readonly bindingsLRU = new Set<string>();
  /** LRU tracking for health map entries. */
  private readonly healthLRU = new Set<string>();

  private static readonly DEFAULT_CIRCUIT_BREAKER_OPTIONS = {
    failureThreshold: 5,
    successThreshold: 1,
    timeout: 30000,
    resetTimeout: 30000,
  };

  public constructor(
    storageDirOrOptions: string | ConnectorFrameworkServiceOptions | null = null,
    maxBindingAgeMs = 30 * 24 * 60 * 60 * 1000,
    healthRetentionCount = 100,
    maxBindings = 10_000,
    maxHealthConnectors = 1_000,
  ) {
    const options = typeof storageDirOrOptions === "object" && storageDirOrOptions !== null
      ? storageDirOrOptions
      : null;
    if (options != null) {
      this.storageDir = options.storageDir ?? null;
    } else {
      this.storageDir = typeof storageDirOrOptions === "string" ? storageDirOrOptions : null;
    }
    this.maxBindingAgeMs = options?.maxBindingAgeMs ?? maxBindingAgeMs;
    this.healthRetentionCount = options?.healthRetentionCount ?? healthRetentionCount;
    this.maxBindings = options?.maxBindings ?? maxBindings;
    this.maxHealthConnectors = options?.maxHealthConnectors ?? maxHealthConnectors;
    if (this.storageDir != null) {
      this.load();
    }
    for (const [connectorId, executor] of Object.entries(options?.executors ?? {})) {
      this.registerConnectorInstance(connectorId, { execute: executor });
    }
  }

  public register(manifest: ConnectorManifest): RegisteredConnectorManifest {
    const parsed = ConnectorManifestSchema.parse(manifest) as RegisteredConnectorManifest;
    this.manifests.set(parsed.connectorId, parsed);
    this.registerBuiltInConnectorInstance(parsed);
    this.persist();
    return parsed;
  }

  public bind(connectorId: string, tenantId: string, environment: ConnectorBinding["environment"], boundAt = nowIso()): ConnectorBinding {
    const manifest = this.requireManifest(connectorId);
    if (environment === "prod" && manifest.lifecycleState !== "verified" && manifest.lifecycleState !== "enabled") {
      throw new Error(`connector_framework.prod_requires_verified:${connectorId}`);
    }
    const binding: ConnectorBinding = {
      bindingId: newId("connector_binding"),
      connectorId,
      tenantId,
      environment,
      boundAt,
    };
    // Evict bindings older than maxBindingAgeMs
    const cutoff = Date.now() - this.maxBindingAgeMs;
    const existing = this.bindings.get(connectorId) ?? [];
    const filtered = existing.filter((b) => new Date(b.boundAt).getTime() >= cutoff);
    const updated = [...filtered, binding];

    this.bindings.set(connectorId, updated);

    // Evict LRU connectors' bindings until under capacity
    let totalBindings = Array.from(this.bindings.values()).reduce((sum, arr) => sum + arr.length, 0);
    while (totalBindings > this.maxBindings) {
      const excess = totalBindings - this.maxBindings;
      this.evictLRUBindings(excess);
      // Recalculate after eviction
      totalBindings = Array.from(this.bindings.values()).reduce((sum, arr) => sum + arr.length, 0);
      // Safety guard: if no progress, break to avoid infinite loop
      if (totalBindings > this.maxBindings) {
        const prevTotal = totalBindings;
        this.evictLRUBindings(prevTotal - this.maxBindings);
        totalBindings = Array.from(this.bindings.values()).reduce((sum, arr) => sum + arr.length, 0);
        if (totalBindings >= prevTotal) break;
      }
    }

    // Mark this connectorId as most recently used
    this.bindingsLRU.delete(connectorId);
    this.bindingsLRU.add(connectorId);
    this.persist();
    return binding;
  }

  /**
   * Evict the least-recently-used connector's bindings until the given number of
   * bindings have been removed. Iterates LRU set from oldest (first) to newest (last).
   * Removes entire connector entries at once when possible.
   */
  private evictLRUBindings(count: number): void {
    let removed = 0;
    for (const connectorId of Array.from(this.bindingsLRU)) {
      if (removed >= count) break;
      const bindings = this.bindings.get(connectorId);
      if (bindings != null && bindings.length > 0) {
        // If removing all bindings would not overshoot, remove all
        // Otherwise, just remove enough from this connector to meet the count
        if (bindings.length <= count - removed) {
          // Remove all bindings for this connector
          this.bindings.delete(connectorId);
          this.bindingsLRU.delete(connectorId);
          removed += bindings.length;
        } else {
          // Partial removal: remove only what we need from this connector
          const toRemove = count - removed;
          this.bindings.set(connectorId, bindings.slice(toRemove));
          removed += toRemove;
          // Note: we do NOT update bindingsLRU here since partial removal doesn't change LRU order
          // (the connector remains at its current position in LRU order)
        }
      }
    }
  }

  public recordHealth(report: ConnectorHealthReport): ConnectorHealthReport {
    this.requireManifest(report.connectorId);
    // Keep at most healthRetentionCount newest reports
    const existing = this.health.get(report.connectorId) ?? [];
    const updated = [...existing, report].slice(-this.healthRetentionCount);

    // Evict LRU health entries if at capacity
    if (!this.health.has(report.connectorId) && this.health.size >= this.maxHealthConnectors) {
      this.evictLRUHealth();
    }

    this.health.set(report.connectorId, updated);
    // Mark this connectorId as most recently used
    this.healthLRU.delete(report.connectorId);
    this.healthLRU.add(report.connectorId);
    this.persist();
    return report;
  }

  /**
   * Evict the least-recently-used health entries until under capacity.
   */
  private evictLRUHealth(): void {
    while (this.health.size >= this.maxHealthConnectors) {
      const oldest = this.healthLRU.values().next().value;
      if (oldest == null) break;
      this.health.delete(oldest);
      this.healthLRU.delete(oldest);
    }
  }

  public registerConnectorInstance(connectorId: string, instance: ConnectorExecutor): void {
    this.connectorInstances.set(connectorId, instance);
    if (!this.circuitBreakers.has(connectorId)) {
      this.circuitBreakers.set(connectorId, new CircuitBreaker(ConnectorFrameworkService.DEFAULT_CIRCUIT_BREAKER_OPTIONS));
    }
  }

  /**
   * R20-50 FIX: execute() now invokes the registered connector instance (if any) and
   * delivers the result to a callback URL if one is provided in the request.
   * The four first-party connectors (GitHub, Slack, Jira, ServiceNow) have their
   * execute() methods called through the registered connector instance.
   * If no connector instance is registered, a stub result is returned.
   *
   * R21-03 FIX: execute() is now async and uses CircuitBreaker to handle connector
   * failures gracefully. If a connector's circuit is open, calls are rejected fast.
   */
  public async execute(
    request: ConnectorExecutionRequest,
    options: {
      readonly environment: "dev" | "staging" | "prod";
      readonly eventType?: string;
      readonly executedAt?: string;
    },
  ): Promise<ConnectorExecutionResult & { readonly executionKey: string; readonly executedAt: string }> {
    const normalizedRequest = ConnectorExecutionRequestSchema.parse(request);
    const manifest = this.requireManifest(normalizedRequest.connectorId);
    const executionKey = buildConnectorExecutionKey(normalizedRequest);
    if (options.environment === "prod" && manifest.lifecycleState !== "verified" && manifest.lifecycleState !== "enabled") {
      throw new Error(`connector_framework.prod_requires_verified:${normalizedRequest.connectorId}`);
    }
    if (normalizedRequest.secretBindings.length === 0 || normalizedRequest.policyRef == null) {
      const stubResult: ConnectorExecutionResult = {
        connectorId: normalizedRequest.connectorId,
        success: false,
        status: "failed",
      };
      if (normalizedRequest.callbackUrl != null) {
        invokeCallback(normalizedRequest.callbackUrl, stubResult);
      }
      return {
        ...stubResult,
        executionKey,
        executedAt: options.executedAt ?? nowIso(),
      };
    }
    if (options.eventType != null && !manifest.supportedEvents.includes(options.eventType)) {
      const stubResult: ConnectorExecutionResult = {
        connectorId: normalizedRequest.connectorId,
        success: false,
        status: "failed",
      };
      if (normalizedRequest.callbackUrl != null) {
        invokeCallback(normalizedRequest.callbackUrl, stubResult);
      }
      return {
        ...stubResult,
        executionKey,
        executedAt: options.executedAt ?? nowIso(),
      };
    }

    const reports = this.health.get(normalizedRequest.connectorId) ?? [];
    const health = summarizeConnectorHealth(reports);
    if (health === "failed") {
      const stubResult: ConnectorExecutionResult = {
        connectorId: normalizedRequest.connectorId,
        success: false,
        status: "failed",
      };
      if (normalizedRequest.callbackUrl != null) {
        invokeCallback(normalizedRequest.callbackUrl, stubResult);
      }
      return {
        ...stubResult,
        executionKey,
        executedAt: options.executedAt ?? nowIso(),
      };
    }

    const circuitBreaker = this.circuitBreakers.get(normalizedRequest.connectorId);
    const connectorInstance = this.connectorInstances.get(normalizedRequest.connectorId);
    let result: ConnectorExecutionResult;
    if (connectorInstance != null && circuitBreaker != null) {
      try {
        result = await circuitBreaker.execute(async () => {
          const executionResult = await Promise.resolve(connectorInstance.execute(normalizedRequest));
          if (!executionResult.success) {
            throw new Error(`connector_framework.execution_failed:${normalizedRequest.connectorId}`);
          }
          return executionResult;
        });
      } catch {
        result = {
          connectorId: normalizedRequest.connectorId,
          success: false,
          status: "failed",
        };
      }
    } else {
      result = {
        connectorId: normalizedRequest.connectorId,
        success: true,
        status: health === "degraded" ? "deferred" : "succeeded",
      };
    }

    if (normalizedRequest.callbackUrl != null) {
      invokeCallback(normalizedRequest.callbackUrl, result);
    }

    return { ...result, executionKey, executedAt: options.executedAt ?? nowIso() };
  }

  public listEnabled(): RegisteredConnectorManifest[] {
    const enabledIds = new Set(listEnabledConnectors(Array.from(this.manifests.values())).map((item) => item.connectorId));
    return Array.from(this.manifests.values()).filter((item) => enabledIds.has(item.connectorId));
  }

  public getManifest(connectorId: string): RegisteredConnectorManifest | null {
    return this.manifests.get(connectorId) ?? null;
  }

  public listBindings(options: {
    connectorId?: string;
    tenantId?: string;
    environment?: ConnectorBinding["environment"];
  } = {}): ConnectorBinding[] {
    const allBindings = Array.from(this.bindings.values()).flatMap((items) => items);
    return allBindings.filter((binding) => {
      if (options.connectorId != null && binding.connectorId !== options.connectorId) {
        return false;
      }
      if (options.tenantId != null && binding.tenantId !== options.tenantId) {
        return false;
      }
      if (options.environment != null && binding.environment !== options.environment) {
        return false;
      }
      return true;
    });
  }

  private requireManifest(connectorId: string): RegisteredConnectorManifest {
    const manifest = this.manifests.get(connectorId);
    if (manifest == null) {
      throw new Error(`connector_framework.connector_not_found:${connectorId}`);
    }
    return manifest;
  }

  private registerBuiltInConnectorInstance(manifest: RegisteredConnectorManifest): void {
    if (this.connectorInstances.has(manifest.connectorId)) {
      return;
    }
    const instance = this.createBuiltInConnectorInstance(manifest);
    if (instance != null) {
      this.registerConnectorInstance(manifest.connectorId, instance);
    }
  }

  /**
   * R20-50 FIX: known first-party connectors are auto-wired to their concrete
   * connector implementations instead of falling back to generic stub results.
   */
  private createBuiltInConnectorInstance(manifest: RegisteredConnectorManifest): ConnectorExecutor | null {
    switch (manifest.provider.trim().toLowerCase()) {
      case "github": {
        const connector = new GitHubConnector();
        return { execute: async (request) => connector.execute(request) };
      }
      case "slack": {
        const connector = new SlackConnector();
        return { execute: async (request) => connector.execute(request) };
      }
      case "jira": {
        const connector = new JiraConnector();
        return { execute: async (request) => connector.execute(request) };
      }
      case "servicenow":
      case "service-now":
      case "service_now": {
        const connector = new ServiceNowConnector();
        return { execute: async (request) => connector.execute(request) };
      }
      default:
        return null;
    }
  }

  private load(): void {
    this.loadManifests();
    this.loadBindings();
    this.loadHealth();
  }

  private persist(): void {
    if (this.storageDir == null) return;
    this.persistManifests();
    this.persistBindings();
    this.persistHealth();
  }

  private manifestsPath(): string {
    return join(this.storageDir!, "connector-manifests.json");
  }

  private bindingsPath(): string {
    return join(this.storageDir!, "connector-bindings.json");
  }

  private healthPath(): string {
    return join(this.storageDir!, "connector-health.json");
  }

  private loadManifests(): void {
    const path = this.manifestsPath();
    if (!existsSync(path)) return;
    try {
      const raw = readFileSync(path, "utf-8");
      const entries = JSON.parse(raw) as Array<[string, RegisteredConnectorManifest]>;
      for (const [id, manifest] of entries) {
        this.manifests.set(id, manifest);
        this.registerBuiltInConnectorInstance(manifest);
      }
    } catch (error) {
      process.stderr.write(`connector_framework.load_manifests_failed:${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  private loadBindings(): void {
    const path = this.bindingsPath();
    if (!existsSync(path)) return;
    try {
      const raw = readFileSync(path, "utf-8");
      const entries = JSON.parse(raw) as Array<[string, ConnectorBinding[]]>;
      const cutoff = Date.now() - this.maxBindingAgeMs;
      for (const [connectorId, bindings] of entries) {
        // Apply age-based eviction on load to prevent unbounded growth from persisted data
        const filtered = bindings.filter((b) => new Date(b.boundAt).getTime() >= cutoff);
        if (filtered.length > 0) {
          this.bindings.set(connectorId, filtered);
        }
      }
    } catch (error) {
      process.stderr.write(`connector_framework.load_bindings_failed:${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  private loadHealth(): void {
    const path = this.healthPath();
    if (!existsSync(path)) return;
    try {
      const raw = readFileSync(path, "utf-8");
      const entries = JSON.parse(raw) as Array<[string, ConnectorHealthReport[]]>;
      for (const [connectorId, reports] of entries) {
        this.health.set(connectorId, reports);
      }
    } catch (error) {
      process.stderr.write(`connector_framework.load_health_failed:${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  private persistManifests(): void {
    const path = this.manifestsPath();
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(Array.from(this.manifests.entries())), "utf-8");
  }

  private persistBindings(): void {
    const path = this.bindingsPath();
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(Array.from(this.bindings.entries())), "utf-8");
  }

  private persistHealth(): void {
    const path = this.healthPath();
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify(Array.from(this.health.entries())), "utf-8");
  }
}
