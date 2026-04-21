export function buildCausalChainSummary(links) {
    return links.map((item) => `${item.source} -> ${item.target}: ${item.rationale}`);
}
//# sourceMappingURL=index.js.map