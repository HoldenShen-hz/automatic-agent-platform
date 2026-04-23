/**
 * @fileoverview Edit Replacement String Utilities
 *
 * String normalization utilities for edit replacement matching.
 * These functions handle whitespace normalization, indentation detection,
 * and text preprocessing for the multi-stage matching algorithm.
 */
/**
 * Normalizes whitespace: collapses spaces/tabs, trims each line, trims overall.
 * Used for whitespace-normalized matching.
 */
export declare function normalizeWhitespace(value: string): string;
/**
 * Normalizes text for indentation-aware matching.
 * First strips common indentation, then applies whitespace normalization.
 */
export declare function normalizeIndentationAware(value: string): string;
/**
 * Strips common leading indentation from all lines.
 * Preserves empty lines and lines with only whitespace.
 */
export declare function stripCommonIndent(value: string): string;
/**
 * Detects the common leading whitespace prefix among all non-empty lines.
 * Returns the shared prefix (spaces and tabs only).
 */
export declare function detectCommonIndent(value: string): string;
/**
 * Removes trailing empty line from array of lines if present.
 */
export declare function trimTerminalEmptyLine(lines: string[]): string[];
/**
 * Ensures the replacement has the same trailing newline behavior as the matched text.
 */
export declare function preserveTrailingNewline(replacement: string, matchedText: string): string;
