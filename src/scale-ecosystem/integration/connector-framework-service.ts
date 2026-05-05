import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import {
  createReconciliationRecord,
  createSideEffectRecord,
  type ReconciliationRecord,
  type SideEffectRecord,
} from "../../platform/contracts/executable-contracts/index.js";
import {
  ConnectorManifestSchema,
  listEnabledConnectors,
  type ConnectorManifest,
  type NormalizedConnectorManifest,
} from "./connector-registry/index.js";
import {
  buildConnectorExecutionKey,
  ConnectorExecutionRequestSchema,
  ConnectorExecutionResultSchema,
  type ConnectorExecutionRequest,
  type ConnectorExecutionResult,
} from "./connector-runtime/index.js";
import {
  summarizeConnectorHealth,
  type ConnectorHealthReport,
} from "./health-monitor/index.js";
import { GitHubConnector } from "./connectors/github-connector.js";
import { JiraConnector } from "./connectors/jira-connector.js";
import { ServiceNowConnector } from "./connectors/servicenow-connector.js";
import { SlackConnector } from "./connectors/slack-connector.js";
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

export interface ConnectorExecutionContext {
  readonly request: ConnectorExecutionRequest;
  readonly manifest: RegisteredConnectorManifest;
  readonly executionKey: string;
  readonly environment: "dev" | "staging" | "prod";
  readonly eventType?: string;
  readonly executedAt: string;
}

export type ConnectorExecutor = (
  context: ConnectorExecutionContext,
) => ConnectorExecutionResult;

export interface ConnectorExecutionRecord {
  readonly connectorId: string;
  readonly executionKey: string;
  readonly executedAt: string;
  readonly status: ConnectorExecutionResult["status"];
  readonly success: boolean;
  readonly mode: "executor" | "synthesized";
  readonly sideEffectId?: string;
  readonly sideEffectStatus?: SideEffectRecord["status"];
}

export interface ConnectorFrameworkServiceOptions {
  readonly executors?: Record<string, ConnectorExecutor>;
}

export interface ConnectorSideEffectRecord {
  readonly connectorId: string;
  readonly executionKey: string;
  readonly sideEffect: SideEffectRecord;
  readonly reconciliation: ReconciliationRecord;
  readonly transitionEventType: string;
}

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
  private readonly executors = new Map<string, ConnectorExecutor>();
  private readonly executionRecords: ConnectorExecutionRecord[] = [];
  private readonly sideEffectRecords: ConnectorSideEffectRecord[] = [];
  // P0 FIX: Add SideEffectManager per INV-SIDEEFFECT-001.
  // Connector execute() calls must be recorded to maintain audit trail and enable reconciliation.
  private readonly sideEffectManager = new SideEffectManager();
  // R16-36 FIX #2124: Circuit breaker state per connector
  private readonly circuitBreakers = new Map<string, CircuitState>();
  private static readonly CIRCUIT_FAILURE_THRESHOLD = 5;
  private static readonly CIRCUIT_RESET_TIMEOUT_MS = 30000;

  public constructor(options: ConnectorFrameworkServiceOptions = {}) {
    for (const [connectorId, executor] of Object.entries(options.executors ?? {})) {
      this.executors.set(connectorId, executor);
    }
  }

  public register(manifest: ConnectorManifest): RegisteredConnectorManifest {
    const parsed = ConnectorManifestSchema.parse(manifest) as RegisteredConnectorManifest;
    this.manifests.set(parsed.connectorId, parsed);
    if (!this.executors.has(parsed.connectorId)) {
      const builtinExecutor = buildBuiltinConnectorExecutor(parsed.provider);
      if (builtinExecutor != null) {
        this.executors.set(parsed.connectorId, builtinExecutor);
      }
    }
    return parsed;
  }

  public registerExecutor(connectorId: string, executor: ConnectorExecutor): void {
    this.executors.set(connectorId, executor);
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
    const executedAt = options.executedAt ?? nowIso();
    if (options.environment === "prod" && manifest.lifecycleState !== "verified" && manifest.lifecycleState !== "enabled") {
      throw new Error(`connector_framework.prod_requires_verified:${normalizedRequest.connectorId}`);
    }
    if (normalizedRequest.secretBindings.length === 0 || normalizedRequest.policyRef == null) {
      return {
        connectorId: normalizedRequest.connectorId,
        success: false,
        status: "failed",
        executionKey,
        executedAt,
      };
    }
    if (options.eventType != null && !manifest.supportedEvents.includes(options.eventType)) {
      return {
        connectorId: normalizedRequest.connectorId,
        success: false,
        status: "failed",
        executionKey,
        executedAt,
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
          executedAt,
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
        executedAt,
      };
    }

    const executor = this.executors.get(normalizedRequest.connectorId);
    if (executor != null) {
      try {
        const result = ConnectorExecutionResultSchema.parse(executor({
          request: normalizedRequest,
          manifest,
          executionKey,
          environment: options.environment,
          ...(options.eventType != null && { eventType: options.eventType }),
          executedAt,
        }));
        const finalResult = {
          ...result,
          executionKey,
          executedAt,
        };
        this.recordExecution(normalizedRequest, executionKey, finalResult.success, finalResult.status, "executor", executedAt);
        if (finalResult.success) {
          this.recordCircuitSuccess(normalizedRequest.connectorId);
        } else {
          this.recordCircuitFailure(normalizedRequest.connectorId);
        }
        return finalResult;
      } catch {
        this.recordCircuitFailure(normalizedRequest.connectorId);
        this.recordExecution(normalizedRequest, executionKey, false, "failed", "executor", executedAt);
        return {
          connectorId: normalizedRequest.connectorId,
          success: false,
          status: "failed",
          executionKey,
          executedAt,
        };
      }
    }

    // §203-2382: Unknown/custom connectors without an executor must fail closed.
    // Returning synthesized success masked the fact that no real connector implementation ran.
    this.recordExecution(
      normalizedRequest,
      executionKey,
      false,
      "failed",
      "synthesized",
      executedAt,
    );
    this.recordCircuitFailure(normalizedRequest.connectorId);

    return {
      connectorId: normalizedRequest.connectorId,
      success: false,
      status: "failed",
      executionKey,
      executedAt,
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
  private recordExecution(
    request: ConnectorExecutionRequest,
    executionKey: string,
    success: boolean,
    status: ConnectorExecutionResult["status"],
    mode: "executor" | "synthesized",
    executedAt: string,
  ): void {
    // §INV-SIDEEFFECT-001: Record each connector execution as a SideEffectRecord.
    // The actual external API call happens elsewhere (out of process); this records
    // the intent and outcome for reconciliation and audit purposes.
    // Note: SideEffectManager.applyReconciliation() transitions side effect state.
    // The side effect record itself is created via createSideEffectRecord in executable-contracts.
    const context: SideEffectManagerContext = {
      tenantId: "system",
      traceId: executionKey,
      emittedBy: "ConnectorFrameworkService",
      occurredAt: executedAt,
      leaseId: `lease:${executionKey}`,
      fencingToken: `fence:${executionKey}`,
    };
    const sideEffect = createSideEffectRecord({
      harnessRunId: "connector_framework",
      nodeRunId: request.connectorId,
      nodeAttemptId: executionKey,
      effectKind: "external_api",
      idempotencyKey: executionKey,
      status: "reconciling",
      riskClass: "medium",
      preCommitPolicyProofRef: {
        artifactId: `connector-policy:${request.connectorId}`,
        uri: `policy://connector/${request.connectorId}`,
      },
      externalRef: `${request.connectorId}:${request.capability}`,
      deadline: new Date(new Date(executedAt).getTime() + 5 * 60_000).toISOString(),
      createdAt: executedAt,
      updatedAt: executedAt,
    });
    const reconciliation = createReconciliationRecord({
      sideEffectId: sideEffect.sideEffectId,
      probeKind: "connector_execution",
      externalObservedState: {
        connectorId: request.connectorId,
        executionKey,
        status,
        mode,
      },
      result: success ? "confirmed" : "failed",
      nextAction: success ? "mark_confirmed" : "mark_failed",
      createdAt: executedAt,
    });
    const transition = this.sideEffectManager.applyReconciliation(
      sideEffect,
      reconciliation,
      context,
    );
    this.executionRecords.push({
      connectorId: request.connectorId,
      executionKey,
      executedAt,
      status,
      success,
      mode,
      sideEffectId: transition.aggregate.sideEffectId,
      sideEffectStatus: transition.aggregate.status,
    });
    this.sideEffectRecords.push({
      connectorId: request.connectorId,
      executionKey,
      sideEffect: transition.aggregate,
      reconciliation,
      transitionEventType: transition.event.eventType,
    });
    if (this.executionRecords.length > 500) {
      this.executionRecords.splice(0, this.executionRecords.length - 500);
    }
    if (this.sideEffectRecords.length > 500) {
      this.sideEffectRecords.splice(0, this.sideEffectRecords.length - 500);
    }
  }

  public listEnabled(): RegisteredConnectorManifest[] {
    const enabledIds = new Set(listEnabledConnectors([...this.manifests.values()]).map((item) => item.connectorId));
    return [...this.manifests.values()].filter((item) => enabledIds.has(item.connectorId));
  }

  public getManifest(connectorId: string): RegisteredConnectorManifest | null {
    return this.manifests.get(connectorId) ?? null;
  }

  public listExecutionRecords(connectorId?: string): ConnectorExecutionRecord[] {
    const records = connectorId == null
      ? this.executionRecords
      : this.executionRecords.filter((record) => record.connectorId === connectorId);
    return [...records];
  }

  public listSideEffectRecords(connectorId?: string): ConnectorSideEffectRecord[] {
    const records = connectorId == null
      ? this.sideEffectRecords
      : this.sideEffectRecords.filter((record) => record.connectorId === connectorId);
    return [...records];
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

function buildBuiltinConnectorExecutor(provider: string): ConnectorExecutor | null {
  switch (provider.trim().toLowerCase()) {
    case "github": {
      const connector = new GitHubConnector();
      return ({ request }) => connector.execute(request);
    }
    case "slack": {
      const connector = new SlackConnector();
      return ({ request }) => connector.execute(request);
    }
    case "jira": {
      const connector = new JiraConnector();
      return ({ request }) => connector.execute(request);
    }
    case "servicenow": {
      const connector = new ServiceNowConnector();
      return ({ request }) => connector.execute(request);
    }
    default:
      return null;
  }
}
