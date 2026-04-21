import { newId } from "../../../contracts/types/ids.js";
import { detectLlmTruncation, detectSchemaValidationLoop, detectToolPermissionDenial, detectModelHallucination, } from "./pattern-detectors/index.js";
export class FailurePatternMiner {
    mine(signals) {
        const results = [];
        const unmatched = [];
        for (const signal of signals) {
            if (signal.learningType !== "failure_pattern")
                continue;
            const pattern = detectLlmTruncation(signal) ??
                detectToolPermissionDenial(signal) ??
                detectModelHallucination(signal);
            if (pattern) {
                results.push(this.patternToLearningObject(pattern));
            }
            else {
                unmatched.push(signal);
            }
        }
        const schemaLoop = detectSchemaValidationLoop(signals);
        if (schemaLoop) {
            results.push(this.patternToLearningObject(schemaLoop));
        }
        for (const signal of unmatched) {
            results.push(this.genericFailure(signal));
        }
        return results;
    }
    patternToLearningObject(pattern) {
        return {
            learningObjectId: newId("learning"),
            learningType: "failure_pattern",
            title: pattern.title,
            summary: pattern.summary,
            confidence: 0.8,
            evidenceRefs: pattern.evidenceRefs,
            sourceSignalIds: pattern.sourceSignalIds,
            recommendation: pattern.recommendation,
            validatedBy: "none",
            promotionStatus: "draft",
            createdAt: pattern.detectedAt,
        };
    }
    genericFailure(signal) {
        return {
            learningObjectId: newId("learning"),
            learningType: "failure_pattern",
            title: `Failure pattern: ${signal.valueSummary.slice(0, 40)}`,
            summary: signal.valueSummary,
            confidence: signal.confidence,
            evidenceRefs: signal.evidenceRefs,
            sourceSignalIds: signal.sourceSignalIds,
            recommendation: "Prefer replanning with narrower scope and stronger validation.",
            validatedBy: "none",
            promotionStatus: "draft",
            createdAt: signal.generatedAt,
        };
    }
}
//# sourceMappingURL=failure-pattern-miner.js.map