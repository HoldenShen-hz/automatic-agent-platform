/**
 * Tool Output Sanitizer
 *
 * This module provides sanitization for tool output before it is returned to agents
 * or stored for audit purposes. It handles:
 * - ANSI escape sequence removal (color codes, cursor movement, etc.)
 * - Control character removal (null bytes, Bell, Backspace, etc.)
 * - Secret redaction (API keys, tokens, credentials)
 * - Injection attack detection (prompt injection, system prompt override attempts)
 * - Output truncation for large outputs
 * - Line ending normalization
 *
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/contracts/sandbox_contract.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/governance/glossary_and_terminology.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/architecture/00-platform-architecture.md}
 */

// R30-18 FIX: Expand ANSI regex to match all standard ANSI escape sequences, not just SGR.
// Root cause: Previous regex only matched SGR (Select Graphic Rendition) sequences, missing
// CSI cursor/erase sequences, OSC (Operating System Command) sequences, and other ANSI sequences.
// Attackers could use these other sequences for terminal injection attacks.
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /[\u001b\u009b][\x40-\x7e]|[\u001b\u009b\]\x8f\x91-\x97][\x20-\x7e]*(?:[\x07\x08\u001b\\]|\x9c|\x98|\x9d)?|[\u001bP-Z\$][^\x07]*(?:\x07|\u001b\\)?/g;
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const toolOutputSanitizerLogger = new StructuredLogger({ retentionLimit: 100 });

// Matches control characters in the C0 range (except newline and tab which are preserved)
// Includes: NUL, SOH, STX, ETX, EOT, ENQ, ACK, BEL, BS, VT, FF, CR, SO, SI, DLE, DC1, DC2, DC3, DC4, NAK, SYN, ETB, CAN, EM, SUB, ESC, FS, GS, RS, US
// eslint-disable-next-line no-control-regex
// R30-27 fix: Added ESC (\u001B) - bare ESC bytes could bypass sanitization
const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B-\u001B\u007F\u001C-\u001F]/g;

// Unicode Tags block characters (U+E0000 to U+E007F) used for invisible steganographic tagging
const UNICODE_TAGS_REGEX = /[\u{E0000}-\u{E007F}]/gu;

// Unicode private use area characters that could be used for steganography
const PRIVATE_USE_AREA_REGEX = /[\u{E000}-\u{F8FF}]/gu;

// Zero-width characters used for invisible steganography
const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u2028\u2029\uFEFF]/g;

/**
 * Patterns for detecting secrets in output that should be redacted.
 * Each pattern matches a specific type of credential or API key.
 */
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{12,}/g,           // OpenAI API keys
  /sk-ant-[A-Za-z0-9_-]{12,}/g,       // Anthropic API keys
  /sk_(?:live|test)_[A-Za-z0-9]{16,}/g, // Stripe secret keys
  /AIza[0-9A-Za-z\-_]{20,}/g,         // Google API keys
  /gh[pousr]_[A-Za-z0-9]{20,}/g,      // GitHub classic and scoped tokens
  /github_pat_[A-Za-z0-9_]{20,}/g,    // GitHub fine-grained PATs
  /AKIA[0-9A-Z]{16}/g,                // AWS access key ids
  /\b(?:postgres(?:ql)?|mysql|redis):\/\/[^/\s:@]+:[^/\s@]+@/gi, // DSN credentials
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, // Bearer tokens in Authorization headers
];

export type PromptInjectionRuleId =
  | "instruction_override"
  | "system_prompt_exfiltration"
  | "developer_message_exfiltration"
  | "credential_exfiltration"
  | "remote_shell_pivot";

interface PromptInjectionRule {
  ruleId: PromptInjectionRuleId;
  severity: "medium" | "high";
  pattern: RegExp;
}

/**
 * Patterns for detecting potential prompt injection attacks.
 * These attempt to override system instructions or extract secrets.
 */
const INJECTION_RULES: readonly PromptInjectionRule[] = [
  {
    ruleId: "instruction_override",
    severity: "high",
    pattern: /(?:ignore|disregard)\s+(?:all\s+)?(?:previous|earlier|prior)\s+instructions/i,
  },
  {
    ruleId: "system_prompt_exfiltration",
    severity: "high",
    pattern: /(?:ignore\s+system\s+prompt|(?:print|reveal|dump).{0,40}system\s+prompt)/i,
  },
  {
    ruleId: "developer_message_exfiltration",
    severity: "high",
    pattern: /(?:developer\s+message|hidden\s+instructions?)/i,
  },
  {
    ruleId: "credential_exfiltration",
    severity: "high",
    pattern: /(?:reveal|show|output|dump|exfiltrat[e]?|print).{0,40}(?:secret|token|credential|api\s*key)/i,
  },
  {
    ruleId: "remote_shell_pivot",
    severity: "high",
    pattern: /curl\s+.+\|\s*(?:bash|sh)/i,
  },
] as const;

/**
 * Classification levels for injection risk detected in tool output.
 */
export type InjectionRisk = "none" | "low" | "medium" | "high";

/**
 * Sanitized output result containing cleaned text and diagnostic metadata.
 */
export interface SanitizedToolOutput {
  /** Reference to raw output storage if persisted; null if not persisted */
  rawRef: string | null;

  /** Sanitized text with secrets redacted and control characters removed */
  sanitizedText: string;

  /** Whether the output was truncated due to size limits */
  truncated: boolean;

  /** Number of secret instances redacted from the output */
  redactionCount: number;

  /** Number of control characters removed from the output */
  controlCharsRemoved: number;

  /** Whether any ANSI escape sequences were present and removed */
  ansiRemoved: boolean;

  /** Whether NFC normalization was applied */
  nfcNormalized: boolean;

  /** Number of Unicode Tags block characters removed */
  unicodeTagsRemoved: number;

  /** Number of zero-width characters removed */
  zeroWidthCharsRemoved: number;

  /** Number of private use area characters removed */
  privateUseCharsRemoved: number;

  /** Assessed risk level for prompt injection attacks */
  injectionRisk: InjectionRisk;

  /** Matched rule ids used to assess prompt injection risk */
  matchedInjectionRules: PromptInjectionRuleId[];

  /** List of warning codes for any transformations applied */
  warnings: string[];
}

/**
 * Configuration options for output sanitization.
 */
export interface SanitizeOutputOptions {
  /** Reference identifier for raw output storage (optional) */
  rawRef?: string;

  /** Maximum characters to retain in persisted message; defaults to 4000 */
  persistedMessageLimitChars?: number;
}

export interface SanitizedStructuredOutput<T> {
  sanitizedValue: T;
  redactionCount: number;
  controlCharsRemoved: number;
  ansiRemoved: boolean;
  nfcNormalized: boolean;
  unicodeTagsRemoved: number;
  zeroWidthCharsRemoved: number;
  privateUseCharsRemoved: number;
  injectionRisk: InjectionRisk;
  matchedInjectionRules: PromptInjectionRuleId[];
  warnings: string[];
}

/**
 * Sanitizes tool output by removing sensitive content, control characters,
 * and ANSI sequences while detecting injection attacks.
 *
 * Processing steps (in order):
 * 1. Remove ANSI escape sequences (color codes, cursor movement, etc.)
 * 2. Remove control characters (except newlines and tabs)
 * 3. Redact secrets matching known patterns (API keys, tokens)
 * 4. Normalize line endings (CRLF -> LF) and trim trailing whitespace
 * 5. Truncate if exceeding persistedMessageLimitChars (60% head, 30% tail)
 * 6. Assess injection risk based on suspicious patterns
 * 7. Generate warnings for any transformations applied
 *
 * @param rawOutput - The raw output string from tool execution
 * @param options - Sanitization configuration options
 * @returns SanitizedToolOutput with cleaned text and diagnostic metadata
 */
export function sanitizeToolOutput(
  rawOutput: string,
  options: SanitizeOutputOptions = {},
): SanitizedToolOutput {
  const result = sanitizeTextValue(
    rawOutput,
    options.persistedMessageLimitChars == null
      ? { redactSecrets: true }
      : {
        redactSecrets: true,
        persistedMessageLimitChars: options.persistedMessageLimitChars,
      },
  );

  return {
    rawRef: options.rawRef ?? null,
    sanitizedText: result.sanitizedText,
    truncated: result.truncated,
    redactionCount: result.redactionCount,
    controlCharsRemoved: result.controlCharsRemoved,
    ansiRemoved: result.ansiRemoved,
    nfcNormalized: result.nfcNormalized,
    unicodeTagsRemoved: result.unicodeTagsRemoved,
    zeroWidthCharsRemoved: result.zeroWidthCharsRemoved,
    privateUseCharsRemoved: result.privateUseCharsRemoved,
    injectionRisk: result.injectionRisk,
    matchedInjectionRules: result.matchedInjectionRules,
    warnings: result.warnings,
  };
}

export function sanitizeStructuredOutput<T>(rawValue: T): SanitizedStructuredOutput<T> {
  const warningSet = new Set<string>();
  const matchedRuleSet = new Set<PromptInjectionRuleId>();
  let redactionCount = 0;
  let controlCharsRemoved = 0;
  let ansiRemoved = false;
  let nfcNormalized = false;
  let unicodeTagsRemoved = 0;
  let zeroWidthCharsRemoved = 0;
  let privateUseCharsRemoved = 0;
  let highestInjectionRisk: InjectionRisk = "none";

  const sanitizedValue = sanitizeStructuredNode(rawValue, []) as T;

  return {
    sanitizedValue,
    redactionCount,
    controlCharsRemoved,
    ansiRemoved,
    nfcNormalized,
    unicodeTagsRemoved,
    zeroWidthCharsRemoved,
    privateUseCharsRemoved,
    injectionRisk: highestInjectionRisk,
    matchedInjectionRules: [...matchedRuleSet],
    warnings: [...warningSet],
  };

  function sanitizeStructuredNode(value: unknown, path: string[]): unknown {
    if (typeof value === "string") {
      const result = sanitizeTextValue(value, {
        redactSecrets: !shouldPreserveStructuredString(path),
        persistedMessageLimitChars: Math.max(4_000, value.length + 1),
      });
      recordResult(result);
      return result.sanitizedText;
    }

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeStructuredNode(item, path));
    }

    if (value != null && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        sanitizeStructuredNode(entryValue, [...path, key]),
      ]);
      return Object.fromEntries(entries);
    }

    return value;
  }

  function recordResult(result: SanitizedTextValue): void {
    redactionCount += result.redactionCount;
    controlCharsRemoved += result.controlCharsRemoved;
    ansiRemoved = ansiRemoved || result.ansiRemoved;
    nfcNormalized = nfcNormalized || result.nfcNormalized;
    unicodeTagsRemoved += result.unicodeTagsRemoved;
    zeroWidthCharsRemoved += result.zeroWidthCharsRemoved;
    privateUseCharsRemoved += result.privateUseCharsRemoved;
    highestInjectionRisk = higherInjectionRisk(highestInjectionRisk, result.injectionRisk);
    for (const ruleId of result.matchedInjectionRules) {
      matchedRuleSet.add(ruleId);
    }
    for (const warning of result.warnings) {
      warningSet.add(warning);
    }
  }
}

interface SanitizedTextValue {
  sanitizedText: string;
  truncated: boolean;
  redactionCount: number;
  controlCharsRemoved: number;
  ansiRemoved: boolean;
  nfcNormalized: boolean;
  unicodeTagsRemoved: number;
  zeroWidthCharsRemoved: number;
  privateUseCharsRemoved: number;
  injectionRisk: InjectionRisk;
  matchedInjectionRules: PromptInjectionRuleId[];
  warnings: string[];
}

interface SanitizeTextValueOptions {
  redactSecrets: boolean;
  persistedMessageLimitChars?: number;
}

function sanitizeTextValue(
  rawOutput: string,
  options: SanitizeTextValueOptions,
): SanitizedTextValue {
  const warnings: string[] = [];
  const persistedMessageLimitChars = options.persistedMessageLimitChars ?? 4000;

  const withoutAnsi = rawOutput.replace(ANSI_REGEX, "");
  const ansiRemoved = withoutAnsi !== rawOutput;

  const controlCharsRemoved = (withoutAnsi.match(CONTROL_CHARS_REGEX) ?? []).length;
  let sanitized = withoutAnsi.replace(CONTROL_CHARS_REGEX, "");

  // NFC (Normalization Form Composed) normalization to standardize Unicode representation
  // This prevents steganography using different Unicode encodings of the same character
  let nfcNormalized = false;
  try {
    const normalized = sanitized.normalize("NFC");
    if (normalized !== sanitized) {
      nfcNormalized = true;
      sanitized = normalized;
    }
  } catch (err) {
    toolOutputSanitizerLogger.debug("tool_output_sanitizer: NFC normalization failed", { error: err instanceof Error ? err.message : String(err) });
    // Ignore normalization errors
  }

  // Remove Unicode Tags block characters (U+E0000 - U+E007F) used for invisible tagging
  const unicodeTagsRemoved = (sanitized.match(UNICODE_TAGS_REGEX) ?? []).length;
  sanitized = sanitized.replace(UNICODE_TAGS_REGEX, "");

  // Remove zero-width characters used for invisible steganography
  const zeroWidthCharsRemoved = (sanitized.match(ZERO_WIDTH_REGEX) ?? []).length;
  sanitized = sanitized.replace(ZERO_WIDTH_REGEX, "");

  // Remove private use area characters that could be used for custom invisible symbols
  const privateUseCharsRemoved = (sanitized.match(PRIVATE_USE_AREA_REGEX) ?? []).length;
  sanitized = sanitized.replace(PRIVATE_USE_AREA_REGEX, "");

  let redactionCount = 0;
  if (options.redactSecrets) {
    for (const pattern of SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern, () => {
        redactionCount += 1;
        return "[REDACTED]";
      });
    }
  }

  sanitized = sanitized.replace(/\r\n/g, "\n").trimEnd();

  let truncated = false;
  if (sanitized.length > persistedMessageLimitChars) {
    truncated = true;
    const head = sanitized.slice(0, Math.floor(persistedMessageLimitChars * 0.6));
    const tail = sanitized.slice(-Math.floor(persistedMessageLimitChars * 0.3));
    sanitized = `${head}\n...[TRUNCATED]...\n${tail}`;
    warnings.push("output_truncated");
  }

  const matchedInjectionRules = INJECTION_RULES.filter((rule) => rule.pattern.test(sanitized));
  const riskMatches = matchedInjectionRules.length;
  let injectionRisk: InjectionRisk = "none";

  if (matchedInjectionRules.some((rule) => rule.severity === "high") || riskMatches >= 2) {
    injectionRisk = "high";
  } else if (riskMatches === 1) {
    injectionRisk = "medium";
  } else if (/system\s+prompt|instruction|credential|secret/i.test(sanitized)) {
    injectionRisk = "low";
  }

  if (ansiRemoved) {
    warnings.push("ansi_removed");
  }
  if (controlCharsRemoved > 0) {
    warnings.push("control_chars_removed");
  }
  if (redactionCount > 0) {
    warnings.push("secret_redacted");
  }
  if (nfcNormalized) {
    warnings.push("unicode_nfc_normalized");
  }
  if (unicodeTagsRemoved > 0) {
    warnings.push("unicode_tags_removed");
  }
  if (zeroWidthCharsRemoved > 0) {
    warnings.push("unicode_zero_width_removed");
  }
  if (privateUseCharsRemoved > 0) {
    warnings.push("unicode_private_use_removed");
  }
  if (injectionRisk === "high") {
    warnings.push("high_injection_risk");
  } else if (injectionRisk === "medium") {
    warnings.push("medium_injection_risk");
  } else if (injectionRisk === "low") {
    warnings.push("low_injection_risk");
  }

  return {
    sanitizedText: sanitized,
    truncated,
    redactionCount,
    controlCharsRemoved,
    ansiRemoved,
    nfcNormalized,
    unicodeTagsRemoved,
    zeroWidthCharsRemoved,
    privateUseCharsRemoved,
    injectionRisk,
    matchedInjectionRules: matchedInjectionRules.map((rule) => rule.ruleId),
    warnings,
  };
}

function shouldPreserveStructuredString(path: readonly string[]): boolean {
  const key = findLastStructuredKey(path);
  if (key == null) {
    return false;
  }

  return (
    key === "id" ||
    key.endsWith("Id") ||
    key.endsWith("Ids") ||
    key.endsWith("At") ||
    key === "uri" ||
    key.endsWith("Uri") ||
    key.endsWith("Path") ||
    key === "checksum"
  );
}

function findLastStructuredKey(path: readonly string[]): string | null {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const segment = path[index];
    if (segment != null && !/^\d+$/.test(segment)) {
      return segment;
    }
  }
  return null;
}

function higherInjectionRisk(current: InjectionRisk, candidate: InjectionRisk): InjectionRisk {
  const order: InjectionRisk[] = ["none", "low", "medium", "high"];
  return order.indexOf(candidate) > order.indexOf(current) ? candidate : current;
}
