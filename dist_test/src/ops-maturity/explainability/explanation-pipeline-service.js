import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { buildCausalChainSummary } from "./causal-chain-builder/index.js";
import { collectExplanationEvidenceIds } from "./evidence-collector/index.js";
import { putExplanationCacheEntry } from "./explanation-cache/index.js";
import { renderStageExplanation } from "./explanation-renderer/index.js";
function explanationCacheKey(taskId, stage, depth) {
    return `${taskId}:${stage}:${depth}`;
}
function uniqueStrings(values) {
    return [...new Set(values)];
}
export class ExplanationPipelineService {
    cache = {};
    generate(request, depth = "L2") {
        const allowedCategories = new Set(request.allowedEvidenceCategories ?? request.evidence.map((item) => item.category));
        const visibleEvidence = request.evidence.filter((item) => allowedCategories.has(item.category));
        const hiddenEvidence = request.evidence.filter((item) => !allowedCategories.has(item.category));
        const evidenceRefs = collectExplanationEvidenceIds(visibleEvidence);
        const redactedEvidenceRefs = collectExplanationEvidenceIds(hiddenEvidence);
        const rationale = {
            taskId: request.taskId,
            stage: request.stage,
            summary: request.summary,
            decisionFactors: uniqueStrings(request.decisionFactors),
            evidenceRefs,
            riskNotes: uniqueStrings(request.riskNotes),
            generatedAt: request.generatedAt ?? nowIso(),
        };
        const causalSummary = buildCausalChainSummary(request.causalLinks ?? []);
        const cacheKey = explanationCacheKey(request.taskId, request.stage, depth);
        const rendered = this.renderBundle(rationale, depth, causalSummary, redactedEvidenceRefs);
        this.cache = putExplanationCacheEntry(this.cache, {
            cacheKey,
            summary: rationale.summary,
        });
        return {
            explanationId: newId("explanation"),
            depth,
            rationale,
            rendered,
            causalSummary,
            redactedEvidenceRefs,
            cacheKey,
        };
    }
    getCached(cacheKey) {
        return this.cache[cacheKey] ?? null;
    }
    renderBundle(rationale, depth, causalSummary, redactedEvidenceRefs) {
        const base = renderStageExplanation(rationale.stage, rationale.summary, rationale.evidenceRefs);
        if (depth === "L1") {
            return base;
        }
        const factors = rationale.decisionFactors.length > 0
            ? ` factors=${rationale.decisionFactors.join("; ")}`
            : "";
        const risks = rationale.riskNotes.length > 0
            ? ` risks=${rationale.riskNotes.join("; ")}`
            : "";
        if (depth === "L2") {
            return `${base}${factors}${risks}`;
        }
        const causal = causalSummary.length > 0
            ? ` causal=${causalSummary.join(" | ")}`
            : "";
        const redaction = redactedEvidenceRefs.length > 0
            ? ` redacted=${redactedEvidenceRefs.join(",")}`
            : "";
        return `${base}${factors}${risks}${causal}${redaction}`;
    }
}
//# sourceMappingURL=explanation-pipeline-service.js.map