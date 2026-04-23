export function countDocumentPages(chunks) {
    return chunks.length;
}
export function parseDocument(chunks) {
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
//# sourceMappingURL=index.js.map