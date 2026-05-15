/**
 * Tool Discovery - Cross-plane tool name resolution and expansion utilities.
 *
 * Provides tool name alias resolution, fuzzy matching, and expansion services
 * for use across different planes (org-governance, execution, etc.) without
 * creating cross-plane dependencies on tool-executor internals.
 *
 * This module is intentionally minimal and depends only on tool-metadata types
 * which are already shared infrastructure types.
 */

import {
  listBuiltinToolExecutionMetadata,
  resolveToolExecutionMetadata,
  type ToolExecutionMetadata,
} from "../../five-plane-execution/tool-executor/tool-metadata.js";

// Re-export ToolExecutionMetadata for consumers
export type { ToolExecutionMetadata } from "../../five-plane-execution/tool-executor/tool-metadata.js";

export interface ExpandedToolNames {
  resolvedToolNames: readonly string[];
  unresolvedToolNames: readonly string[];
  corrections: readonly ToolNameCorrection[];
}

export interface ToolNameCorrection {
  inputToolName: string;
  matchedCandidate: string;
  resolvedToolNames: readonly string[];
  strategy: "normalized_exact" | "fuzzy_unique";
}

const TOOL_NAME_ALIASES = new Map<string, readonly string[]>([
  ["read", ["read"]],
  ["bash", ["bash"]],
  ["command", ["command_exec", "bash"]],
  ["shell", ["bash"]],
  ["edit", ["edit_replace", "edit_batch", "apply_patch"]],
  ["write", ["edit_replace", "edit_batch", "apply_patch"]],
  ["patch", ["apply_patch"]],
  ["question", ["question"]],
  ["todo", ["todo_write"]],
]);

function normalizeToolName(toolName: string): string {
  return toolName.trim().toLowerCase();
}

function normalizeCompactToolName(toolName: string): string {
  return normalizeToolName(toolName).replace(/[_\-\s]+/g, "");
}

function appendUnique(items: string[], value: string): void {
  if (!items.includes(value)) {
    items.push(value);
  }
}

interface ToolNameCandidate {
  candidateName: string;
  normalizedCompactName: string;
  resolvedToolNames: readonly string[];
}

function buildNormalizedCandidateMap(): Map<string, ToolNameCandidate> {
  const candidates = new Map<string, ToolNameCandidate>();

  for (const metadata of listBuiltinToolExecutionMetadata()) {
    const normalized = normalizeCompactToolName(metadata.toolName);
    candidates.set(normalized, {
      candidateName: metadata.toolName,
      normalizedCompactName: normalized,
      resolvedToolNames: [metadata.toolName],
    });
  }

  for (const [alias, resolvedToolNames] of TOOL_NAME_ALIASES.entries()) {
    const normalized = normalizeCompactToolName(alias);
    if (!candidates.has(normalized)) {
      candidates.set(normalized, {
        candidateName: alias,
        normalizedCompactName: normalized,
        resolvedToolNames: [...resolvedToolNames],
      });
    }
  }

  return candidates;
}

function buildFuzzyCandidateList(): ToolNameCandidate[] {
  const candidatesByKey = new Map<string, ToolNameCandidate>();

  for (const metadata of listBuiltinToolExecutionMetadata()) {
    const candidate: ToolNameCandidate = {
      candidateName: metadata.toolName,
      normalizedCompactName: normalizeCompactToolName(metadata.toolName),
      resolvedToolNames: [metadata.toolName],
    };
    candidatesByKey.set(`${candidate.normalizedCompactName}:${candidate.resolvedToolNames.join(",")}`, candidate);
  }

  for (const [alias, resolvedToolNames] of TOOL_NAME_ALIASES.entries()) {
    if (resolvedToolNames.length !== 1) {
      continue;
    }
    const candidate: ToolNameCandidate = {
      candidateName: alias,
      normalizedCompactName: normalizeCompactToolName(alias),
      resolvedToolNames: [...resolvedToolNames],
    };
    candidatesByKey.set(`${candidate.normalizedCompactName}:${candidate.resolvedToolNames.join(",")}`, candidate);
  }

  return [...candidatesByKey.values()];
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + substitutionCost,
      );
    }
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j]!;
    }
  }

  return previous[right.length]!;
}

function findUniqueFuzzyToolMatch(
  normalizedCompactName: string,
  candidates: readonly ToolNameCandidate[],
): ToolNameCandidate | null {
  if (!/^[a-z0-9_:-]+$/i.test(normalizedCompactName) || normalizedCompactName.length < 3) {
    return null;
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  const bestMatches: ToolNameCandidate[] = [];

  for (const candidate of candidates) {
    const distance = levenshteinDistance(normalizedCompactName, candidate.normalizedCompactName);
    if (distance > 2) {
      continue;
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatches.length = 0;
      bestMatches.push(candidate);
      continue;
    }
    if (distance === bestDistance) {
      bestMatches.push(candidate);
    }
  }

  if (bestMatches.length !== 1) {
    return null;
  }

  return bestMatches[0] ?? null;
}

/**
 * Expands tool name aliases into concrete runtime tool names.
 * @param toolNames - Array of tool names or aliases to expand
 * @returns ExpandedToolNames with resolvedToolNames and unresolvedToolNames
 */
export function expandToolNames(toolNames: readonly string[]): ExpandedToolNames {
  const resolvedToolNames: string[] = [];
  const unresolvedToolNames: string[] = [];
  const corrections: ToolNameCorrection[] = [];
  const normalizedCandidates = buildNormalizedCandidateMap();
  const fuzzyCandidates = buildFuzzyCandidateList();

  for (const inputToolName of toolNames) {
    const toolName = normalizeToolName(inputToolName);
    if (toolName.length === 0) {
      continue;
    }

    if (resolveToolExecutionMetadata(toolName) != null) {
      appendUnique(resolvedToolNames, toolName);
      continue;
    }

    const aliases = TOOL_NAME_ALIASES.get(toolName);
    if (aliases != null) {
      for (const alias of aliases) {
        if (resolveToolExecutionMetadata(alias) != null) {
          appendUnique(resolvedToolNames, alias);
        }
      }
      continue;
    }

    const compactName = normalizeCompactToolName(toolName);
    const normalizedMatch = normalizedCandidates.get(compactName);
    if (normalizedMatch != null) {
      for (const resolvedToolName of normalizedMatch.resolvedToolNames) {
        appendUnique(resolvedToolNames, resolvedToolName);
      }
      corrections.push({
        inputToolName,
        matchedCandidate: normalizedMatch.candidateName,
        resolvedToolNames: [...normalizedMatch.resolvedToolNames],
        strategy: "normalized_exact",
      });
      continue;
    }

    const fuzzyMatch = findUniqueFuzzyToolMatch(compactName, fuzzyCandidates);
    if (fuzzyMatch != null) {
      for (const resolvedToolName of fuzzyMatch.resolvedToolNames) {
        appendUnique(resolvedToolNames, resolvedToolName);
      }
      corrections.push({
        inputToolName,
        matchedCandidate: fuzzyMatch.candidateName,
        resolvedToolNames: [...fuzzyMatch.resolvedToolNames],
        strategy: "fuzzy_unique",
      });
      continue;
    }

    appendUnique(unresolvedToolNames, toolName);
  }

  return {
    resolvedToolNames,
    unresolvedToolNames,
    corrections,
  };
}

/**
 * Infers which tools should be promoted based on task context keywords.
 * @param taskContext - Natural language description of the task
 * @param toolNames - Available tool names to consider for promotion
 * @returns Array of tool names that should be promoted
 */
export function inferPromotedToolNames(taskContext: string, toolNames: readonly string[]): string[] {
  const lowerContext = taskContext.toLowerCase();
  const availableTools = new Set(expandToolNames(toolNames).resolvedToolNames);
  const promotedTools: string[] = [];

  const promotionRules: Array<{ keywords: readonly string[]; resolvedToolNames: readonly string[] }> = [
    { keywords: ["patch", "diff"], resolvedToolNames: ["apply_patch"] },
    { keywords: ["batch", "multiple edits", "atomic"], resolvedToolNames: ["edit_batch"] },
    { keywords: ["edit", "modify", "change", "update", "replace", "write"], resolvedToolNames: ["edit_replace"] },
    { keywords: ["command", "shell", "bash", "terminal", "script", "run"], resolvedToolNames: ["command_exec", "bash"] },
    { keywords: ["read", "view", "inspect", "show", "list", "check"], resolvedToolNames: ["read"] },
    { keywords: ["question", "ask", "clarify", "confirm", "approval"], resolvedToolNames: ["question"] },
    { keywords: ["todo", "checklist", "progress"], resolvedToolNames: ["todo_write"] },
  ];

  for (const rule of promotionRules) {
    if (!rule.keywords.some((keyword) => lowerContext.includes(keyword))) {
      continue;
    }
    for (const toolName of rule.resolvedToolNames) {
      if (availableTools.has(toolName)) {
        appendUnique(promotedTools, toolName);
      }
    }
  }

  return promotedTools;
}
