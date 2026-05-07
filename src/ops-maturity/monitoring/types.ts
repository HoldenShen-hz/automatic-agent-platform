export interface MetricSample {
  readonly metricName: string;
  readonly value: number;
  readonly timestamp: string;
  readonly labels: Record<string, string>;
  readonly unit: string;
}

export interface AnomalyAlert {
  readonly alertId: string;
  readonly anomalyType: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly metricName: string;
  readonly detectedValue: number;
  readonly threshold: number;
  readonly timestamp: string;
  readonly affectedEntities: readonly string[];
}

export interface SystemHealthStatus {
  readonly score: number;
  readonly status: "ok" | "degraded" | "unhealthy";
}
