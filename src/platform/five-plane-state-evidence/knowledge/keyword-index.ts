import type { KnowledgeChunk, RetrievalHit } from "./knowledge-model.js";

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

export class KeywordKnowledgeIndex {
  private readonly chunks = new Map<string, KnowledgeChunk>();
  private readonly inverted = new Map<string, Set<string>>();

  public upsert(chunk: KnowledgeChunk): void {
    this.chunks.set(chunk.chunkId, chunk);
    for (const keyword of chunk.keywords) {
      const key = keyword.toLowerCase();
      const existing = this.inverted.get(key) ?? new Set<string>();
      existing.add(chunk.chunkId);
      this.inverted.set(key, existing);
    }
  }

  public query(keyword: string): RetrievalHit[] {
    const ids = this.inverted.get(keyword.toLowerCase()) ?? new Set<string>();
    return [...ids]
      .map((id) => this.chunks.get(id))
      .filter((chunk): chunk is KnowledgeChunk => chunk != null)
      .map((chunk) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        score: countOccurrences(chunk.content, keyword),
        matchType: "keyword" as const,
        snippet: chunk.summary,
        knowledgeRef: `knowledge:${chunk.chunkId}`,
        namespace: chunk.namespace,
      }))
      .sort((left, right) => right.score - left.score);
  }

  public reset(): void {
    this.chunks.clear();
    this.inverted.clear();
  }
}
