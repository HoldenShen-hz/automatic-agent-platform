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
}
export interface ReflectionEngine {
    reflect(evidence: EvidenceRecord[]): Promise<ReflectionRecord[]>;
    reflectSingle(failure: EvidenceRecord): Promise<ReflectionRecord>;
}
export declare class SimpleReflectionEngine implements ReflectionEngine {
    private reflectionIdCounter;
    reflect(evidence: EvidenceRecord[]): Promise<ReflectionRecord[]>;
    reflectSingle(failure: EvidenceRecord): Promise<ReflectionRecord>;
    private generateReflection;
    private analyzeRootCause;
    private generateRecommendation;
    private calculateConfidence;
}
