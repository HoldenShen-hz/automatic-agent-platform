import { parseFeedbackSignal, type FeedbackSignal } from "../../../platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";
import type { FeedbackBatch } from "./feedback-model.js";
import { parseLearningSignal, type LearningSignal } from "./feedback-model.js";

export interface SignalPreprocessorOptions {
  includeInformationalSignals?: boolean;
}

function sortUnique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort();
}

function normalizeStepOutputRefs(refs: readonly string[]): string[] {
  return sortUnique(refs);
}

function buildSignalKey(signal: FeedbackSignal): string {
  return JSON.stringify({
    source: signal.source,
    category: signal.category,
    severity: signal.severity,
    reasonCode: typeof signal.payload.reasonCode === "string" ? signal.payload.reasonCode : null,
    summary: typeof signal.payload.summary === "string" ? signal.payload.summary : null,
    stepOutputRefs: normalizeStepOutputRefs(signal.stepOutputRefs),
  });
}

function buildGroupKey(signal: FeedbackSignal): string {
  const refs = sortUnique(signal.stepOutputRefs);
  return refs.length > 0 ? refs.join("|") : `signal:${signal.signalId}`;
}

function summarizeSignal(signal: FeedbackSignal): string {
  if (typeof signal.payload.summary === "string" && signal.payload.summary.trim().length > 0) {
    return signal.payload.summary.trim();
  }
  if (typeof signal.payload.reasonCode === "string" && signal.payload.reasonCode.trim().length > 0) {
    return signal.payload.reasonCode.trim();
  }
  return `${signal.source}:${signal.category}`;
}

function inferConfidence(signal: FeedbackSignal): number {
  if (signal.source === "user" || signal.source === "hitl") {
    return 1;
  }
  if (signal.category === "correction") {
    return 0.8;
  }
  if (signal.category === "failure" || signal.category === "timeout") {
    return 0.8;
  }
  if (signal.category === "partial") {
    return 0.5;
  }
  return 0.3;
}

export class SignalPreprocessor {
  public deduplicate(signals: readonly FeedbackSignal[]): FeedbackSignal[] {
    const deduplicated = new Map<string, FeedbackSignal>();
    for (const signal of signals.map((item) => parseFeedbackSignal(item))) {
      const key = buildSignalKey(signal);
      const existing = deduplicated.get(key);
      if (!existing) {
        deduplicated.set(key, signal);
        continue;
      }
      deduplicated.set(key, {
        ...(signal.timestamp < existing.timestamp ? signal : existing),
        stepOutputRefs: sortUnique([...existing.stepOutputRefs, ...signal.stepOutputRefs]),
        payload: {
          ...existing.payload,
          occurrenceCount:
            (typeof existing.payload.occurrenceCount === "number" && Number.isFinite(existing.payload.occurrenceCount)
              ? existing.payload.occurrenceCount
              : 1) + 1,
          mergedSignalIds: sortUnique([
            ...(Array.isArray(existing.payload.mergedSignalIds)
              ? existing.payload.mergedSignalIds.filter((value): value is string => typeof value === "string")
              : [existing.signalId]),
            signal.signalId,
          ]),
        },
      });
    }
    return [...deduplicated.values()].sort((left, right) => left.timestamp - right.timestamp);
  }

  public mergeCorrelated(signals: readonly FeedbackSignal[]): FeedbackSignal[] {
    const grouped = new Map<string, FeedbackSignal[]>();
    for (const signal of this.deduplicate(signals)) {
      const key = buildGroupKey(signal);
      const bucket = grouped.get(key) ?? [];
      bucket.push(signal);
      grouped.set(key, bucket);
    }

    return [...grouped.values()].map((group) => {
      const ordered = [...group].sort((left, right) => left.timestamp - right.timestamp);
      const primary = ordered[0]!;
      return {
        ...primary,
        stepOutputRefs: sortUnique(ordered.flatMap((signal) => signal.stepOutputRefs)),
        payload: {
          ...primary.payload,
          mergedSignalIds: sortUnique(ordered.map((signal) => signal.signalId)),
          correlatedCategories: ordered.map((signal) => signal.category),
        },
      };
    });
  }

  public normalize(signals: readonly FeedbackSignal[]): FeedbackSignal[] {
    const normalized = new Map<string, FeedbackSignal>();
    for (const signal of signals.map((item) => parseFeedbackSignal(item))) {
      const key = buildSignalKey(signal);
      const existing = normalized.get(key);
      if (!existing) {
        normalized.set(key, signal);
        continue;
      }
      const occurrenceCount =
        typeof existing.payload.occurrenceCount === "number" && Number.isFinite(existing.payload.occurrenceCount)
          ? existing.payload.occurrenceCount
          : 1;
      normalized.set(key, {
        ...existing,
        signalId: `${existing.signalId}+${signal.signalId}`,
        stepOutputRefs: sortUnique([...existing.stepOutputRefs, ...signal.stepOutputRefs]),
        payload: {
          ...existing.payload,
          occurrenceCount: occurrenceCount + 1,
          mergedSignalIds: sortUnique([
            ...(Array.isArray(existing.payload.mergedSignalIds)
              ? existing.payload.mergedSignalIds.filter((value): value is string => typeof value === "string")
              : [existing.signalId]),
            signal.signalId,
          ]),
        },
        timestamp: Math.min(existing.timestamp, signal.timestamp),
      });
    }

    return [...normalized.values()].sort((left, right) => left.timestamp - right.timestamp);
  }

  public toLearningSignals(
    feedback: FeedbackBatch,
    options: SignalPreprocessorOptions = {},
  ): LearningSignal[] {
    const signals = this.normalize(feedback.signals);
    const grouped = new Map<string, FeedbackSignal[]>();
    for (const signal of signals) {
      const key = buildGroupKey(signal);
      const bucket = grouped.get(key) ?? [];
      bucket.push(signal);
      grouped.set(key, bucket);
    }

    const learningSignals: LearningSignal[] = [];
    const consumedSignalIds = new Set<string>();

    for (const group of grouped.values()) {
      const hasFailure = group.some((signal) => signal.category === "failure" || signal.category === "timeout");
      const hasCorrection = group.some((signal) => signal.category === "correction");
      const hasRecovery = group.some((signal) => signal.category === "success" || signal.category === "partial");
      if (!hasFailure || !hasCorrection || !hasRecovery) {
        continue;
      }
      const ordered = [...group].sort((left, right) => left.timestamp - right.timestamp);
      const evidenceRefs = sortUnique(ordered.flatMap((signal) => signal.stepOutputRefs));
      const sourceSignalIds = sortUnique(ordered.flatMap((signal) => signal.signalId.split("+")));
      for (const signalId of sourceSignalIds) {
        consumedSignalIds.add(signalId);
      }
      learningSignals.push(parseLearningSignal({
        learningSignalId: `${feedback.feedbackId}:learning:recovery:${learningSignals.length + 1}`,
        taskId: feedback.taskId,
        sourceFeedbackId: feedback.feedbackId,
        learningType: "recovery_playbook",
        confidence: 0.85,
        valueSummary: ordered.map((signal) => summarizeSignal(signal)).join(" -> "),
        evidenceRefs,
        sourceSignalIds,
        relatedSignalIds: sourceSignalIds,
        evidence: {
          pattern: "recovery_path",
          sources: sortUnique(ordered.map((signal) => signal.source)),
          categories: ordered.map((signal) => signal.category),
        },
        generatedAt: feedback.emittedAt,
      }));
    }

    for (const signal of signals) {
      const sourceSignalIds = sortUnique(signal.signalId.split("+"));
      if (sourceSignalIds.some((signalId) => consumedSignalIds.has(signalId))) {
        continue;
      }
      if (
        !options.includeInformationalSignals
        && signal.category === "success"
        && signal.severity === "info"
      ) {
        continue;
      }

      const learningType =
        signal.category === "correction"
          ? signal.source === "user" || signal.source === "hitl"
            ? "user_correction"
            : "recovery_playbook"
          : signal.category === "failure" || signal.category === "timeout" || signal.category === "partial"
            ? "failure_pattern"
            : null;
      if (!learningType) {
        continue;
      }

      learningSignals.push(parseLearningSignal({
        learningSignalId: `${feedback.feedbackId}:learning:${learningSignals.length + 1}`,
        taskId: feedback.taskId,
        sourceFeedbackId: feedback.feedbackId,
        learningType,
        confidence: inferConfidence(signal),
        valueSummary: summarizeSignal(signal),
        evidenceRefs: sortUnique(signal.stepOutputRefs),
        sourceSignalIds,
        relatedSignalIds: sourceSignalIds,
        evidence: {
          source: signal.source,
          category: signal.category,
          severity: signal.severity,
          reasonCode: signal.payload.reasonCode ?? null,
        },
        generatedAt: feedback.emittedAt,
      }));
    }

    return learningSignals;
  }
}
