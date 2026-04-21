export interface AstIndexedSymbol {
    symbolId: string;
    symbolName: string;
    symbolKind: "function" | "class" | "interface" | "type" | "enum" | "variable";
    sourceUri: string;
    namespace: string;
    documentId: string;
    line: number;
    character: number;
    snippet: string;
}
export interface AstIndexQuery {
    query: string;
    namespace?: string;
    limit?: number;
}
export declare class AstStructuralIndex {
    private readonly symbolsById;
    private readonly symbolsByNamespace;
    upsertDocument(input: {
        documentId: string;
        sourceUri: string;
        namespace: string;
        content: string;
        language?: string | null;
    }): AstIndexedSymbol[];
    query(input: AstIndexQuery): AstIndexedSymbol[];
    list(namespace?: string): AstIndexedSymbol[];
    private removeDocument;
    private computeScore;
    private shouldParse;
    private inferScriptKind;
}
