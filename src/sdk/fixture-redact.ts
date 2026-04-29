/**
 * @fileoverview Fixture Redaction Utility
 *
 * Implements §22.3 requirement: fixture auto-redact secrets/hash PII
 * Ensures test fixtures do not contain actual secrets or PII.
 */

const SECRET_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /(?i)(api[_-]?key|apikey|api[_-]?secret|access[_-]?token|auth[_-]?token|bearer[_-]?token|refresh[_-]?token|client[_-]?secret)/, name: "api_key" },
  { pattern: /(?i)(password|passwd|pwd|secret|passphrase)/, name: "password" },
  { pattern: /(?i)(private[_-]?key|secret[_-]?key|encryption[_-]?key)/, name: "private_key" },
  { pattern: /(?i)(database[_-]?credential|db[_-]?credential|connection[_-]?string)/, name: "db_credential" },
  { pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, name: "jwt_token" },
  { pattern: /(?i)(AKIA[0-9A-Z]{16})/, name: "aws_access_key" },
  { pattern: /[A-Za-z0-9/+=]{40,}/, name: "high_entropy_secret" },
];

const PII_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, name: "email" },
  { pattern: /(?i)(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/, name: "phone" },
  { pattern: /\d{3}[-.\s]?\d{2}[-.\s]?\d{4}/, name: "ssn" },
  { pattern: /\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}/, name: "credit_card" },
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, name: "ip_address" },
];

export interface RedactionOptions {
  replaceWith?: string;
  hashRedacted?: boolean;
  customSecretPatterns?: Array<{ pattern: RegExp; name: string }>;
  customPiiPatterns?: Array<{ pattern: RegExp; name: string }>;
  alwaysRedactFields?: Set<string>;
}

const DEFAULT_OPTIONS: Required<RedactionOptions> = {
  replaceWith: "[REDACTED]",
  hashRedacted: true,
  customSecretPatterns: [],
  customPiiPatterns: [],
  alwaysRedactFields: new Set(["password", "passwordHash", "secret", "apiKey", "token", "credential", "privateKey"]),
};

export interface RedactionResult {
  value: unknown;
  redactedFields: Map<string, string>;
  correlationHashes: Map<string, string>;
}

export class FixtureRedactor {
  private readonly options: Required<RedactionOptions>;
  private readonly secretPatterns: Array<{ pattern: RegExp; name: string }>;
  private readonly piiPatterns: Array<{ pattern: RegExp; name: string }>;

  constructor(options: RedactionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options, alwaysRedactFields: new Set(options.alwaysRedactFields ?? DEFAULT_OPTIONS.alwaysRedactFields) };
    this.secretPatterns = [...SECRET_PATTERNS, ...this.options.customSecretPatterns];
    this.piiPatterns = [...PII_PATTERNS, ...this.options.customPiiPatterns];
  }

  redact(fixture: unknown, fieldPrefix = ""): RedactionResult {
    const redactedFields = new Map<string, string>();
    const correlationHashes = new Map<string, string>();
    const redacted = this.redactValue(fixture, fieldPrefix, redactedFields, correlationHashes);
    return { value: redacted, redactedFields, correlationHashes };
  }

  private shouldAlwaysRedact(fieldName: string): boolean {
    const lower = fieldName.toLowerCase();
    return this.options.alwaysRedactFields.has(lower);
  }

  private looksLikeSecret(value: string): { match: boolean; name: string } {
    for (const item of this.secretPatterns) {
      if (item.pattern.test(value)) {
        return { match: true, name: item.name };
      }
    }
    return { match: false, name: "" };
  }

  private looksLikePii(value: string): { match: boolean; name: string } {
    for (const item of this.piiPatterns) {
      if (item.pattern.test(value)) {
        return { match: true, name: item.name };
      }
    }
    return { match: false, name: "" };
  }

  private computeCorrelationHash(value: string): string {
    let hash = 0;
    const str = value.toLowerCase();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return "corr_" + Math.abs(hash).toString(16).padStart(8, "0");
  }

  private redactValue(value: unknown, fieldPrefix: string, redactedFields: Map<string, string>, correlationHashes: Map<string, string>): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === "string") {
      return this.redactString(value, fieldPrefix, redactedFields, correlationHashes);
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      for (let i = 0; i < value.length; i++) {
        result.push(this.redactValue(value[i], fieldPrefix + "[" + i + "]", redactedFields, correlationHashes));
      }
      return result;
    }
    if (typeof value === "object") {
      const result: Record<string, unknown> = {};
      const entries = Object.entries(value as Record<string, unknown>);
      for (let i = 0; i < entries.length; i++) {
        const key = entries[i][0];
        const val = entries[i][1];
        const path = fieldPrefix ? fieldPrefix + "." + key : key;
        if (this.shouldAlwaysRedact(key)) {
          const replacement = this.options.replaceWith;
          result[key] = replacement;
          redactedFields.set(path, replacement);
          if (this.options.hashRedacted && typeof val === "string") {
            correlationHashes.set(path, this.computeCorrelationHash(val));
          }
        } else {
          result[key] = this.redactValue(val, path, redactedFields, correlationHashes);
        }
      }
      return result;
    }
    return value;
  }

  private redactString(value: string, fieldPrefix: string, redactedFields: Map<string, string>, correlationHashes: Map<string, string>): string {
    const secretMatch = this.looksLikeSecret(value);
    if (secretMatch.match) {
      const replacement = this.options.replaceWith;
      redactedFields.set(fieldPrefix, secretMatch.name + ":" + replacement);
      if (this.options.hashRedacted) {
        correlationHashes.set(fieldPrefix, this.computeCorrelationHash(value));
      }
      return replacement;
    }
    const piiMatch = this.looksLikePii(value);
    if (piiMatch.match) {
      const replacement = this.options.replaceWith;
      redactedFields.set(fieldPrefix, piiMatch.name + ":" + replacement);
      if (this.options.hashRedacted) {
        correlationHashes.set(fieldPrefix, this.computeCorrelationHash(value));
      }
      return replacement;
    }
    return value;
  }

  static createStandard(): FixtureRedactor {
    return new FixtureRedactor({ hashRedacted: true, replaceWith: "[REDACTED]" });
  }

  static createNoHash(): FixtureRedactor {
    return new FixtureRedactor({ hashRedacted: false, replaceWith: "[REDACTED]" });
  }
}

export function generateTestId(prefix = "test"): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 10);
}
