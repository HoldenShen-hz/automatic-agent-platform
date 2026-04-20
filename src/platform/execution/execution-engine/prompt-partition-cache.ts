/**
 * @fileoverview Prompt Partition Cache - Caches LLM prompt prefixes for reuse.
 *
 * Separates prompts into static (system prompt) and dynamic (conversation history)
 * parts. The static prefix is expensive to process and can be cached, while the
 * dynamic part changes with each request and must be re-processed.
 *
 * Key concepts:
 * - Static prefix: System messages at the beginning (cached)
 * - Dynamic suffix: User/assistant turns (re-processed each call)
 * - Stable cache keys allow reuse across similar prompts
 *
 * @see Context Compaction Contract: docs_zh/contracts/context_compaction_and_overflow_contract.md
 */

import { createHash } from "node:crypto";

export interface PromptPartitionMessageLike {
  role?: string | null;
  content?: unknown;
  parts?: unknown;
}

export interface PromptPartitionInput {
  model?: string | null;
  profileId?: string | null;
  domainId?: string | null;
  kvCache?: {
    enabled?: boolean;
    fixedPrefixMessageCount?: number;
    cacheKeyStrategy?: "hash_prefix" | "exact_match";
  } | null;
  messages: readonly PromptPartitionMessageLike[];
}

export interface PromptPartitionResult {
  model: string | null;
  profileId: string | null;
  domainId: string | null;
  staticMessageCount: number;
  dynamicMessageCount: number;
  stablePrefixBytes: number;
  staticDigest: string;
  dynamicDigest: string;
  staticCacheKey: string;
  dynamicCacheKey: string;
  kvCacheEnabled: boolean;
  cacheKeyStrategy: "hash_prefix" | "exact_match";
  fixedPrefixMessageCount: number;
  domainBlockMessageCount: number;
  variableMessageCount: number;
  fixedPrefixBytes: number;
  domainBlockBytes: number;
  variableSuffixBytes: number;
  fixedPrefixDigest: string;
  domainBlockDigest: string;
  variableSuffixDigest: string;
  fixedPrefixCacheKey: string;
  domainBlockCacheKey: string | null;
}

export interface PromptPartitionUsage {
  partition: PromptPartitionResult;
  firstSeenAt: string;
  lastSeenAt: string;
  reuseCount: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value == null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function messageToCanonicalString(message: PromptPartitionMessageLike): string {
  return JSON.stringify({
    role: message.role ?? null,
    content: message.content ?? null,
    parts: message.parts ?? null,
  });
}

/**
 * Determines if a message is a static system prompt that can be cached.
 * Only true for initial "system" role messages.
 */
function isStaticPromptMessage(message: PromptPartitionMessageLike): boolean {
  return (message.role ?? "").trim().toLowerCase() === "system";
}

/**
 * Partitions a prompt into static (cacheable) and dynamic parts.
 *
 * Static messages (typically system prompts) appear at the beginning and are
 * hashed to create a stable cache key. Dynamic messages (user/assistant
 * turns) form a separate hash that changes with conversation state.
 *
 * @param input - Prompt messages with optional model/profile context
 * @returns Partition result with cache keys and byte counts
 */
export function partitionPromptForCache(input: PromptPartitionInput): PromptPartitionResult {
  const staticMessages: PromptPartitionMessageLike[] = [];
  const dynamicMessages: PromptPartitionMessageLike[] = [];

  let stillStaticPrefix = true;
  for (const message of input.messages) {
    if (stillStaticPrefix && isStaticPromptMessage(message)) {
      staticMessages.push(message);
      continue;
    }
    stillStaticPrefix = false;
    dynamicMessages.push(message);
  }

  const staticPayload = staticMessages.map((message) => messageToCanonicalString(message)).join("\n");
  const dynamicPayload = dynamicMessages.map((message) => messageToCanonicalString(message)).join("\n");
  const staticDigest = sha256(staticPayload);
  const dynamicDigest = sha256(dynamicPayload);
  const model = input.model?.trim() || null;
  const profileId = input.profileId?.trim() || null;
  const domainId = input.domainId?.trim() || null;
  const kvCacheEnabled = input.kvCache?.enabled ?? true;
  const cacheKeyStrategy = input.kvCache?.cacheKeyStrategy ?? "hash_prefix";
  const requestedFixedPrefixCount = input.kvCache?.fixedPrefixMessageCount ?? (staticMessages.length > 0 ? 1 : 0);
  const fixedPrefixMessageCount = kvCacheEnabled
    ? Math.min(Math.max(requestedFixedPrefixCount, 0), staticMessages.length)
    : staticMessages.length;
  const fixedPrefixMessages = staticMessages.slice(0, fixedPrefixMessageCount);
  const domainBlockMessages = staticMessages.slice(fixedPrefixMessageCount);
  const fixedPrefixPayload = fixedPrefixMessages.map((message) => messageToCanonicalString(message)).join("\n");
  const domainBlockPayload = domainBlockMessages.map((message) => messageToCanonicalString(message)).join("\n");
  const fixedPrefixDigest = sha256(fixedPrefixPayload);
  const domainBlockDigest = sha256(domainBlockPayload);
  const variableSuffixDigest = dynamicDigest;
  const cacheScope = JSON.stringify({ model, profileId });
  const fixedPrefixCacheKeyBase = cacheKeyStrategy === "exact_match" ? fixedPrefixPayload : fixedPrefixDigest;
  const domainBlockCacheKeyBase = cacheKeyStrategy === "exact_match" ? domainBlockPayload : domainBlockDigest;

  return {
    model,
    profileId,
    domainId,
    staticMessageCount: staticMessages.length,
    dynamicMessageCount: dynamicMessages.length,
    stablePrefixBytes: Buffer.byteLength(staticPayload, "utf8"),
    staticDigest,
    dynamicDigest,
    staticCacheKey: sha256(`static:${cacheScope}:${staticDigest}`),
    dynamicCacheKey: sha256(`dynamic:${cacheScope}:${staticDigest}:${dynamicDigest}`),
    kvCacheEnabled,
    cacheKeyStrategy,
    fixedPrefixMessageCount,
    domainBlockMessageCount: domainBlockMessages.length,
    variableMessageCount: dynamicMessages.length,
    fixedPrefixBytes: Buffer.byteLength(fixedPrefixPayload, "utf8"),
    domainBlockBytes: Buffer.byteLength(domainBlockPayload, "utf8"),
    variableSuffixBytes: Buffer.byteLength(dynamicPayload, "utf8"),
    fixedPrefixDigest,
    domainBlockDigest,
    variableSuffixDigest,
    fixedPrefixCacheKey: sha256(`fixed:${cacheScope}:${fixedPrefixCacheKeyBase}`),
    domainBlockCacheKey:
      domainBlockMessages.length > 0
        ? sha256(`domain:${cacheScope}:${domainId ?? "global"}:${domainBlockCacheKeyBase}`)
        : null,
  };
}

/**
 * Service for tracking prompt partition cache usage.
 *
 * Records partition results and tracks reuse counts to measure cache
 * effectiveness. Used by the context compaction service to decide
 * when to evict cache entries.
 */
export class PromptPartitionCacheService {
  private readonly usage = new Map<string, PromptPartitionUsage>();

  /**
   * Records a prompt partition and returns usage statistics.
   * Increments reuse count if this partition was seen before.
   */
  public record(input: PromptPartitionInput): PromptPartitionUsage {
    const partition = partitionPromptForCache(input);
    const key = partition.dynamicCacheKey;
    const existing = this.usage.get(key);
    if (existing) {
      const next: PromptPartitionUsage = {
        partition,
        firstSeenAt: existing.firstSeenAt,
        lastSeenAt: nowIso(),
        reuseCount: existing.reuseCount + 1,
      };
      this.usage.set(key, next);
      return next;
    }

    const created: PromptPartitionUsage = {
      partition,
      firstSeenAt: nowIso(),
      lastSeenAt: nowIso(),
      reuseCount: 0,
    };
    this.usage.set(key, created);
    return created;
  }

  /**
   * Returns usage statistics for a specific partition key.
   */
  public getUsage(dynamicCacheKey: string): PromptPartitionUsage | null {
    return this.usage.get(dynamicCacheKey) ?? null;
  }

  /**
   * Lists all tracked partition usage records sorted by key.
   */
  public listUsage(): PromptPartitionUsage[] {
    return Array.from(this.usage.values()).sort((left, right) =>
      left.partition.dynamicCacheKey.localeCompare(right.partition.dynamicCacheKey),
    );
  }

  /**
   * Clears all tracked usage statistics.
   */
  public clear(): void {
    this.usage.clear();
  }
}
