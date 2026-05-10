import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import {
  ConnectorManifestSchema,
  listEnabledConnectors,
  type ConnectorManifest,
  type NormalizedConnectorManifest,
} from "./connector-registry/index.js";
import {
  buildConnectorExecutionKey,
  ConnectorExecutionRequestSchema,
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

/**
 * R20-51 FIX: manifests and bindings are stored in in-memory Maps.
 * There is no persistence layer - all registered connectors and bindings
 * are lost on process restart. A durable storage adapter (e.g., truth store)
 * must be introduced to persist these across restarts.
 */
export class ConnectorFrameworkService {
  private readonly manifests = new Map<string, RegisteredConnectorManifest>();
  private readonly bindings = new Map<string, ConnectorBinding[]>();
  private readonly health = new Map<string, ConnectorHealthReport[]>();

  public register(manifest: ConnectorManifest): RegisteredConnectorManifest {
    const parsed = ConnectorManifestSchema.parse(manifest) as RegisteredConnectorManifest;
    this.manifests.set(parsed.connectorId, parsed);
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
    this.bindings.set(connectorId, [...(this.bindings.get(connectorId) ?? []), binding]);
    return binding;
  }

  public recordHealth(report: ConnectorHealthReport): ConnectorHealthReport {
    this.requireManifest(report.connectorId);
    this.health.set(report.connectorId, [...(this.health.get(report.connectorId) ?? []), report]);
    return report;
  }

  /**
   * R20-50 FIX: execute() currently validates inputs and checks health but does NOT
   * invoke any connector. The four first-party connectors (GitHub, Slack, Jira, ServiceNow)
   * have execute() methods that are never called here. A real callback/webhook path
   * must be wired through connector-runtime so external systems can deliver results.
   *
   * Current stub behavior: returns {success: true, status: "succeeded"|"deferred"}
   * based solely on health, secretBindings, policyRef, and supportedEvents checks.
   */
  public execute(
    request: ConnectorExecutionRequest,
    options: {
      readonly environment: "dev" | "staging" | "prod";
      readonly eventType?: string;
      readonly executedAt?: string;
    },
  ): ConnectorExecutionResult & { readonly executionKey: string; readonly executedAt: string } {
    const normalizedRequest = ConnectorExecutionRequestSchema.parse(request);
    const manifest = this.requireManifest(normalizedRequest.connectorId);
    const executionKey = buildConnectorExecutionKey(normalizedRequest);
    if (options.environment === "prod" && manifest.lifecycleState !== "verified" && manifest.lifecycleState !== "enabled") {
      throw new Error(`connector_framework.prod_requires_verified:${normalizedRequest.connectorId}`);
    }
    if (normalizedRequest.secretBindings.length === 0 || normalizedRequest.policyRef == null) {
      return {
        connectorId: normalizedRequest.connectorId,
        success: false,
        status: "failed",
        executionKey,
        executedAt: options.executedAt ?? nowIso(),
      };
    }
    if (options.eventType != null && !manifest.supportedEvents.includes(options.eventType)) {
      return {
        connectorId: normalizedRequest.connectorId,
        success: false,
        status: "failed",
        executionKey,
        executedAt: options.executedAt ?? nowIso(),
      };
    }

    const reports = this.health.get(normalizedRequest.connectorId) ?? [];
    const health = summarizeConnectorHealth(reports);
    if (health === "failed") {
      return {
        connectorId: normalizedRequest.connectorId,
        success: false,
        status: "failed",
        executionKey,
        executedAt: options.executedAt ?? nowIso(),
      };
    }

    return {
      connectorId: normalizedRequest.connectorId,
      success: true,
      status: health === "degraded" ? "deferred" : "succeeded",
      executionKey,
      executedAt: options.executedAt ?? nowIso(),
    };
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
}
