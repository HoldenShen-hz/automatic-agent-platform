/**
 * Tool Recommend Service
 *
 * Provides intelligent tool filtering and promotion when the number of available tools is large.
 * When tools are few (below threshold), all are exposed. When tools are many, recall + promote
 * is used to surface the most relevant subset.
 *
 * Recall: Scores each tool against the task context and selects top candidates
 * Promote: Boosts specific tools (e.g., high-risk tools that are explicitly needed)
 */

import { BoundedCache } from "../../shared/utils/bounded-cache.js";
import {
  listBuiltinToolExecutionMetadata,
  resolveToolExecutionMetadata,
  type ToolExecutionMetadata,
} from "./tool-metadata.js";

export interface ToolRecommendRequest {
  /** Natural language description of the task or user request */
  taskContext: string;
  /** List of tool names to consider */
  toolNames: readonly string[];
  /** Optional list of tool names to always promote (e.g., explicitly requested tools) */
  promoteToolNames?: readonly string[];
  /** Maximum tools to expose when not using recall filtering; default 20 */
  fullExposureThreshold?: number;
  /** Maximum tools to return from recall when filtering; default 15 */
  recallLimit?: number;
  /** Optional function to compute relevance score between task context and tool */
  computeRelevanceScore?: (taskContext: string, tool: ToolExecutionMetadata) => number;
}

export interface ToolRecommendation {
  toolName: string;
  toolMetadata: ToolExecutionMetadata;
  relevanceScore: number;
  wasPromoted: boolean;
}

export interface ToolRecommendResult {
  /** Tools to expose to the user/agent */
  recommendedTools: ToolRecommendation[];
  /** Whether filtering was applied (true if tool count exceeded threshold) */
  wasFiltered: boolean;
  /** Total tools considered */
  totalToolsConsidered: number;
  /** Maximum relevance score observed */
  maxRelevanceScore: number;
}

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

export interface ToolRecommendExposureResult {
  visibleTools: ToolRecommendation[];
  deferredTools: ToolRecommendation[];
  wasFiltered: boolean;
  totalToolsConsidered: number;
  maxRelevanceScore: number;
  resolvedToolNames: readonly string[];
  unresolvedToolNames: readonly string[];
  corrections: readonly ToolNameCorrection[];
}

interface ScoredTool {
  toolName: string;
  toolMetadata: ToolExecutionMetadata;
  relevanceScore: number;
  wasPromoted: boolean;
}

const DEFAULT_FULL_EXPOSURE_THRESHOLD = 20;
const DEFAULT_RECALL_LIMIT = 15;
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
  ["budget_guard", ["read", "question"]],
  ["case_manager", ["question", "todo_write"]],
  ["change_freezer", ["read", "question"]],
  ["clause_library", ["read", "web_search"]],
  ["cue_sheet", ["read", "todo_write"]],
  ["dependency_tracker", ["read", "todo_write"]],
  ["diagnose", ["read", "question"]],
  ["evidence_matrix", ["read", "question"]],
  ["execute", ["bash"]],
  ["python", ["bash"]],
  ["repo_map", ["read"]],
  ["static_analysis", ["read", "question"]],
]);

function inferDomainToolAlias(toolName: string): readonly string[] | null {
  if (/(edit|editor|write|writer|patch|apply|redline|generator|drafter)/.test(toolName)) {
    return ["read", "apply_patch", "edit_replace", "edit_batch"];
  }

  if (/(runner|executor|launcher|router|scheduler|sync|close_calendar|order_execution)/.test(toolName)) {
    return ["read", "bash", "question"];
  }

  if (
    /(search|retrieve|lookup|fetch|reader|ingest|collector|snapshot|feed|graph|index|trace|logs?|monitor|tracker|calendar|journal|market_data|ehr|crm|hris|ledger|paper|warehouse|source|catalog)/.test(
      toolName,
    )
  ) {
    return ["read", "web_search", "web_fetch"];
  }

  if (
    /(planner|builder|analyzer|classifier|synthesizer|profiler|calculator|checker|mapper|register|registry|engine|simulator|tuner|moderator|observer|model|backtester|scorer|reporter|publisher|policy|guideline|citation|portfolio|coverage|trend|signal|status|resource|milestone|document|knowledge|clinical|care|creative|brief|strategy|incident|ticket|defect|test|experiment|recommendation|risk|quality|forecast|variance|segment|taxonomy|attribution|performance)/.test(
      toolName,
    )
  ) {
    return ["read", "question", "todo_write"];
  }

  return null;
}

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

/**
 * Expands tool name aliases into concrete runtime tool names
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

    const inferredAliases = inferDomainToolAlias(toolName);
    if (inferredAliases != null) {
      for (const alias of inferredAliases) {
        if (resolveToolExecutionMetadata(alias) != null) {
          appendUnique(resolvedToolNames, alias);
        }
      }
      if (resolvedToolNames.length > 0) {
        continue;
      }
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
 * Infers which tools should be promoted based on task context keywords
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

/**
 * Extracts keywords from task context for matching
 */
export function extractKeywords(context: string): string[] {
  const normalized = context.toLowerCase();
  // Remove common stop words
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
    "into", "through", "during", "before", "after", "above", "below",
    "between", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "each", "few",
    "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "just",
    "and", "but", "or", "if", "because", "as", "until", "while",
    "this", "that", "these", "those", "it", "its",
  ]);

  return normalized
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

/**
 * Computes keyword-based relevance score between task context and tool
 */
function computeKeywordRelevance(keywords: string[], tool: ToolExecutionMetadata): number {
  if (keywords.length === 0) {
    return 0.5; // Neutral score when no keywords
  }

  const toolName = tool.toolName.toLowerCase();
  const toolDescription = `${tool.sideEffectScope} ${tool.outputKind} ${tool.recoveryStrategy}`.toLowerCase();

  let matchedKeywords = 0;
  for (const keyword of keywords) {
    if (toolName.includes(keyword) || toolDescription.includes(keyword)) {
      matchedKeywords++;
    }
  }

  return matchedKeywords / keywords.length;
}

/**
 * Default relevance scoring function
 */
export function defaultRelevanceScore(taskContext: string, tool: ToolExecutionMetadata): number {
  const keywords = extractKeywords(taskContext);
  const keywordScore = computeKeywordRelevance(keywords, tool);

  // Boost for read-only tools when task suggests reading
  const readKeywords = ["read", "view", "get", "fetch", "list", "show", "check", "inspect"];
  const writeKeywords = ["write", "edit", "modify", "change", "update", "create", "delete", "remove", "add"];
  const execKeywords = ["run", "execute", "command", "shell", "bash", "script"];

  let behavioralBoost = 0;
  const lowerContext = taskContext.toLowerCase();

  if (readKeywords.some((kw) => lowerContext.includes(kw)) && tool.readOnly) {
    behavioralBoost += 0.15;
  }
  if (writeKeywords.some((kw) => lowerContext.includes(kw)) && !tool.readOnly) {
    behavioralBoost += 0.15;
  }
  if (execKeywords.some((kw) => lowerContext.includes(kw)) && tool.sideEffectScope === "local_process") {
    behavioralBoost += 0.15;
  }

  // Low-risk tools get slight boost for general use
  if (tool.riskLevel === "low") {
    behavioralBoost += 0.05;
  }

  return Math.min(1.0, keywordScore * 0.7 + behavioralBoost);
}

export class ToolRecommendService {
  public constructor(
    private readonly fullExposureThreshold: number = DEFAULT_FULL_EXPOSURE_THRESHOLD,
    private readonly recallLimit: number = DEFAULT_RECALL_LIMIT,
  ) {}

  /**
   * Recommends tools based on task context, applying recall filtering when tool count exceeds threshold
   */
  public recommend(request: ToolRecommendRequest): ToolRecommendResult {
    const exposure = this.recommendExposure(request);
    return {
      recommendedTools: exposure.visibleTools,
      wasFiltered: exposure.wasFiltered,
      totalToolsConsidered: exposure.totalToolsConsidered,
      maxRelevanceScore: exposure.maxRelevanceScore,
    };
  }

  public recommendExposure(request: ToolRecommendRequest): ToolRecommendExposureResult {
    const {
      taskContext,
      toolNames,
      promoteToolNames = [],
      fullExposureThreshold = this.fullExposureThreshold,
      recallLimit = this.recallLimit,
      computeRelevanceScore = defaultRelevanceScore,
    } = request;

    const expandedTools = expandToolNames(toolNames);
    const expandedPromoteTools = expandToolNames(promoteToolNames);
    const promoteSet = new Set(expandedPromoteTools.resolvedToolNames);
    const unresolvedToolNames = [
      ...expandedTools.unresolvedToolNames,
      ...expandedPromoteTools.unresolvedToolNames.filter(
        (toolName) => !expandedTools.unresolvedToolNames.includes(toolName),
      ),
    ];
    const corrections = [
      ...expandedTools.corrections,
      ...expandedPromoteTools.corrections.filter(
        (candidate) =>
          !expandedTools.corrections.some(
            (existing) =>
              existing.inputToolName === candidate.inputToolName &&
              existing.matchedCandidate === candidate.matchedCandidate &&
              existing.strategy === candidate.strategy,
          ),
      ),
    ];

    // Resolve tool metadata for all tool names
    const scoredTools: ScoredTool[] = [];
    let maxRelevanceScore = 0;

    for (const toolName of expandedTools.resolvedToolNames) {
      const metadata = resolveToolExecutionMetadata(toolName);
      if (metadata == null) {
        continue; // Skip unknown tools
      }

      const relevanceScore = computeRelevanceScore(taskContext, metadata);
      const wasPromoted = promoteSet.has(toolName);

      if (relevanceScore > maxRelevanceScore) {
        maxRelevanceScore = relevanceScore;
      }

      scoredTools.push({
        toolName,
        toolMetadata: metadata,
        relevanceScore,
        wasPromoted,
      });
    }

    // Sort by: promoted first, then by relevance score descending
    scoredTools.sort((a, b) => {
      if (a.wasPromoted !== b.wasPromoted) {
        return a.wasPromoted ? -1 : 1;
      }
      return b.relevanceScore - a.relevanceScore;
    });

    const wasFiltered = scoredTools.length > fullExposureThreshold;

    if (!wasFiltered) {
      return {
        visibleTools: scoredTools.map((t) => ({
          toolName: t.toolName,
          toolMetadata: t.toolMetadata,
          relevanceScore: t.relevanceScore,
          wasPromoted: t.wasPromoted,
        })),
        deferredTools: [],
        wasFiltered: false,
        totalToolsConsidered: scoredTools.length,
        maxRelevanceScore,
        resolvedToolNames: [...expandedTools.resolvedToolNames],
        unresolvedToolNames,
        corrections,
      };
    }

    // Apply recall filtering: take top scored tools, but always include promoted tools
    const promotedTools = scoredTools.filter((t) => t.wasPromoted);
    const nonPromotedTools = scoredTools.filter((t) => !t.wasPromoted);

    // Take top (recallLimit - promotedCount) non-promoted tools
    const allowedNonPromoted = Math.max(0, recallLimit - promotedTools.length);
    const topNonPromoted = nonPromotedTools.slice(0, allowedNonPromoted);

    const finalTools = [...promotedTools, ...topNonPromoted];

    // Sort final selection: promoted first, then by score
    finalTools.sort((a, b) => {
      if (a.wasPromoted !== b.wasPromoted) {
        return a.wasPromoted ? -1 : 1;
      }
      return b.relevanceScore - a.relevanceScore;
    });

    const visibleTools = finalTools.map((t) => ({
      toolName: t.toolName,
      toolMetadata: t.toolMetadata,
      relevanceScore: t.relevanceScore,
      wasPromoted: t.wasPromoted,
    }));
    const visibleToolNames = new Set(visibleTools.map((tool) => tool.toolName));
    const deferredTools = scoredTools
      .filter((tool) => !visibleToolNames.has(tool.toolName))
      .map((t) => ({
        toolName: t.toolName,
        toolMetadata: t.toolMetadata,
        relevanceScore: t.relevanceScore,
        wasPromoted: t.wasPromoted,
      }));

    return {
      visibleTools,
      deferredTools,
      wasFiltered: true,
      totalToolsConsidered: scoredTools.length,
      maxRelevanceScore,
      resolvedToolNames: [...expandedTools.resolvedToolNames],
      unresolvedToolNames,
      corrections,
    };
  }

  /**
   * Gets the recall score for a specific tool (for audit purposes)
   */
  public getRecallScore(taskContext: string, toolName: string): number {
    const expandedTools = expandToolNames([toolName]).resolvedToolNames;
    if (expandedTools.length === 0) {
      return 0;
    }
    return expandedTools.reduce((maxScore, resolvedToolName) => {
      const metadata = resolveToolExecutionMetadata(resolvedToolName);
      if (metadata == null) {
        return maxScore;
      }
      return Math.max(maxScore, defaultRelevanceScore(taskContext, metadata));
    }, 0);
  }
}

/**
 * Manager for tool recommend services per session
 */
export class ToolRecommendManager {
  private services: BoundedCache<string, ToolRecommendService> = new BoundedCache(20);

  /**
   * Gets or creates a recommend service for a session
   */
  public getService(sessionId: string, threshold?: number, recallLimit?: number): ToolRecommendService {
    const key = `${sessionId}:${threshold ?? DEFAULT_FULL_EXPOSURE_THRESHOLD}:${recallLimit ?? DEFAULT_RECALL_LIMIT}`;
    let service = this.services.get(key);
    if (!service) {
      service = new ToolRecommendService(threshold, recallLimit);
      this.services.set(key, service);
    }
    return service;
  }

  /**
   * Clears all cached services
   */
  public clearAll(): void {
    this.services.clear();
  }
}
