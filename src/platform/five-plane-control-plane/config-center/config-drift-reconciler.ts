import { DurableEventBus } from "../../five-plane-state-evidence/events/durable-event-bus.js";

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

export interface ConfigDriftReconcilerOptions {
  readonly eventBus?: DurableEventBus | null;
  readonly emitIncidents?: boolean;
}

export class ConfigDriftReconciler {
  private readonly eventBus: DurableEventBus | null;
  private readonly emitIncidents: boolean;

  public constructor(options: ConfigDriftReconcilerOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.emitIncidents = options.emitIncidents ?? true;
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

    this.emitDriftDetected(report, input.observed);

    return report;
  }

  private emitDriftDetected(
    report: ConfigDriftReport,
    observed: readonly ConfigDriftSource[],
  ): void {
    if (!this.emitIncidents || this.eventBus == null || report.findings.length === 0) {
      return;
    }

    this.eventBus.publish({
      eventType: "config.drift_detected",
      payload: {
        generatedAt: report.generatedAt,
        baselineSource: report.baselineSource,
        observedSources: observed.map((source) => source.sourceName),
        blocking: report.blocking,
        findingCount: report.findings.length,
        findings: report.findings.map((finding) => ({
          key: finding.key,
          expectedValue: finding.expectedValue,
          observedValue: finding.observedValue,
          observedSource: finding.observedSource,
          severity: finding.severity,
        })),
      },
    });
  }
}
