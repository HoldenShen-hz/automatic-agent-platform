import type { DurableEventBus } from "../../state-evidence/events/durable-event-bus.js";

export interface ConfigDriftSource {
  readonly sourceName: "defaults" | "environment" | "runtime" | "run_version_lock";
  readonly values: Readonly<Record<string, string | number | boolean>>;
}

export interface ConfigDriftFinding {
  readonly key: string;
  readonly expectedValue: string | number | boolean;
  readonly observedValue: string | number | boolean | null;
  readonly observedSource: ConfigDriftSource["sourceName"];
  readonly severity: "warning" | "blocking";
}

export interface ConfigDriftReport {
  readonly generatedAt: string;
  readonly baselineSource: ConfigDriftSource["sourceName"];
  readonly findings: readonly ConfigDriftFinding[];
  readonly blocking: boolean;
}

/**
 * Options for ConfigDriftReconciler.
 */
export interface ConfigDriftReconcilerOptions {
  /** Event bus for emitting drift incidents */
  eventBus?: DurableEventBus | null;
  /** Minimum severity to trigger incident */
  incidentSeverityThreshold?: "warning" | "blocking";
}

/**
 * Payload for config.drift_detected incident event.
 */
interface ConfigDriftDetectedPayload extends Record<string, unknown> {
  readonly reportId: string;
  readonly generatedAt: string;
  readonly baselineSource: ConfigDriftSource["sourceName"];
  readonly findingCount: number;
  readonly blockingCount: number;
  readonly findings: readonly ConfigDriftFinding[];
}

/**
 * Service for detecting configuration drift and emitting incidents.
 * §24.2/R15-77: Emits config.drift_detected incidents via EventBus.
 */
export class ConfigDriftReconciler {
  private readonly eventBus: DurableEventBus | null;
  private readonly incidentSeverityThreshold: "warning" | "blocking";

  public constructor(options: ConfigDriftReconcilerOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.incidentSeverityThreshold = options.incidentSeverityThreshold ?? "warning";
  }

  public reconcile(input: {
    readonly baseline: ConfigDriftSource;
    readonly observed: readonly ConfigDriftSource[];
    readonly blockingKeys?: readonly string[];
    readonly generatedAt: string;
  }): ConfigDriftReport {
    const blockingKeys = new Set(input.blockingKeys ?? []);
    const findings: ConfigDriftFinding[] = [];

    for (const observed of input.observed) {
      for (const [key, expectedValue] of Object.entries(input.baseline.values)) {
        const observedValue = observed.values[key] ?? null;
        if (observedValue !== expectedValue) {
          findings.push({
            key,
            expectedValue,
            observedValue,
            observedSource: observed.sourceName,
            severity: blockingKeys.has(key) ? "blocking" : "warning",
          });
        }
      }
    }

    const report: ConfigDriftReport = {
      generatedAt: input.generatedAt,
      baselineSource: input.baseline.sourceName,
      findings,
      blocking: findings.some((finding) => finding.severity === "blocking"),
    };

    // §24.2/R15-77: Emit config.drift_detected incident when drift is detected
    this.emitDriftIncident(report);

    return report;
  }

  /**
   * Emits a config.drift_detected incident if drift meets severity threshold.
   * §24.2/R15-77: Required for active incident reporting.
   */
  private emitDriftIncident(report: ConfigDriftReport): void {
    if (!this.eventBus) {
      return;
    }

    // Determine if incident should be emitted based on severity threshold
    const shouldEmit = this.incidentSeverityThreshold === "blocking"
      ? report.blocking
      : report.findings.length > 0;

    if (!shouldEmit) {
      return;
    }

    const payload: ConfigDriftDetectedPayload = {
      reportId: `drift-${Date.now()}`,
      generatedAt: report.generatedAt,
      baselineSource: report.baselineSource,
      findingCount: report.findings.length,
      blockingCount: report.findings.filter((f) => f.severity === "blocking").length,
      findings: report.findings,
    };

    this.eventBus.publish({
      eventType: "config.drift_detected",
      payload,
    });
  }
}
