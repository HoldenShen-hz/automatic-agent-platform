/**
 * Reflection Engine
 *
 * Analyzes evidence to generate structured reflections on failures
 * and successes. Produces ReflectionRecords that feed into ProposalEngine.
 */

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
  // R13-05: Track pattern type
  patternType: 'failure' | 'success';
}

export interface ReflectionEngine {
  reflect(evidence: EvidenceRecord[]): Promise<ReflectionRecord[]>;
  reflectSingle(failure: EvidenceRecord): Promise<ReflectionRecord>;
}

export class SimpleReflectionEngine implements ReflectionEngine {
  private reflectionIdCounter = 0;

  async reflect(evidence: EvidenceRecord[]): Promise<ReflectionRecord[]> {
    const reflections: ReflectionRecord[] = [];

    // R13-05: Group by failure mode AND success pattern
    const byFailureMode = new Map<string, EvidenceRecord[]>();
    const bySuccessPattern = new Map<string, EvidenceRecord[]>();

    for (const record of evidence) {
      if (!record.success && record.failureMode) {
        const existing = byFailureMode.get(record.failureMode) ?? [];
        existing.push(record);
        byFailureMode.set(record.failureMode, existing);
      } else if (record.success) {
        // R13-05: Also analyze successes - group by task type for success patterns
        const existing = bySuccessPattern.get(record.taskType) ?? [];
        existing.push(record);
        bySuccessPattern.set(record.taskType, existing);
      }
    }

    // Generate reflection for each failure mode
    for (const [failureMode, records] of byFailureMode) {
      if (records.length >= 2) {
        // Multiple failures of same type warrant a reflection
        const reflection = await this.generateReflection(failureMode, records, 'failure');
        reflections.push(reflection);
      }
    }

    // R13-05: Generate reflection for each success pattern
    for (const [taskType, records] of bySuccessPattern) {
      if (records.length >= 3) {
        // More successes needed to form a reliable pattern
        const reflection = await this.generateSuccessReflection(taskType, records);
        reflections.push(reflection);
      }
    }

    return reflections;
  }

  async reflectSingle(failure: EvidenceRecord): Promise<ReflectionRecord> {
    if (failure.success) {
      return this.generateSuccessReflection(failure.taskType, [failure]);
    }
    return this.generateReflection(failure.failureMode ?? 'unknown', [failure], 'failure');
  }

  private async generateReflection(
    failureMode: string,
    records: EvidenceRecord[],
    patternType: 'failure' | 'success' = 'failure'
  ): Promise<ReflectionRecord> {
    const id = `refl_${++this.reflectionIdCounter}`;
    const firstRecord = records[0];
    if (!firstRecord) {
      return {
        id,
        evidenceIds: [],
        taskType: 'unknown',
        rootCause: 'No records provided',
        recommendation: 'Provide evidence records',
        confidence: 0,
        createdAt: new Date().toISOString(),
        patternType,
      };
    }
    const taskType = firstRecord.taskType;
    const evidenceIds = records.map((r) => r.id);

    // Analyze patterns
    const avgRepairRounds = records.reduce((sum, r) => sum + r.repairRounds, 0) / records.length;
    const avgCost = records.reduce((sum, r) => sum + r.costUsd, 0) / records.length;

    // Determine root cause category
    const rootCause = this.analyzeRootCause(failureMode, records);
    const recommendation = this.generateRecommendation(failureMode, rootCause, records);
    const confidence = this.calculateConfidence(records.length, avgRepairRounds);

    return {
      id,
      evidenceIds,
      taskType,
      rootCause,
      recommendation,
      confidence,
      createdAt: new Date().toISOString(),
      patternType,
      metadata: {
        failureMode,
        sampleSize: records.length,
        avgRepairRounds,
        avgCostUsd: avgCost,
      },
    };
  }

  // R13-05: New method to generate reflections from success patterns
  private async generateSuccessReflection(
    taskType: string,
    records: EvidenceRecord[]
  ): Promise<ReflectionRecord> {
    const id = `refl_${++this.reflectionIdCounter}`;
    const evidenceIds = records.map((r) => r.id);

    // Analyze patterns from successful executions
    const avgCost = records.reduce((sum, r) => sum + r.costUsd, 0) / records.length;
    const avgLatency = records.reduce((sum, r) => sum + r.latencyMs, 0) / records.length;
    const avgToolCalls = records.reduce((sum, r) => sum + r.toolCalls, 0) / records.length;
    const avgRepairRounds = records.reduce((sum, r) => sum + r.repairRounds, 0) / records.length;

    const rootCause = this.analyzeSuccessPattern(taskType, records);
    const recommendation = this.generateSuccessRecommendation(taskType, records);
    const confidence = this.calculateSuccessConfidence(records.length, avgRepairRounds);

    return {
      id,
      evidenceIds,
      taskType,
      rootCause,
      recommendation,
      confidence,
      createdAt: new Date().toISOString(),
      patternType: 'success',
      metadata: {
        successPattern: true,
        sampleSize: records.length,
        avgCostUsd: avgCost,
        avgLatencyMs: avgLatency,
        avgToolCalls,
        avgRepairRounds,
      },
    };
  }

  private analyzeSuccessPattern(taskType: string, records: EvidenceRecord[]): string {
    const first = records[0];
    if (!first) return 'Unknown success pattern';

    // Identify what made these successful
    if (first.repairRounds === 0 && first.toolCalls < 5) {
      return `Direct resolution pattern: ${taskType} tasks complete in single pass with minimal tool usage`;
    }
    if (first.toolCalls > 10) {
      return `Complex workflow pattern: ${taskType} tasks require multi-step execution but succeed reliably`;
    }
    return `Standard success pattern: ${taskType} tasks complete with average complexity`;
  }

  private generateSuccessRecommendation(taskType: string, records: EvidenceRecord[]): string {
    const first = records[0];
    if (!first) return 'Continue current approach';

    if (first.repairRounds === 0 && first.toolCalls < 5) {
      return `Capture direct resolution approach for ${taskType} tasks - prefer minimal tool usage patterns`;
    }
    if (first.toolCalls > 10) {
      return `Document multi-step workflow for ${taskType} tasks - reliable execution suggests good planning`;
    }
    return `Standard workflow suitable for ${taskType} tasks - maintain current approach`;
  }

  private calculateSuccessConfidence(sampleSize: number, avgRepairRounds: number): number {
    // Success patterns need more evidence since we're positive-biased
    let confidence = Math.min(sampleSize / 7, 1) * 0.5; // Up to 0.5 from sample size
    confidence += (1 - Math.min(avgRepairRounds / 2, 1)) * 0.5; // Up to 0.5 from low repair rounds
    return Math.round(confidence * 100) / 100;
  }

  private analyzeRootCause(failureMode: string, records: EvidenceRecord[]): string {
    // Simple pattern-based root cause analysis
    const first = records[0];
    // Check repair rounds and cost first (these are quantitative signals)
    if (first && first.repairRounds > 1) {
      return 'Multiple repair rounds indicate complex problem requiring better planning';
    }
    if (first && first.costUsd > 0.50) {
      return 'High cost suggests inefficient approach or excessive tool usage';
    }
    // Then check failure mode categories
    if (failureMode.includes('type') || failureMode.includes('schema')) {
      return 'Type checking and schema validation errors suggest inconsistent interface definitions';
    }
    if (failureMode.includes('test')) {
      return 'Test failures indicate missing edge case handling or incorrect assumptions';
    }
    if (failureMode.includes('security') || failureMode.includes('forbidden')) {
      return 'Security violations suggest insufficient guardrails in tool usage';
    }
    return 'Root cause analysis inconclusive - needs manual investigation';
  }

  private generateRecommendation(
    failureMode: string,
    rootCause: string,
    records: EvidenceRecord[]
  ): string {
    if (failureMode.includes('type') || failureMode.includes('schema')) {
      return 'Add explicit type annotations and schema validation for interface boundaries';
    }
    if (failureMode.includes('test')) {
      return 'Prefer simpler, more direct implementation that is easier to test';
    }
    if (failureMode.includes('security') || failureMode.includes('forbidden')) {
      return 'Strengthen tool usage validation and add security policy checks';
    }
    const first = records[0];
    if (first && first.repairRounds > 1) {
      return 'Reduce task complexity or improve planning before execution';
    }
    return 'Review and refine the approach based on observed failure patterns';
  }

  private calculateConfidence(sampleSize: number, avgRepairRounds: number): number {
    // Confidence based on sample size and repair difficulty
    let confidence = Math.min(sampleSize / 5, 1) * 0.6; // Up to 0.6 from sample size
    confidence += (1 - Math.min(avgRepairRounds / 3, 1)) * 0.4; // Up to 0.4 from low repair rounds
    return Math.round(confidence * 100) / 100;
  }
}
