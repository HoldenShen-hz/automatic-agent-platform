import { basename } from "node:path";
import ts from "typescript";
function toKind(node) {
    if (ts.isFunctionDeclaration(node)) {
        return "function";
    }
    if (ts.isClassDeclaration(node)) {
        return "class";
    }
    if (ts.isInterfaceDeclaration(node)) {
        return "interface";
    }
    if (ts.isTypeAliasDeclaration(node)) {
        return "type";
    }
    if (ts.isEnumDeclaration(node)) {
        return "enum";
    }
    if (ts.isVariableDeclaration(node)) {
        return "variable";
    }
    return null;
}
function extractIdentifier(node) {
    if (ts.isFunctionDeclaration(node)
        || ts.isClassDeclaration(node)
        || ts.isInterfaceDeclaration(node)
        || ts.isTypeAliasDeclaration(node)
        || ts.isEnumDeclaration(node)) {
        return node.name?.getText() ?? null;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        return node.name.text;
    }
    return null;
}
function buildSnippet(sourceText, startLine) {
    const lines = sourceText.split("\n");
    return lines.slice(startLine, startLine + 3).join("\n").trim();
}
export class AstStructuralIndex {
    symbolsById = new Map();
    symbolsByNamespace = new Map();
    upsertDocument(input) {
        if (!this.shouldParse(input.sourceUri, input.language)) {
            return [];
        }
        this.removeDocument(input.documentId);
        const sourceFile = ts.createSourceFile(basename(input.sourceUri), input.content, ts.ScriptTarget.Latest, true, this.inferScriptKind(input.sourceUri, input.language));
        const discovered = [];
        const visit = (node) => {
            const kind = toKind(node);
            const symbolName = extractIdentifier(node);
            if (kind && symbolName) {
                const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
                const symbolId = `${input.documentId}:${symbolName}:${position.line + 1}:${kind}`;
                discovered.push({
                    symbolId,
                    symbolName,
                    symbolKind: kind,
                    sourceUri: input.sourceUri,
                    namespace: input.namespace,
                    documentId: input.documentId,
                    line: position.line + 1,
                    character: position.character + 1,
                    snippet: buildSnippet(input.content, position.line),
                });
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        const namespaceSymbols = this.symbolsByNamespace.get(input.namespace) ?? new Set();
        for (const symbol of discovered) {
            this.symbolsById.set(symbol.symbolId, symbol);
            namespaceSymbols.add(symbol.symbolId);
        }
        this.symbolsByNamespace.set(input.namespace, namespaceSymbols);
        return discovered;
    }
    query(input) {
        const normalizedQuery = input.query.trim().toLowerCase();
        if (normalizedQuery.length === 0) {
            return [];
        }
        const limit = Math.max(1, input.limit ?? 10);
        const candidateIds = input.namespace
            ? [...(this.symbolsByNamespace.get(input.namespace) ?? new Set())]
            : [...this.symbolsById.keys()];
        return candidateIds
            .map((symbolId) => this.symbolsById.get(symbolId))
            .filter((symbol) => symbol != null)
            .map((symbol) => ({
            symbol,
            score: this.computeScore(symbol, normalizedQuery),
        }))
            .filter((item) => item.score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, limit)
            .map((item) => item.symbol);
    }
    list(namespace) {
        if (!namespace) {
            return [...this.symbolsById.values()];
        }
        return [...(this.symbolsByNamespace.get(namespace) ?? new Set())]
            .map((symbolId) => this.symbolsById.get(symbolId))
            .filter((symbol) => symbol != null);
    }
    removeDocument(documentId) {
        for (const [symbolId, symbol] of this.symbolsById.entries()) {
            if (symbol.documentId !== documentId) {
                continue;
            }
            this.symbolsById.delete(symbolId);
            const namespaceSymbols = this.symbolsByNamespace.get(symbol.namespace);
            namespaceSymbols?.delete(symbolId);
        }
    }
    computeScore(symbol, query) {
        const symbolName = symbol.symbolName.toLowerCase();
        if (symbolName === query) {
            return 3;
        }
        if (symbolName.includes(query)) {
            return 2;
        }
        if (symbol.snippet.toLowerCase().includes(query)) {
            return 1;
        }
        return 0;
    }
    shouldParse(sourceUri, language) {
        const normalizedLanguage = language?.toLowerCase() ?? "";
        if (normalizedLanguage === "typescript" || normalizedLanguage === "javascript") {
            return true;
        }
        return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(sourceUri);
    }
    inferScriptKind(sourceUri, language) {
        const normalizedLanguage = language?.toLowerCase() ?? "";
        if (normalizedLanguage === "javascript") {
            return ts.ScriptKind.JS;
        }
        if (normalizedLanguage === "typescript") {
            return ts.ScriptKind.TS;
        }
        if (sourceUri.endsWith(".tsx")) {
            return ts.ScriptKind.TSX;
        }
        if (sourceUri.endsWith(".jsx")) {
            return ts.ScriptKind.JSX;
        }
        if (sourceUri.endsWith(".js") || sourceUri.endsWith(".mjs") || sourceUri.endsWith(".cjs")) {
            return ts.ScriptKind.JS;
        }
        return ts.ScriptKind.TS;
    }
}
//# sourceMappingURL=ast-index.js.map