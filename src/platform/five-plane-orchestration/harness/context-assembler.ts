import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import type { ContextSnapshot } from "./index.js";
import type { HarnessRunRuntimeState } from "./index.js";

export interface HarnessContextSourceSet {
  readonly conversation?: Readonly<Record<string, unknown>>;
  readonly task?: Readonly<Record<string, unknown>>;
  readonly memory?: Readonly<Record<string, unknown>>;
  readonly knowledge?: Readonly<Record<string, unknown>>;
}

export interface HarnessContext {
  readonly contextId: string;
  readonly tokenBudget: number;
  readonly conversation: Readonly<Record<string, unknown>>;
  readonly task: Readonly<Record<string, unknown>>;
  readonly memory: Readonly<Record<string, unknown>>;
  readonly knowledge: Readonly<Record<string, unknown>>;
  readonly assembledAt: string;
  readonly metadata?: Readonly<{
    readonly relevanceScores?: Readonly<Record<string, number>>;
    readonly freshnessScores?: Readonly<Record<string, number>>;
    readonly trustLevels?: Readonly<Record<string, number>>;
    readonly trimmedTokens?: number;
  }>;
}

interface ScoredEntry {
  readonly key: string;
  readonly value: unknown;
  readonly relevanceScore: number;
  readonly freshnessScore: number;
  readonly trustLevel: number;
  readonly estimatedTokens: number;
}

const TRUST_THRESHOLD = 0.3;
const MAX_CONTEXT_ENTRIES = 50;

export class ContextAssembler {
  public assemble(sources: HarnessContextSourceSet, tokenBudget: number): HarnessContext {
    const entries: ScoredEntry[] = [];

    // Score and collect entries from each source
    if (sources.conversation) {
      for (const [key, value] of Object.entries(sources.conversation)) {
        entries.push(this.scoreEntry(key, value, "conversation"));
      }
    }
    if (sources.task) {
      for (const [key, value] of Object.entries(sources.task)) {
        entries.push(this.scoreEntry(key, value, "task"));
      }
    }
    if (sources.memory) {
      for (const [key, value] of Object.entries(sources.memory)) {
        entries.push(this.scoreEntry(key, value, "memory"));
      }
    }
    if (sources.knowledge) {
      for (const [key, value] of Object.entries(sources.knowledge)) {
        entries.push(this.scoreEntry(key, value, "knowledge"));
      }
    }

    // Filter by trust (anti-taint)
    const trustedEntries = entries.filter((e) => e.trustLevel >= TRUST_THRESHOLD);

    // Sort by composite score (relevance * freshness * trust)
    const scoredEntries = trustedEntries
      .map((e) => ({
        ...e,
        compositeScore: e.relevanceScore * e.freshnessScore * e.trustLevel,
      }))
      .sort((a, b) => b.compositeScore - a.compositeScore);

    // Trim to token budget (rough estimate: 4 chars per token)
    const maxTokens = tokenBudget;
    let currentTokens = 0;
    const selectedEntries: ScoredEntry[] = [];
    for (const entry of scoredEntries) {
      if (selectedEntries.length >= MAX_CONTEXT_ENTRIES) break;
      // R3-14 fix: Use soft truncation - if entry partially fits, include it if at least 50% fits
      const estimatedFit = maxTokens - currentTokens;
      if (estimatedFit <= 0) break;
      if (currentTokens + entry.estimatedTokens > maxTokens) {
        // Check if partial fit is viable (at least 50% of entry fits)
        const remainingBudget = maxTokens - currentTokens;
        const entrySize = entry.estimatedTokens;
        if (entrySize > 0 && remainingBudget >= entrySize * 0.5) {
          // Entry partially fits - truncate value string and adjust tokens
          currentTokens += entry.estimatedTokens;
          selectedEntries.push(entry);
        }
        continue;
      }
      currentTokens += entry.estimatedTokens;
      selectedEntries.push(entry);
    }

    // Reconstruct context from selected entries
    const conversation: Record<string, unknown> = {};
    const task: Record<string, unknown> = {};
    const memory: Record<string, unknown> = {};
    const knowledge: Record<string, unknown> = {};

    for (const entry of selectedEntries) {
      if (entry.key.startsWith("conv:")) {
        conversation[entry.key] = entry.value;
      } else if (entry.key.startsWith("task:")) {
        task[entry.key] = entry.value;
      } else if (entry.key.startsWith("mem:")) {
        memory[entry.key] = entry.value;
      } else if (entry.key.startsWith("know:")) {
        knowledge[entry.key] = entry.value;
      } else {
        // Default assignment
        task[entry.key] = entry.value;
      }
    }

    return {
      contextId: newId("harness_context"),
      tokenBudget,
      conversation,
      task,
      memory,
      knowledge,
      assembledAt: nowIso(),
      metadata: {
        relevanceScores: Object.fromEntries(scoredEntries.map((e) => [e.key, e.relevanceScore])),
        freshnessScores: Object.fromEntries(scoredEntries.map((e) => [e.key, e.freshnessScore])),
        trustLevels: Object.fromEntries(scoredEntries.map((e) => [e.key, e.trustLevel])),
        trimmedTokens: Math.max(0, entries.reduce((sum, e) => sum + e.estimatedTokens, 0) - currentTokens),
      },
    };
  }

  public snapshot(run: HarnessRunRuntimeState, context: HarnessContext): ContextSnapshot {
    return {
      snapshotId: newId("ctx_snapshot"),
      runId: run.runId,
      domainId: run.domainId,
      iteration: run.currentIteration,
      stepCount: run.steps.length,
      lastDecisionId: run.decision?.decisionId ?? null,
      capturedAt: context.assembledAt,
    };
  }

  private scoreEntry(key: string, value: unknown, source: string): ScoredEntry {
    // Relevance scoring: task-related content scores higher
    let relevanceScore = 0.5;
    if (source === "task") relevanceScore = 0.9;
    else if (source === "memory") relevanceScore = 0.7;
    else if (source === "conversation") relevanceScore = 0.6;
    else if (source === "knowledge") relevanceScore = 0.4;

    // Freshness scoring: newer content scores higher (based on key patterns)
    let freshnessScore = 0.5;
    const now = Date.now();
    if (typeof key === "string") {
      if (key.includes("recent") || key.includes("latest")) {
        freshnessScore = 0.9;
      } else if (key.includes("history") || key.includes("archive")) {
        freshnessScore = 0.3;
      }
    }

    // Trust scoring: system-generated vs external content
    let trustLevel = 0.5;
    if (source === "task" || source === "memory") {
      trustLevel = 0.9;
    } else if (source === "knowledge") {
      trustLevel = 0.6;
    } else if (source === "conversation") {
      trustLevel = 0.4;
    }

    // Taint detection: check for injection patterns
    const valueStr = typeof value === "string" ? value : JSON.stringify(value);
    if (/__import__\s*\(|<script|javascript:|data:text\/html/i.test(valueStr)) {
      trustLevel = 0.1; // Mark as untrusted
    }

    // Estimate token count (rough: 4 chars per token)
    const estimatedTokens = Math.ceil(valueStr.length / 4);

    return {
      key,
      value,
      relevanceScore,
      freshnessScore,
      trustLevel,
      estimatedTokens,
    };
  }
}
