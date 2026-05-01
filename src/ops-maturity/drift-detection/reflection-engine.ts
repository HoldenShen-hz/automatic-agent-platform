/**
 * Reflection Engine
 *
 * Analyzes evidence to generate structured reflections on failures
 * and successes. Produces ReflectionRecords that feed into ProposalEngine.
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type { EvidenceRecord } from './evidence-store.js';

export interface ReflectionRecord {
  id: string;
  evidenceIds: string[];
  taskType: string;
  rootCause: string;
  recommendation: string;
  confidence: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ReflectionEngine {
  reflect(evidence: EvidenceRecord[]): Promise<ReflectionRecord[]>;
  reflectSingle(failure: EvidenceRecord): Promise<ReflectionRecord>;
}

export class SimpleReflectionEngine implements ReflectionEngine {
  async reflect(evidence: EvidenceRecord[]): Promise<ReflectionRecord[]> {
    const reflections: ReflectionRecord[] = [];

    // Group by taskType for success+failure correlation per §20/§58.3
    const byTaskType = new Map<string, EvidenceRecord[]>();
    for (const record of evidence) {
      // §58.3: correlate both successes and failures to extract patterns
      const existing = byTaskType.get(record.taskType) ?? [];
      existing.push(record);
      byTaskType.set(record.taskType, existing);
    }

    // Generate reflection for each taskType with sufficient evidence
    for (const [taskType, records] of byTaskType) {
      // R16-36 FIX #2110: Single serious security events must not be ignored.
      // Security violations are critical and require immediate reflection even if n=1.
      const hasSecurityFailure = records.some((r) => r.failureMode?.includes("security") || r.failureMode?.includes("forbidden"));

      if (hasSecurityFailure || records.length >= 2) {
        // Separate successes and failures for correlation analysis
        const successes = records.filter((r) => r.success);
        const failures = records.filter((r) => !r.success);
        // Generate reflection capturing both success and failure patterns
        const reflection = await this.generateReflection(taskType, records, { successes, failures });
        reflections.push(reflection);
      }
    }

    return reflections;
  }

  async reflectSingle(failure: EvidenceRecord): Promise<ReflectionRecord> {
    return this.generateReflection(failure.failureMode ?? 'unknown', [failure]);
  }

  private async generateReflection(
    taskType: string,
    records: EvidenceRecord[],
    context?: { successes: EvidenceRecord[]; failures: EvidenceRecord[] }
  ): Promise<ReflectionRecord> {
    const id = newId("refl");
    const firstRecord = records[0];
    if (!firstRecord) {
      return {
        id,
        evidenceIds: [],
        taskType: 'unknown',
        rootCause: 'No records provided',
        recommendation: 'Provide evidence records',
        confidence: 0,
        createdAt: nowIso(),
      };
    }
    const evidenceIds = records.map((r) => r.id);
    const failures = context?.failures ?? records.filter((r) => !r.success);
    const successes = context?.successes ?? records.filter((r) => r.success);
    const failureMode = failures[0]?.failureMode ?? 'unknown';

    // Analyze patterns including success+failure correlation per §58.3
    const avgRepairRounds = records.reduce((sum, r) => sum + r.repairRounds, 0) / records.length;
    const avgCost = records.reduce((sum, r) => sum + r.costUsd, 0) / records.length;

    // Determine root cause category using both success and failure patterns
    const rootCause = this.analyzeRootCause(failureMode, records, { successes, failures });
    const recommendation = this.generateRecommendation(failureMode, rootCause, records, { successes, failures });
    const confidence = this.calculateConfidence(records.length, avgRepairRounds, successes.length, failures.length);

    return {
      id,
      evidenceIds,
      taskType,
      rootCause,
      recommendation,
      confidence,
      createdAt: nowIso(),
      metadata: {
        taskType,
        failureMode,
        sampleSize: records.length,
        successCount: successes.length,
        failureCount: failures.length,
        avgRepairRounds,
        avgCostUsd: avgCost,
      },
    };
  }

  private analyzeRootCause(
    failureMode: string,
    records: EvidenceRecord[],
    context?: { successes: EvidenceRecord[]; failures: EvidenceRecord[] }
  ): string {
    // §58.3: Correlate success and failure patterns to identify distinguishing factors
    const successes = context?.successes ?? [];
    const failures = context?.failures ?? records.filter((r) => !r.success);

    // Simple pattern-based root cause analysis
    if (failureMode.includes('type') || failureMode.includes('schema')) {
      return 'Type checking and schema validation errors suggest inconsistent interface definitions';
    }
    if (failureMode.includes('test')) {
      return 'Test failures indicate missing edge case handling or incorrect assumptions';
    }
    if (failureMode.includes('security') || failureMode.includes('forbidden')) {
      return 'Security violations suggest insufficient guardrails in tool usage';
    }

    // §58.3: Analyze what differentiates successes from failures
    const avgSuccessCost = successes.length > 0
      ? successes.reduce((sum, r) => sum + r.costUsd, 0) / successes.length
      : null;
    const avgFailureCost = failures.length > 0
      ? failures.reduce((sum, r) => sum + r.costUsd, 0) / failures.length
      : null;

    if (avgSuccessCost !== null && avgFailureCost !== null && avgFailureCost > avgSuccessCost * 1.5) {
      return 'Failures correlate with higher execution cost - inefficient approach or excessive tool usage';
    }
    if (failures.some((r) => r.repairRounds > 1)) {
      return 'Multiple repair rounds in failures indicate complex problem requiring better planning';
    }
    if (records[0] && records[0].costUsd > 0.50) {
      return 'High cost suggests inefficient approach or excessive tool usage';
    }
    return 'Root cause analysis inconclusive - needs manual investigation';
  }

  private generateRecommendation(
    failureMode: string,
    rootCause: string,
    records: EvidenceRecord[],
    context?: { successes: EvidenceRecord[]; failures: EvidenceRecord[] }
  ): string {
    // §58.3: Use success patterns to reinforce what works
    const successes = context?.successes ?? [];
    const failures = context?.failures ?? records.filter((r) => !r.success);

    if (failureMode.includes('type') || failureMode.includes('schema')) {
      return 'Add explicit type annotations and schema validation for interface boundaries';
    }
    if (failureMode.includes('test')) {
      return 'Prefer simpler, more direct implementation that is easier to test';
    }
    if (failureMode.includes('security') || failureMode.includes('forbidden')) {
      return 'Strengthen tool usage validation and add security policy checks';
    }

    // §58.3: Leverage success patterns to counteract failure patterns
    const avgSuccessCost = successes.length > 0
      ? successes.reduce((sum, r) => sum + r.costUsd, 0) / successes.length
      : null;
    if (avgSuccessCost !== null && failures.some((r) => r.costUsd > avgSuccessCost * 1.5)) {
      return 'Optimize high-cost failure paths to match efficient success patterns';
    }
    if (failures.some((r) => r.repairRounds > 1)) {
      return 'Reduce task complexity or improve planning before execution';
    }
    if (successes.length > failures.length) {
      return 'Success patterns outnumber failures - reinforce current approach while monitoring for regressions';
    }
    return 'Review and refine the approach based on observed failure patterns';
  }

  private calculateConfidence(
    sampleSize: number,
    avgRepairRounds: number,
    successCount: number,
    failureCount: number
  ): number {
    // §58.3: Confidence based on sample size, repair difficulty, and success/failure balance
    let confidence = Math.min(sampleSize / 5, 1) * 0.5; // Up to 0.5 from sample size
    confidence += (1 - Math.min(avgRepairRounds / 3, 1)) * 0.3; // Up to 0.3 from low repair rounds
    // §58.3: Higher confidence when both successes and failures are present (correlation evidence)
    if (successCount > 0 && failureCount > 0) {
      confidence += 0.2; // Up to 0.2 bonus for having both success and failure evidence
    }
    return Math.round(confidence * 100) / 100;
  }
}
