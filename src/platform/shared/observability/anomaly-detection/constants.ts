import type { AnomalyCategory, AnomalyDetectionConfig } from "./types.js";

export const ANOMALY_CATEGORY_LABELS: Record<AnomalyCategory, string> = {
  spike: "Sudden increase",
  dip: "Sudden decrease",
  trend_change: "Trend direction changed",
  level_shift: "Level shifted abruptly",
  seasonal_violation: "Seasonal pattern broken",
  rate_of_change: "Rate of change exceeded threshold",
  static: "Expected variation absent",
  pattern_break: "Known pattern disrupted",
};

export const DEFAULT_CONFIG: AnomalyDetectionConfig = {
  algorithm: "zscore",
  sensitivity: 0.5,
  windowSize: 100,
  minDataPoints: 10,
};
