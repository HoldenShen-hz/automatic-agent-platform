/**
 * Reflection Engine
 *
 * Analyzes evidence to generate structured reflections on failures
 * and successes. Produces ReflectionRecords that feed into ProposalEngine.
 */
export class SimpleReflectionEngine {
    reflectionIdCounter = 0;
    async reflect(evidence) {
        const reflections = [];
        // Group by failure mode
        const byFailureMode = new Map();
        for (const record of evidence) {
            if (!record.success && record.failureMode) {
                const existing = byFailureMode.get(record.failureMode) ?? [];
                existing.push(record);
                byFailureMode.set(record.failureMode, existing);
            }
        }
        // Generate reflection for each failure mode
        for (const [failureMode, records] of byFailureMode) {
            if (records.length >= 2) {
                // Multiple failures of same type warrant a reflection
                const reflection = await this.generateReflection(failureMode, records);
                reflections.push(reflection);
            }
        }
        return reflections;
    }
    async reflectSingle(failure) {
        return this.generateReflection(failure.failureMode ?? 'unknown', [failure]);
    }
    async generateReflection(failureMode, records) {
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
            metadata: {
                failureMode,
                sampleSize: records.length,
                avgRepairRounds,
                avgCostUsd: avgCost,
            },
        };
    }
    analyzeRootCause(failureMode, records) {
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
        const first = records[0];
        if (first && first.repairRounds > 1) {
            return 'Multiple repair rounds indicate complex problem requiring better planning';
        }
        if (first && first.costUsd > 0.50) {
            return 'High cost suggests inefficient approach or excessive tool usage';
        }
        return 'Root cause analysis inconclusive - needs manual investigation';
    }
    generateRecommendation(failureMode, rootCause, records) {
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
    calculateConfidence(sampleSize, avgRepairRounds) {
        // Confidence based on sample size and repair difficulty
        let confidence = Math.min(sampleSize / 5, 1) * 0.6; // Up to 0.6 from sample size
        confidence += (1 - Math.min(avgRepairRounds / 3, 1)) * 0.4; // Up to 0.4 from low repair rounds
        return Math.round(confidence * 100) / 100;
    }
}
//# sourceMappingURL=reflection-engine.js.map