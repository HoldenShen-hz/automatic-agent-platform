import type { FeedbackSignal } from "../collector/feedback-model.js";

export interface FeedbackAnalysisSummary {
  readonly totalSignals: number;
  readonly bySeverity: Readonly<Record<string, number>>;
  readonly topSubjects: readonly string[];
}

export function analyzeFeedbackSignals(signals: readonly FeedbackSignal[]): FeedbackAnalysisSummary {
  const bySeverity = signals.reduce<Record<string, number>>((acc, item) => {
    acc[item.severity] = (acc[item.severity] ?? 0) + 1;
    return acc;
  }, {});
  const subjectCounts = signals.reduce<Map<string, number>>((acc, item) => {
    const key = `task:${item.taskId}`;
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map());
  const topSubjects = [...subjectCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([subject]) => subject);

  return {
    totalSignals: signals.length,
    bySeverity,
    topSubjects,
  };
}
