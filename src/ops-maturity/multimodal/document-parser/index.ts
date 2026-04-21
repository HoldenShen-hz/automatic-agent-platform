export function countDocumentPages(chunks: readonly string[]): number {
  return chunks.length;
}

export interface DocumentParseResult {
  readonly pageCount: number;
  readonly wordCount: number;
  readonly headings: readonly string[];
}

export function parseDocument(chunks: readonly string[]): DocumentParseResult {
  const headings = chunks
    .map((chunk) => chunk.split("\n")[0]?.trim() ?? "")
    .filter((line) => line.length > 0)
    .slice(0, 10);
  return {
    pageCount: countDocumentPages(chunks),
    wordCount: chunks.join(" ").split(/\s+/).filter((token) => token.length > 0).length,
    headings,
  };
}
