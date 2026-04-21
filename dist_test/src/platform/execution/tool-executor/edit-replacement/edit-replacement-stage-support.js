import { buildCandidateWindows, matchAnchoredFuzzy, matchExact, matchFuzzyWindows, matchNormalizedWindows, } from "./match.js";
import { buildAttempt } from "./edit-replacement-result-support.js";
import { normalizeIndentationAware, normalizeWhitespace } from "./string-utils.js";
export function evaluateEditStages(content, request) {
    const attempts = [];
    const exact = buildAttempt("exact", matchExact(content, request.oldString), content);
    attempts.push(exact);
    if (exact.candidateCount > 1)
        return { attempts, matchedCandidate: null, errorCode: "tool.edit_multiple_candidates", similarityScore: null };
    if (exact.matched)
        return { attempts, matchedCandidate: matchExact(content, request.oldString).candidate, errorCode: null, similarityScore: null };
    const windows = buildCandidateWindows(content, request.oldString);
    const whitespace = buildAttempt("whitespace_normalized", matchNormalizedWindows(windows, request.oldString, normalizeWhitespace), content);
    attempts.push(whitespace);
    if (whitespace.candidateCount > 1)
        return { attempts, matchedCandidate: null, errorCode: "tool.edit_multiple_candidates", similarityScore: null };
    if (whitespace.matched) {
        return { attempts, matchedCandidate: matchNormalizedWindows(windows, request.oldString, normalizeWhitespace).candidate, errorCode: null, similarityScore: null };
    }
    const indentation = buildAttempt("indentation_normalized", matchNormalizedWindows(windows, request.oldString, normalizeIndentationAware), content);
    attempts.push(indentation);
    if (indentation.candidateCount > 1)
        return { attempts, matchedCandidate: null, errorCode: "tool.edit_multiple_candidates", similarityScore: null };
    if (indentation.matched) {
        return { attempts, matchedCandidate: matchNormalizedWindows(windows, request.oldString, normalizeIndentationAware).candidate, errorCode: null, similarityScore: null };
    }
    const fuzzyOutcome = matchFuzzyWindows(windows, request.oldString, 0.85);
    const fuzzy = buildAttempt("fuzzy", fuzzyOutcome, content);
    attempts.push(fuzzy);
    if (fuzzy.candidateCount > 1 && !request.beforeAnchor && !request.afterAnchor) {
        return { attempts, matchedCandidate: null, errorCode: "tool.edit_multiple_candidates", similarityScore: fuzzy.similarityScore };
    }
    if (fuzzy.matched)
        return { attempts, matchedCandidate: fuzzyOutcome.candidate, errorCode: null, similarityScore: fuzzy.similarityScore };
    const anchoredOutcome = matchAnchoredFuzzy(content, request, 0.85);
    const anchored = buildAttempt("context_anchored", anchoredOutcome, content);
    attempts.push(anchored);
    if (anchored.candidateCount > 1) {
        return { attempts, matchedCandidate: null, errorCode: "tool.edit_multiple_candidates", similarityScore: anchored.similarityScore };
    }
    if (anchored.matched)
        return { attempts, matchedCandidate: anchoredOutcome.candidate, errorCode: null, similarityScore: anchored.similarityScore };
    if (anchoredOutcome.stopReason === "similarity_too_low" || fuzzyOutcome.stopReason === "similarity_too_low") {
        return {
            attempts,
            matchedCandidate: null,
            errorCode: "tool.edit_similarity_too_low",
            similarityScore: anchored.similarityScore ?? fuzzy.similarityScore,
        };
    }
    return { attempts, matchedCandidate: null, errorCode: "tool.edit_target_not_found", similarityScore: null };
}
//# sourceMappingURL=edit-replacement-stage-support.js.map