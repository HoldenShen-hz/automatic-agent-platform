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

  private static readonly DEFAULT_CIRCUIT_BREAKER_OPTIONS = {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    resetTimeout: 60000,
  };

  public constructor(
    storageDir: string | null = null,
    maxBindingAgeMs = 30 * 24 * 60 * 60 * 1000,
    healthRetentionCount = 100,
  ) {
    this.storageDir = storageDir;
    this.maxBindingAgeMs = maxBindingAgeMs;
    this.healthRetentionCount = healthRetentionCount;
    if (this.storageDir != null) {
      this.load();
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
    this.bindings.set(connectorId, [...filtered, binding]);
    this.persist();
    return binding;
  }

  public recordHealth(report: ConnectorHealthReport): ConnectorHealthReport {
    this.requireManifest(report.connectorId);
    // Keep at most healthRetentionCount newest reports
    const existing = this.health.get(report.connectorId) ?? [];
    const updated = [...existing, report].slice(-this.healthRetentionCount);
    this.health.set(report.connectorId, updated);
    this.persist();
    return report;
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
      result = await circuitBreaker.execute(() => Promise.resolve(connectorInstance.execute(normalizedRequest)));
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
    const enabledIds = new Set(listEnabledConnectors([...this.manifests.values()]).map((item) => item.connectorId));
    return [...this.manifests.values()].filter((item) => enabledIds.has(item.connectorId));
  }

  public getManifest(connectorId: string): RegisteredConnectorManifest | null {
    return this.manifests.get(connectorId) ?? null;
  }

  public listBindings(options: {
    connectorId?: string;
    tenantId?: string;
    environment?: ConnectorBinding["environment"];
  } = {}): ConnectorBinding[] {
    const allBindings = [...this.bindings.values()].flatMap((items) => items);
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
    } catch {
      // Ignore corrupt file — start empty
    }
  }

  private loadBindings(): void {
    const path = this.bindingsPath();
    if (!existsSync(path)) return;
    try {
      const raw = readFileSync(path, "utf-8");
      const entries = JSON.parse(raw) as Array<[string, ConnectorBinding[]]>;
      for (const [connectorId, bindings] of entries) {
        this.bindings.set(connectorId, bindings);
      }
    } catch {
      // Ignore corrupt file — start empty
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
    } catch {
      // Ignore corrupt file — start empty
    }
  }

  private persistManifests(): void {
    const path = this.manifestsPath();
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify([...this.manifests.entries()]), "utf-8");
  }

  private persistBindings(): void {
    const path = this.bindingsPath();
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify([...this.bindings.entries()]), "utf-8");
  }

  private persistHealth(): void {
    const path = this.healthPath();
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify([...this.health.entries()]), "utf-8");
  }
}
