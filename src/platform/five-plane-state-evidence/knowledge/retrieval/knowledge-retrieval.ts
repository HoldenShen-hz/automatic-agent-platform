import { CitationBuilder } from "../governance/citation-builder.js";
import {
  KnowledgeAccessControl,
  type KnowledgeAccessDecision,
  type KnowledgeAccessPrincipal,
} from "../governance/access-control.js";
import { FreshnessTracker } from "../governance/freshness-tracker.js";
import { KnowledgeAuditLogger } from "../governance/knowledge-audit-logger.js";
import { SourceTrustPolicyRegistry } from "../governance/source-trust-policy.js";
import type { ArchivedKnowledgeChunkRecord, KnowledgeArchive } from "../archive/knowledge-archive.js";
import type { KeywordKnowledgeIndex } from "../keyword-index.js";
import type { NamespacePolicyStore } from "../governance/namespace-policy.js";
import type { RetrievalHit } from "../knowledge-model.js";
import type { SemanticKnowledgeGraph } from "../semantic-knowledge-graph.js";
import { buildSemanticEmbedding, cosineSimilarity } from "../semantic-embedding.js";
import type { SemanticVectorCandidate, SemanticVectorStore } from "../semantic-vector-store.js";

export interface KnowledgeQueryOptions {
  namespace?: string;
  domainId?: string | null;
  accessPrincipal?: KnowledgeAccessPrincipal | null;
  includeUnverified?: boolean;
  limit?: number;
}

function countOccurrences(content: string, keyword: string): number {
  const normalizedContent = content.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();
  let count = 0;
  let start = 0;
  while (true) {
    const index = normalizedContent.indexOf(normalizedKeyword, start);
    if (index === -1) {
      return count;
    }
    count += 1;
    start = index + normalizedKeyword.length;
  }
}

function normalizeQueryTerms(keyword: string): string[] {
  const trimmed = keyword.trim().toLowerCase();
  if (trimmed.length === 0) {
    return [];
  }
  const tokens = trimmed
    .split(/[^a-z0-9_]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
  const terms = new Set<string>();
  if (trimmed.length >= 3) {
    terms.add(trimmed);
  }
  for (const token of tokens) {
    terms.add(token);
  }
  return [...terms].slice(0, 8);
}

function freshnessMultiplierFor(action: KnowledgeQueryOptions["namespace"] | "warn" | "demote" | "archive" | "delete" | null): number {
  switch (action) {
    case "warn":
      return 0.95;
    case "demote":
      return 0.75;
    case "archive":
      return 0.5;
    case "delete":
      return 0.2;
    default:
      return 1;
  }
}

const SEMANTIC_CANDIDATE_LIMIT = 12;
const SEMANTIC_MATCH_THRESHOLD = 0.18;

export class KnowledgeRetrievalService {
  private readonly accessControl = new KnowledgeAccessControl();
  private readonly auditLogger: KnowledgeAuditLogger;
  private readonly freshness = new FreshnessTracker();
  private readonly trustPolicies = new SourceTrustPolicyRegistry();
  private readonly citations = new CitationBuilder();

  public constructor(
    private readonly index: KeywordKnowledgeIndex,
    private readonly archive: KnowledgeArchive,
    private readonly namespacePolicies: NamespacePolicyStore,
    private readonly semanticGraph: SemanticKnowledgeGraph | null = null,
    private readonly semanticVectorStore: SemanticVectorStore | null = null,
    auditLogger: KnowledgeAuditLogger = new KnowledgeAuditLogger(),
  ) {
    this.auditLogger = auditLogger;
  }

  public query(keyword: string, options: KnowledgeQueryOptions = {}): RetrievalHit[] {
    return this.buildQueryResults(keyword, options, this.collectSemanticCandidates(keyword, options));
  }

  public async queryAsync(keyword: string, options: KnowledgeQueryOptions = {}): Promise<RetrievalHit[]> {
    return this.buildQueryResults(keyword, options, await this.collectSemanticCandidatesAsync(keyword, options));
  }

  public filterAuthorizedHits(hits: readonly RetrievalHit[], options: KnowledgeQueryOptions = {}): RetrievalHit[] {
    const accessDecisions = new Map<string, KnowledgeAccessDecision>();
    return hits.filter((hit) => {
      const chunkId = hit.knowledgeRef.startsWith("knowledge:") ? hit.knowledgeRef.slice("knowledge:".length) : hit.chunkId;
      const chunkRecord = this.archive.getChunk(chunkId);
      if (!chunkRecord) {
        return false;
      }
      return this.getAccessContext(chunkRecord, options, accessDecisions) != null;
    });
  }

  private buildQueryResults(
    keyword: string,
    options: KnowledgeQueryOptions,
    semanticCandidates: Array<[string, number]>,
  ): RetrievalHit[] {
    const queryTerms = normalizeQueryTerms(keyword);
    const directHits = new Map<string, { hit: RetrievalHit; exactMatchScore: number; matchedTerms: Set<string> }>();
    const semanticScores = new Map<string, number>();
    const accessDecisions = new Map<string, KnowledgeAccessDecision>();

    for (const term of queryTerms.length > 0 ? queryTerms : [keyword.trim().toLowerCase()]) {
      if (term.length === 0) {
        continue;
      }
      for (const hit of this.index.query(term)) {
        if (options.namespace != null && hit.namespace !== options.namespace) {
          continue;
        }
        const existing = directHits.get(hit.knowledgeRef);
        if (existing) {
          existing.exactMatchScore += hit.score;
          existing.matchedTerms.add(term);
          continue;
        }
        directHits.set(hit.knowledgeRef, {
          hit,
          exactMatchScore: hit.score,
          matchedTerms: new Set([term]),
        });
      }
    }

    const directKnowledgeRefs = new Set(directHits.keys());
    const candidateKnowledgeRefs = new Set<string>(directKnowledgeRefs);
    for (const [knowledgeRef, similarity] of semanticCandidates) {
      semanticScores.set(knowledgeRef, similarity);
      candidateKnowledgeRefs.add(knowledgeRef);
    }
    if (this.semanticGraph) {
      for (const term of queryTerms) {
        for (const knowledgeRef of this.semanticGraph.findChunkKnowledgeRefsByKeyword(term, options.namespace)) {
          candidateKnowledgeRefs.add(knowledgeRef);
        }
      }
      for (const knowledgeRef of directKnowledgeRefs) {
        const connections = this.semanticGraph.getChunkConnections(knowledgeRef);
        if (!connections) {
          continue;
        }
        for (const related of [...connections.sharedKeywordRefs, ...connections.sameDocumentRefs]) {
          candidateKnowledgeRefs.add(related);
        }
      }
    }

    return [...candidateKnowledgeRefs]
      .map((knowledgeRef) => this.buildRankedHit(
        knowledgeRef,
        queryTerms,
        directHits,
        directKnowledgeRefs,
        semanticScores,
        options,
        accessDecisions,
      ))
      .filter((hit): hit is RetrievalHit => hit != null)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (left.matchType !== right.matchType) {
          return left.matchType === "keyword" ? -1 : 1;
        }
        return left.knowledgeRef.localeCompare(right.knowledgeRef);
      })
      .slice(0, options.limit ?? 10);
  }

  private buildRankedHit(
    knowledgeRef: string,
    queryTerms: readonly string[],
    directHits: ReadonlyMap<string, { hit: RetrievalHit; exactMatchScore: number; matchedTerms: Set<string> }>,
    directKnowledgeRefs: ReadonlySet<string>,
    semanticScores: ReadonlyMap<string, number>,
    options: KnowledgeQueryOptions,
    accessDecisions: Map<string, KnowledgeAccessDecision>,
  ): RetrievalHit | null {
    const chunkId = knowledgeRef.startsWith("knowledge:") ? knowledgeRef.slice("knowledge:".length) : knowledgeRef;
    const chunkRecord = this.archive.getChunk(chunkId);
    if (!chunkRecord) {
      return null;
    }
    const accessContext = this.getAccessContext(chunkRecord, options, accessDecisions);
    if (!accessContext) {
      return null;
    }

    const connectionInfo = this.semanticGraph?.getChunkConnections(knowledgeRef);
    const matchedTerms = new Set<string>(directHits.get(knowledgeRef)?.matchedTerms ?? []);
    for (const term of queryTerms) {
      if (chunkRecord.chunk.keywords.some((keyword) => keyword.toLowerCase() === term) || countOccurrences(chunkRecord.chunk.content, term) > 0) {
        matchedTerms.add(term);
      }
    }

    const sharedKeywordNeighborCount = (connectionInfo?.sharedKeywordRefs ?? []).filter((ref) => directKnowledgeRefs.has(ref)).length;
    const sameDocumentNeighborCount = (connectionInfo?.sameDocumentRefs ?? []).filter((ref) => directKnowledgeRefs.has(ref)).length;
    const directMatch = directHits.get(knowledgeRef);
    const semanticSimilarity = semanticScores.get(knowledgeRef) ?? 0;
    const keywordCoverage = queryTerms.length === 0 ? 0 : matchedTerms.size / queryTerms.length;
    const graphBoost =
      (sharedKeywordNeighborCount * 0.75)
      + (sameDocumentNeighborCount * 0.5)
      + (!directMatch && (sharedKeywordNeighborCount > 0 || sameDocumentNeighborCount > 0) ? 0.35 : 0);
    const namespaceBoost = options.namespace != null && chunkRecord.chunk.namespace === options.namespace ? 1.1 : 1;
    const freshnessMultiplier = freshnessMultiplierFor(accessContext.freshness.action);
    const exactMatchScore =
      directMatch?.exactMatchScore
      ?? queryTerms.reduce((total, term) => total + countOccurrences(chunkRecord.chunk.content, term), 0);
    const baseScore = exactMatchScore + matchedTerms.size + keywordCoverage + graphBoost + (semanticSimilarity * 2);
    const finalScore = Number(
      ((baseScore * accessContext.trustPolicy.maxRetrievalWeight * freshnessMultiplier * namespaceBoost)).toFixed(4),
    );

    const reasoningPaths: string[] = [];
    if (matchedTerms.size > 0) {
      reasoningPaths.push(`keyword:${[...matchedTerms].sort().join(",")}`);
    }
    if (sharedKeywordNeighborCount > 0) {
      reasoningPaths.push(`shared_keyword:${sharedKeywordNeighborCount}`);
    }
    if (sameDocumentNeighborCount > 0) {
      reasoningPaths.push(`same_document:${sameDocumentNeighborCount}`);
    }
    if (semanticSimilarity >= SEMANTIC_MATCH_THRESHOLD) {
      reasoningPaths.push(`semantic:${semanticSimilarity.toFixed(3)}`);
    }
    if (accessContext.freshness.stale) {
      reasoningPaths.push(`freshness:${accessContext.freshness.action ?? "stale"}`);
    }
    if (accessContext.trustPolicy.maxRetrievalWeight < 1) {
      reasoningPaths.push(`trust:${accessContext.freshness.effectiveTrustLevel}`);
    }

    const hit: RetrievalHit = {
      chunkId: chunkRecord.chunk.chunkId,
      documentId: chunkRecord.record.document.documentId,
      score: finalScore,
      matchType: directMatch ? "keyword" : graphBoost > 0 ? "structural" : semanticSimilarity >= SEMANTIC_MATCH_THRESHOLD ? "semantic" : "semantic",
      snippet: chunkRecord.chunk.summary,
      namespace: chunkRecord.chunk.namespace,
      knowledgeRef,
      reasoningSummary:
        reasoningPaths.length > 0
          ? reasoningPaths.join(" | ")
          : "keyword_index",
      rankingSignals: {
        keywordMatches: [...matchedTerms].sort(),
        exactMatchScore,
        semanticSimilarity,
        keywordCoverage,
        sharedKeywordNeighborCount,
        sameDocumentNeighborCount,
        trustMultiplier: accessContext.trustPolicy.maxRetrievalWeight,
        freshnessMultiplier,
        namespaceBoost,
        graphBoost,
        reasoningPaths,
      },
    };
    return {
      ...hit,
      knowledgeRef: this.citations.build(hit),
    };
  }

  private collectSemanticCandidates(
    keyword: string,
    options: KnowledgeQueryOptions,
  ): Array<[string, number]> {
    // Sync path does not support pgvector backend - fall back to local archive iteration
    // when vector store is not available, to maintain sync fallback semantics
    const queryEmbedding = buildSemanticEmbedding(keyword);
    if (!queryEmbedding) {
      return [];
    }
    const candidates: Array<[string, number]> = [];
    for (const record of this.archive.list(options.namespace)) {
      for (const chunk of record.chunks) {
        const similarity = cosineSimilarity(chunk.embedding, queryEmbedding);
        if (similarity < SEMANTIC_MATCH_THRESHOLD) {
          continue;
        }
        const knowledgeRef = `knowledge:${chunk.chunkId}`;
        candidates.push([knowledgeRef, similarity]);
      }
    }
    return candidates
      .sort((left, right) => right[1] - left[1])
      .slice(0, SEMANTIC_CANDIDATE_LIMIT);
  }

  private async collectSemanticCandidatesAsync(
    keyword: string,
    options: KnowledgeQueryOptions,
  ): Promise<Array<[string, number]>> {
    if (!this.semanticVectorStore) {
      return this.collectSemanticCandidates(keyword, options);
    }
    const candidates = await this.semanticVectorStore.querySimilar({
      query: keyword,
      ...(options.namespace != null ? { namespace: options.namespace } : {}),
      limit: SEMANTIC_CANDIDATE_LIMIT,
      minSimilarity: SEMANTIC_MATCH_THRESHOLD,
    });
    return dedupeSemanticCandidates(candidates);
  }

  private getAccessContext(
    chunkRecord: ArchivedKnowledgeChunkRecord,
    options: KnowledgeQueryOptions,
    accessDecisions: Map<string, KnowledgeAccessDecision>,
  ): {
    freshness: ReturnType<FreshnessTracker["assess"]>;
    trustPolicy: ReturnType<SourceTrustPolicyRegistry["get"]>;
  } | null {
    if (options.namespace != null && chunkRecord.chunk.namespace !== options.namespace) {
      return null;
    }
    const namespace = this.namespacePolicies.get(chunkRecord.record.document.namespace);
    if (!namespace) {
      return null;
    }
    const cachedDecision = accessDecisions.get(namespace.path);
    const decision = cachedDecision ?? this.accessControl.checkAccess(namespace, {
      action: "read",
      principal: options.accessPrincipal ?? {
        principalId: options.domainId ?? "anonymous",
        domainId: options.domainId ?? null,
        roles: options.domainId === namespace.ownerDomainId ? ["reader"] : [],
      },
    });
    if (!cachedDecision) {
      accessDecisions.set(namespace.path, decision);
      this.auditLogger.logAccess(decision);
    }
    if (!decision.allowed) {
      return null;
    }
    const freshness = this.freshness.assess(chunkRecord.record.source, namespace);
    const trustPolicy = this.trustPolicies.get(freshness.effectiveTrustLevel);
    if (options.includeUnverified !== true && !trustPolicy.allowedInFinalResponse) {
      return null;
    }
    return { freshness, trustPolicy };
  }
}

function dedupeSemanticCandidates(candidates: readonly SemanticVectorCandidate[]): Array<[string, number]> {
  const best = new Map<string, number>();
  for (const candidate of candidates) {
    const current = best.get(candidate.knowledgeRef) ?? 0;
    if (candidate.similarity > current) {
      best.set(candidate.knowledgeRef, candidate.similarity);
    }
  }
  return [...best.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, SEMANTIC_CANDIDATE_LIMIT);
}
