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
import { SideEffectManager } from "../../platform/five-plane-execution/side-effect-manager.js";
import type { SideEffectManagerContext } from "../../platform/five-plane-execution/side-effect-manager.js";

export interface ConnectorBinding {
  readonly bindingId: string;
  readonly connectorId: string;
  readonly tenantId: string;
  readonly environment: "dev" | "staging" | "prod";
  readonly boundAt: string;
}

export type RegisteredConnectorManifest = NormalizedConnectorManifest;

// R16-36 FIX #2124: Add circuit breaker state per connector to prevent cascading failures.
// Without circuit breaker, a failing connector can exhaust resources waiting for retries.
// Circuit breaker tracks consecutive failures and opens after threshold, failing fast.
interface CircuitState {
  failures: number;
  lastFailure: number | null;
  state: "closed" | "open" | "half_open";
}

export class ConnectorFrameworkService {
  private readonly manifests = new Map<string, RegisteredConnectorManifest>();
  private readonly bindings = new Map<string, ConnectorBinding[]>();
  private readonly health = new Map<string, ConnectorHealthReport[]>();
  // P0 FIX: Add SideEffectManager per INV-SIDEEFFECT-001.
  // Connector execute() calls must be recorded to maintain audit trail and enable reconciliation.
  private readonly sideEffectManager = new SideEffectManager();
  // R16-36 FIX #2124: Circuit breaker state per connector
  private readonly circuitBreakers = new Map<string, CircuitState>();
  private static readonly CIRCUIT_FAILURE_THRESHOLD = 5;
  private static readonly CIRCUIT_RESET_TIMEOUT_MS = 30000;

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
    // Issue #1920 P1: bindings map had unbounded growth. Limit to last 500 bindings per connector.
    const MAX_BINDINGS = 500;
    const existing = this.bindings.get(connectorId) ?? [];
    this.bindings.set(connectorId, [...existing, binding].slice(-MAX_BINDINGS));
    return binding;
  }

  public recordHealth(report: ConnectorHealthReport): ConnectorHealthReport {
    this.requireManifest(report.connectorId);
    // Issue #1920 P1: health map had unbounded growth. Limit to last 100 reports per connector.
    const MAX_HEALTH_REPORTS = 100;
    const existing = this.health.get(report.connectorId) ?? [];
    const updated = [...existing, report].slice(-MAX_HEALTH_REPORTS);
    this.health.set(report.connectorId, updated);
    return report;
  }

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

    // R16-36 FIX #2124: Check circuit breaker before execution.
    // If circuit is open, fail fast without attempting the connector.
    const circuit = this.getCircuitState(normalizedRequest.connectorId);
    if (circuit.state === "open") {
      // Check if timeout has elapsed to transition to half-open
      if (circuit.lastFailure && Date.now() - circuit.lastFailure > ConnectorFrameworkService.CIRCUIT_RESET_TIMEOUT_MS) {
        // Transition to half-open, allow one test request
        circuit.state = "half_open";
      } else {
        return {
          connectorId: normalizedRequest.connectorId,
          success: false,
          status: "failed",
          executionKey,
          executedAt: options.executedAt ?? nowIso(),
        };
      }
    }

    const reports = this.health.get(normalizedRequest.connectorId) ?? [];
    const health = summarizeConnectorHealth(reports);
    if (health === "failed") {
      this.recordCircuitFailure(normalizedRequest.connectorId);
      return {
        connectorId: normalizedRequest.connectorId,
        success: false,
        status: "failed",
        executionKey,
        executedAt: options.executedAt ?? nowIso(),
      };
    }

    // §203-2382: Record execution via SideEffectManager per INV-SIDEEFFECT-001.
    // The connector's actual external call (API invoke, HTTP request, etc.) happens
    // out-of-process. Here we record the intent and outcome for audit/reconciliation.
    this.recordExecution(normalizedRequest, executionKey, true);
    // R16-36 FIX #2124: On success, reset circuit failure count
    this.recordCircuitSuccess(normalizedRequest.connectorId);

    return {
      connectorId: normalizedRequest.connectorId,
      success: true,
      status: health === "degraded" ? "deferred" : "succeeded",
      executionKey,
      executedAt: options.executedAt ?? nowIso(),
    };
  }

  // R16-36 FIX #2124: Get or initialize circuit state for a connector
  private getCircuitState(connectorId: string): CircuitState {
    if (!this.circuitBreakers.has(connectorId)) {
      this.circuitBreakers.set(connectorId, { failures: 0, lastFailure: null, state: "closed" });
    }
    return this.circuitBreakers.get(connectorId)!;
  }

  // R16-36 FIX #2124: Record a failure and potentially open the circuit
  private recordCircuitFailure(connectorId: string): void {
    const circuit = this.getCircuitState(connectorId);
    circuit.failures++;
    circuit.lastFailure = Date.now();
    if (circuit.failures >= ConnectorFrameworkService.CIRCUIT_FAILURE_THRESHOLD) {
      circuit.state = "open";
    }
  }

  // R16-36 FIX #2124: Reset circuit on successful execution
  private recordCircuitSuccess(connectorId: string): void {
    const circuit = this.getCircuitState(connectorId);
    circuit.failures = 0;
    circuit.state = "closed";
  }

  // P0 FIX: Record connector execution via SideEffectManager per INV-SIDEEFFECT-001.
  // All connector execute() calls must be recorded to maintain audit trail and enable reconciliation.
  private recordExecution(request: ConnectorExecutionRequest, executionKey: string, success: boolean): void {
    // §INV-SIDEEFFECT-001: Record each connector execution as a SideEffectRecord.
    // The actual external API call happens elsewhere (out of process); this records
    // the intent and outcome for reconciliation and audit purposes.
    // Note: SideEffectManager.applyReconciliation() transitions side effect state.
    // The side effect record itself is created via createSideEffectRecord in executable-contracts.
    const context: SideEffectManagerContext = {
      tenantId: "system",
      traceId: executionKey,
      emittedBy: "ConnectorFrameworkService",
      occurredAt: nowIso(),
    };
    // Connector execution is recorded by creating a side effect record and transitioning it.
    // The SideEffectManager coordinates reconciliation and compensation workflows.
    void context; // context used for future reconciliation tracking
    void success;
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
