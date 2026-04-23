/**
 * @fileoverview Edit Replacement Matching - Core matching algorithms.
 *
 * Multi-stage matching algorithm that progressively relaxes matching criteria:
 * 1. exact - literal string match
 * 2. whitespace_normalized - ignores spaces/tabs, trims lines
 * 3. indentation_normalized - normalizes indentation levels
 * 4. fuzzy - Dice coefficient similarity (threshold: 85%)
 * 5. context_anchored - fuzzy match within before/after anchor region
 */
import { normalizeIndentationAware } from "./string-utils.js";
/**
 * Performs exact string matching to find all occurrences.
 */
export function matchExact(content, needle) {
    const candidates = findAllOccurrences(content, needle);
    return toExactOutcome(candidates);
}
/**
 * Matches candidates after applying a normalization function.
 */
export function matchNormalizedWindows(windows, oldString, normalizer) {
    const normalizedOld = normalizer(oldString);
    const candidates = windows.filter((window) => normalizer(window.text) === normalizedOld);
    return toExactOutcome(candidates);
}
/**
 * Performs fuzzy matching using Dice coefficient similarity.
 * Returns match if exactly one candidate exceeds the threshold.
 */
export function matchFuzzyWindows(windows, oldString, threshold) {
    const normalizedOld = normalizeIndentationAware(oldString);
    // Score all windows by Dice coefficient and filter by threshold
    const scored = windows
        .map((window) => ({
        window,
        score: calculateDiceSimilarity(normalizedOld, normalizeIndentationAware(window.text)),
    }))
        .filter((item) => item.score >= threshold)
        .sort((left, right) => right.score - left.score);
    // No candidates above threshold
    if (scored.length === 0) {
        // Calculate best score for diagnostics
        const bestScore = windows.reduce((best, window) => {
            return Math.max(best, calculateDiceSimilarity(normalizedOld, normalizeIndentationAware(window.text)));
        }, 0);
        return {
            matched: false,
            candidateCount: 0,
            candidate: null,
            similarityScore: bestScore > 0 ? bestScore : null,
            warningCodes: [],
            stopReason: bestScore > 0 ? "similarity_too_low" : "not_found",
        };
    }
    // Multiple candidates above threshold (ambiguous)
    if (scored.length > 1) {
        return {
            matched: false,
            candidateCount: scored.length,
            candidate: null,
            similarityScore: scored[0]?.score ?? null,
            warningCodes: [],
            stopReason: "multiple_candidates",
        };
    }
    // Exactly one candidate above threshold (success)
    return {
        matched: true,
        candidateCount: 1,
        candidate: scored[0]?.window ?? null,
        similarityScore: scored[0]?.score ?? null,
        warningCodes: ["fuzzy_edit_applied"],
        stopReason: "matched",
    };
}
/**
 * Performs fuzzy matching constrained to a region defined by beforeAnchor and afterAnchor.
 * If anchors are not provided, returns not_found.
 */
export function matchAnchoredFuzzy(content, request, threshold) {
    // Anchors are required for this matching stage
    if (!request.beforeAnchor && !request.afterAnchor) {
        return {
            matched: false,
            candidateCount: 0,
            candidate: null,
            similarityScore: null,
            warningCodes: [],
            stopReason: "not_found",
        };
    }
    // Find anchor positions in content
    const beforeMatches = request.beforeAnchor ? findAllOccurrences(content, request.beforeAnchor) : [];
    const afterMatches = request.afterAnchor ? findAllOccurrences(content, request.afterAnchor) : [];
    // Anchors must be unique or it is ambiguous
    if (beforeMatches.length > 1 || afterMatches.length > 1) {
        return {
            matched: false,
            candidateCount: Math.max(beforeMatches.length, afterMatches.length),
            candidate: null,
            similarityScore: null,
            warningCodes: [],
            stopReason: "multiple_candidates",
        };
    }
    // Define search region between anchors
    const startOffset = beforeMatches[0]?.endOffset ?? 0;
    const endOffset = afterMatches[0]?.startOffset ?? content.length;
    // Invalid region (anchors in wrong order or overlapping)
    if (startOffset >= endOffset) {
        return {
            matched: false,
            candidateCount: 0,
            candidate: null,
            similarityScore: null,
            warningCodes: [],
            stopReason: "not_found",
        };
    }
    // Extract region and build candidate windows within it
    const slice = content.slice(startOffset, endOffset);
    const exactLineCount = Math.max(1, request.oldString.split("\n").length);
    const sliceWindows = buildCandidateWindows(slice, request.oldString, {
        minSpan: exactLineCount,
        maxSpan: exactLineCount,
    }).map((window) => ({
        ...window,
        startOffset: window.startOffset + startOffset,
        endOffset: window.endOffset + startOffset,
    }));
    // Run fuzzy matching within the anchored region
    const outcome = matchFuzzyWindows(sliceWindows, request.oldString, threshold);
    if (!outcome.matched) {
        return outcome;
    }
    // Add anchor warning to indicate this was a context-anchored match
    return {
        ...outcome,
        warningCodes: ["anchored_fuzzy_edit_applied"],
    };
}
/**
 * Converts a list of match candidates to a MatchOutcome.
 */
export function toExactOutcome(candidates) {
    if (candidates.length === 1) {
        return {
            matched: true,
            candidateCount: 1,
            candidate: candidates[0] ?? null,
            similarityScore: null,
            warningCodes: [],
            stopReason: "matched",
        };
    }
    if (candidates.length > 1) {
        return {
            matched: false,
            candidateCount: candidates.length,
            candidate: null,
            similarityScore: null,
            warningCodes: [],
            stopReason: "multiple_candidates",
        };
    }
    return {
        matched: false,
        candidateCount: 0,
        candidate: null,
        similarityScore: null,
        warningCodes: [],
        stopReason: "not_found",
    };
}
/**
 * Finds all occurrences of a string in content.
 * Returns array of MatchCandidate with byte offsets.
 */
export function findAllOccurrences(content, needle) {
    if (needle.length === 0) {
        return [];
    }
    const matches = [];
    let fromIndex = 0;
    // Iterate through all positions, finding each occurrence
    while (fromIndex <= content.length) {
        const index = content.indexOf(needle, fromIndex);
        if (index === -1) {
            break;
        }
        matches.push({
            startOffset: index,
            endOffset: index + needle.length,
            text: needle,
        });
        fromIndex = index + 1;
    }
    return matches;
}
/**
 * Builds a set of candidate windows (substrings) from content
 * that could potentially match oldString.
 *
 * Windows are generated by sliding across lines with varying spans
 * (number of lines) to account for whitespace/indentation differences.
 */
export function buildCandidateWindows(content, oldString, options) {
    const lines = content.split("\n");
    const lineOffsets = computeLineOffsets(content);
    const oldLineCount = Math.max(1, oldString.split("\n").length);
    // Allow span to vary by ±2 lines to handle minor line count differences
    const minSpan = Math.max(1, options?.minSpan ?? oldLineCount - 2);
    const maxSpan = Math.min(lines.length, options?.maxSpan ?? oldLineCount + 2);
    const windows = [];
    // Generate all windows with different starting lines and spans
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        for (let span = minSpan; span <= maxSpan; span += 1) {
            const endLine = lineIndex + span;
            if (endLine > lines.length) {
                break;
            }
            const startOffset = lineOffsets[lineIndex] ?? 0;
            const endOffset = endLine >= lineOffsets.length ? content.length : (lineOffsets[endLine] ?? content.length);
            windows.push({
                startOffset,
                endOffset,
                text: content.slice(startOffset, endOffset),
            });
        }
    }
    return dedupeWindows(windows);
}
/**
 * Removes duplicate windows that have the same start and end offsets.
 */
export function dedupeWindows(windows) {
    const seen = new Set();
    return windows.filter((window) => {
        const key = `${window.startOffset}:${window.endOffset}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
/**
 * Computes the byte offset for the start of each line in content.
 * Returns array where index is line number (0-based) and value is byte offset.
 */
export function computeLineOffsets(content) {
    const offsets = [0];
    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === "\n") {
            offsets.push(index + 1);
        }
    }
    return offsets;
}
/**
 * Calculates Dice coefficient similarity between two strings.
 * Dice coefficient measures bigram overlap: 2 * |intersection| / |total|.
 */
function calculateDiceSimilarity(left, right) {
    if (left === right) {
        return 1;
    }
    const leftNormalized = left.trim();
    const rightNormalized = right.trim();
    // Short strings: return 1 if identical, 0 otherwise
    if (leftNormalized.length < 2 || rightNormalized.length < 2) {
        return leftNormalized === rightNormalized ? 1 : 0;
    }
    // Build bigram counts for both strings
    const leftBigrams = buildBigrams(leftNormalized);
    const rightBigrams = buildBigrams(rightNormalized);
    // Count overlapping bigrams
    let overlap = 0;
    for (const [bigram, count] of leftBigrams) {
        overlap += Math.min(count, rightBigrams.get(bigram) ?? 0);
    }
    // Dice coefficient formula: 2 * overlap / (total bigrams)
    const total = Array.from(leftBigrams.values()).reduce((sum, count) => sum + count, 0)
        + Array.from(rightBigrams.values()).reduce((sum, count) => sum + count, 0);
    return total === 0 ? 0 : (2 * overlap) / total;
}
/**
 * Builds a map of character bigrams (2-character substrings) to their occurrence counts.
 */
function buildBigrams(value) {
    const map = new Map();
    for (let index = 0; index < value.length - 1; index += 1) {
        const bigram = value.slice(index, index + 2);
        map.set(bigram, (map.get(bigram) ?? 0) + 1);
    }
    return map;
}
/**
 * Converts a byte offset to line and column coordinates (1-indexed).
 */
export function offsetToLineColumn(content, offset) {
    let line = 1;
    let column = 1;
    for (let index = 0; index < offset && index < content.length; index += 1) {
        if (content[index] === "\n") {
            line += 1;
            column = 1;
        }
        else {
            column += 1;
        }
    }
    return { line, column };
}
//# sourceMappingURL=match.js.map