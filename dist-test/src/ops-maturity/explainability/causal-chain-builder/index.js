export function buildCausalChainSummary(links) {
    return links.map((item) => `${item.source} -> ${item.target}: ${item.rationale}`);
}
export function buildCausalChain(nodes, links) {
    return Object.freeze({
        nodes: Object.freeze([...nodes]),
        links: Object.freeze([...links]),
        summary: Object.freeze(buildCausalChainSummary(links)),
    });
}
//# sourceMappingURL=index.js.map