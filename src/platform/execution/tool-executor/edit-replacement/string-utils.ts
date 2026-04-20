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
export function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .trim();
}

/**
 * Normalizes text for indentation-aware matching.
 * First strips common indentation, then applies whitespace normalization.
 */
export function normalizeIndentationAware(value: string): string {
  return normalizeWhitespace(stripCommonIndent(value));
}

/**
 * Strips common leading indentation from all lines.
 * Preserves empty lines and lines with only whitespace.
 */
export function stripCommonIndent(value: string): string {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length === 0) {
    return value;
  }

  // Detect common indentation among non-empty lines
  const commonIndent = detectCommonIndent(nonEmptyLines.join("\n"));
  if (commonIndent.length === 0) {
    return lines.join("\n");
  }

  // Remove common indent from each line, or trimStart if line doesn't have it
  return lines
    .map((line) => {
      if (line.trim().length === 0) {
        return "";
      }
      return line.startsWith(commonIndent) ? line.slice(commonIndent.length) : line.trimStart();
    })
    .join("\n");
}

/**
 * Detects the common leading whitespace prefix among all non-empty lines.
 * Returns the shared prefix (spaces and tabs only).
 */
export function detectCommonIndent(value: string): string {
  const lines = value.replace(/\r\n/g, "\n").split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return "";
  }

  // Start with the indent of the first non-empty line
  let prefix = lines[0]?.match(/^[ \t]*/)?.[0] ?? "";

  // Compare with subsequent lines, shortening prefix as needed
  for (const line of lines.slice(1)) {
    const indent = line.match(/^[ \t]*/)?.[0] ?? "";
    let matchLength = 0;
    const maxLength = Math.min(prefix.length, indent.length);

    // Count characters that match between prefix and indent
    while (matchLength < maxLength && prefix[matchLength] === indent[matchLength]) {
      matchLength += 1;
    }
    prefix = prefix.slice(0, matchLength);
    if (prefix.length === 0) {
      break;
    }
  }
  return prefix;
}

/**
 * Removes trailing empty line from array of lines if present.
 */
export function trimTerminalEmptyLine(lines: string[]): string[] {
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    return lines.slice(0, -1);
  }
  return lines;
}

/**
 * Ensures the replacement has the same trailing newline behavior as the matched text.
 */
export function preserveTrailingNewline(replacement: string, matchedText: string): string {
  if (matchedText.endsWith("\n") && !replacement.endsWith("\n")) {
    return `${replacement}\n`;
  }
  return replacement;
}
