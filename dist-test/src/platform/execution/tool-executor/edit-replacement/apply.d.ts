/**
 * @fileoverview Edit Replacement Apply - Reindent and apply logic.
 *
 * Reindent logic to preserve original indentation when applying fuzzy matches.
 */
/**
 * Reindents a block of text to a target indentation level.
 */
export declare function reindentBlock(value: string, targetIndent: string): string;
/**
 * Reindents replacement text to match the indentation of the matched text.
 *
 * If the line count differs, falls back to using the matched text's indentation prefix.
 * Otherwise, matches each line's indentation to the corresponding matched line.
 */
export declare function reindentBlockToMatch(value: string, matchedText: string): string;
