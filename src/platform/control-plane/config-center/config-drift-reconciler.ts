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

export class ConfigDriftReconciler {
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

    return {
      generatedAt: input.generatedAt,
      baselineSource: input.baseline.sourceName,
      findings,
      blocking: findings.some((finding) => finding.severity === "blocking"),
    };
  }
}
