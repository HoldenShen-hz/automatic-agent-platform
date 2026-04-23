export declare function countDocumentPages(chunks: readonly string[]): number;
export interface DocumentParseResult {
    readonly pageCount: number;
    readonly wordCount: number;
    readonly headings: readonly string[];
}
export declare function parseDocument(chunks: readonly string[]): DocumentParseResult;
