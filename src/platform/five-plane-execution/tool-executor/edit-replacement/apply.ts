/**
 * @fileoverview Edit Replacement Apply - Reindent and apply logic.
 *
 * Reindent logic to preserve original indentation when applying fuzzy matches.
 */

import { stripCommonIndent, detectCommonIndent, trimTerminalEmptyLine } from "./string-utils.js";

/**
 * Reindents a block of text to a target indentation level.
 */
export function reindentBlock(value: string, targetIndent: string): string {
  const stripped = stripCommonIndent(value);
  return stripped
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => (line.length === 0 ? "" : `${targetIndent}${line}`))
    .join("\n");
}

/**
 * Reindents replacement text to match the indentation of the matched text.
 *
 * If the line count differs, falls back to using the matched text's indentation prefix.
 * Otherwise, matches each line's indentation to the corresponding matched line.
 */
export function reindentBlockToMatch(value: string, matchedText: string): string {
  const matchedTextNormalized = matchedText.replace(/\r\n/g, "\n");
  const normalizedLines = trimTerminalEmptyLine(stripCommonIndent(value.replace(/\r\n/g, "\n")).split("\n"));
  const matchedLines = trimTerminalEmptyLine(matchedTextNormalized.split("\n"));

  // Fall back to matched text's indentation if line counts differ
  if (normalizedLines.length !== matchedLines.length) {
    return reindentBlock(value, detectCommonIndent(matchedText));
  }

  // Match each line's indentation to the corresponding matched line
  return normalizedLines
    .map((line, index) => {
      if (line.length === 0) {
        return "";
      }

      const indent = matchedLines[index]?.match(/^[ \t]*/)?.[0] ?? "";
      return `${indent}${line.trimStart()}`;
    })
    .join("\n");
}
