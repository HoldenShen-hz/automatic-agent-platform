/**
 * @fileoverview Data Classification and Prompt Handling Service
 *
 * Provides:
 * - Data classification levels: public, internal, confidential, restricted
 * - PII auto-detection and annotation
 * - Runtime filtering based on classification rules
 * - Audit trail for classification decisions
 *
 * @see docs_zh/contracts/data_classification_and_prompt_handling_contract.md
 */

import { ValidationError } from "../../contracts/errors.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

// ── Types ──────────────────────────────────────────────────────────────

/**
 * Classification level hierarchy (least to most restrictive):
 * - public: No restrictions
 * - internal: Internal use only, limited distribution
 * - confidential: Sensitive business data, needs protection
 * - restricted: Highly sensitive, minimal access required
 */
export type DataClassificationLevel = "public" | "internal" | "confidential" | "restricted";

/**
 * Dimensions along which data handling decisions are made.
 * Each dimension represents a different context where data might flow.
 */
export type DataHandlingDimension = "prompt" | "logs" | "memory" | "artifact" | "cross_worker" | "debug";

/**
 * Types of Personally Identifiable Information that can be detected.
 * Used for PII detection and appropriate redaction.
 */
export type PiiType = "email" | "phone" | "ssn" | "credit_card" | "ip_address" | "name" | "address" | "dob" | "none";

/**
 * Result of classifying a piece of content.
 * Contains the determined level, detected PII, and confidence metrics.
 */
export interface ClassificationResult {
  /** The assigned classification level */
  level: DataClassificationLevel;

  /** Types of PII detected in the content */
  piiTypes: PiiType[];

  /** Whether any PII was detected */
  piiDetected: boolean;

  /** Confidence score (0-1) in the classification decision */
  confidence: number;

  /** Human-readable explanation of how classification was determined */
  reasoning: string;

  /** Whether this classification requires an audit trail entry */
  requiresAudit: boolean;

  /** Whether classification was automatically applied (vs rule-based) */
  autoAnnotated: boolean;
}

/**
 * Decision on how data should be handled based on its classification.
 * Determines whether to allow, deny, redact, or summarize the data.
 */
export interface HandlingDecision {
  /** Whether the handling action permits the operation */
  allowed: boolean;

  /** The action to take: allow, deny, redact, summarize, or audit */
  action: "allow" | "deny" | "redact" | "summarize" | "audit";

  /** Classification level that triggered this decision */
  level: DataClassificationLevel;

  /** The handling dimension this decision applies to */
  dimension: DataHandlingDimension;

  /** Human-readable reason for this decision */
  reason: string;

  /** Audit trail ID if this decision was audited */
  auditTrailId: string | null;
}

/**
 * Annotation identifying a PII occurrence within content.
 * Contains location and redaction information.
 */
export interface PiiAnnotation {
  /** Type of PII detected */
  type: PiiType;

  /** Start position in the content string (inclusive) */
  startIndex: number;

  /** End position in the content string (exclusive) */
  endIndex: number;

  /** Redacted form suitable for logging/display */
  redactedForm: string;

  /** Confidence score (0-1) in the detection */
  confidence: number;
}

/**
 * Custom rule for automatic content classification.
 * Rules are evaluated in order and can override default keyword-based classification.
 */
export interface DataClassificationRule {
  /** Unique identifier for this rule */
  id: string;

  /** Human-readable name for this rule */
  name: string;

  /** Classification level this rule assigns */
  level: DataClassificationLevel;

  /** Regex patterns that trigger this rule */
  patterns: string[];

  /** Keywords that trigger this rule */
  keywords: string[];

  /** Whether to auto-apply this rule or require confirmation */
  autoClassify: boolean;

  /** When this rule was created */
  createdAt: string;
}

/**
 * Entry in the classification audit trail.
 * Records each classification decision for compliance and debugging.
 */
export interface ClassificationAuditEntry {
  /** Unique identifier for this audit entry */
  id: string;

  /** Original content that was classified (truncated for storage) */
  originalContent: string;

  /** Classification level that was assigned */
  classificationLevel: DataClassificationLevel;

  /** Dimension for which classification was performed */
  dimension: DataHandlingDimension;

  /** Handling action that was taken */
  decision: HandlingDecision["action"];

  /** Reason for the classification decision */
  reason: string;

  /** ID linking to related audit records */
  auditTrailId: string;

  /** When classification occurred */
  classifiedAt: string;

  /** PII annotations found in the content */
  piiAnnotations: PiiAnnotation[];
}

export interface AuditLogClearRequest {
  principalId: string;
  authorized: boolean;
  reason?: string;
}

// ── PII Detection Patterns ─────────────────────────────────────────────
// Using simple patterns that avoid catastrophic backtracking

/**
 * Regex patterns for detecting various types of PII.
 * Each pattern includes a confidence score based on specificity.
 */
const PII_PATTERNS: Array<{ type: PiiType; pattern: string; confidence: number }> = [
  { type: "email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", confidence: 0.95 },
  { type: "phone", pattern: "\\+?[0-9]{3}[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}", confidence: 0.85 },
  { type: "ssn", pattern: "[0-9]{3}[-][0-9]{2}[-][0-9]{4}", confidence: 0.9 },
  { type: "credit_card", pattern: "[0-9]{4}[-][0-9]{4}[-][0-9]{4}[-][0-9]{4}", confidence: 0.95 },
  { type: "ip_address", pattern: "[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}", confidence: 0.7 },
  { type: "dob", pattern: "[0-9]{2}[/][0-9]{2}[/][0-9]{4}", confidence: 0.75 },
];

/**
 * Keywords that indicate classification levels.
 * Evaluated in order from most restrictive (restricted) to least (public).
 */
const CLASSIFICATION_KEYWORDS: Record<DataClassificationLevel, string[]> = {
  public: ["public", "announcement", "general", "faq"],
  internal: ["internal", "internal use only", "not for distribution", "internal use only"],
  confidential: ["confidential", "proprietary", "trade secret", "sensitive", "confidential"],
  restricted: ["restricted", "top secret", "classified", "highly confidential", "password", "secret key", "api key", "private key", "credit card"],
};

// ── Default Handling Rules ─────────────────────────────────────────────---

/**
 * Default handling rules mapping classification levels to actions per dimension.
 * These rules define the baseline protection policy.
 *
 * Rules by level:
 * - public: All operations allowed (no restrictions)
 * - internal: Cross-worker and debug require audit, logs are redacted
 * - confidential: Prompts audited, cross-worker and debug denied, logs redacted
 * - restricted: Most operations denied, artifacts summarized
 */
const DEFAULT_HANDLING_RULES: Record<DataClassificationLevel, Record<DataHandlingDimension, HandlingDecision["action"]>> = {
  public: {
    prompt: "allow",
    logs: "allow",
    memory: "allow",
    artifact: "allow",
    cross_worker: "allow",
    debug: "allow",
  },
  internal: {
    prompt: "allow",
    logs: "redact",
    memory: "allow",
    artifact: "allow",
    cross_worker: "audit",
    debug: "redact",
  },
  confidential: {
    prompt: "audit",
    logs: "redact",
    memory: "audit",
    artifact: "audit",
    cross_worker: "deny",
    debug: "deny",
  },
  restricted: {
    prompt: "deny",
    logs: "deny",
    memory: "deny",
    artifact: "summarize",
    cross_worker: "deny",
    debug: "deny",
  },
};

// ── Service ─────────────────────────────────────────────────────────────

/**
 * Configuration options for the data classification service.
 */
export interface DataClassificationServiceOptions {
  /** If true, downgrade "allow" to "audit" for non-public content */
  strictMode?: boolean;

  /** If true, automatically detect PII in content */
  autoDetectPii?: boolean;

  /** If true, maintain an audit log of classification decisions */
  enableAuditTrail?: boolean;

  /** Maximum audit entries retained in memory */
  maxAuditLogEntries?: number;
}

/**
 * Data Classification Service
 *
 * Provides automatic classification of content based on keywords, patterns,
 * and custom rules. Handles PII detection and appropriate redaction.
 *
 * ## Usage
 *
 * 1. Classify content to determine its sensitivity level
 * 2. Get handling decisions for specific dimensions (prompt, logs, memory)
 * 3. Filter content based on classification and dimension
 * 4. Maintain audit trail for compliance
 *
 * ## Classification Algorithm
 *
 * 1. Check custom rules first (highest priority)
 * 2. Evaluate keyword-based classification
 * 3. Apply PII-based upgrades (PII bumps public to confidential)
 * 4. Apply restricted keyword overrides (highest severity wins)
 */
export class DataClassificationService {
  private static readonly MAX_REGEX_CACHE_ENTRIES = 256;
  private static readonly DEFAULT_MAX_AUDIT_LOG_ENTRIES = 500;
  private readonly strictMode: boolean;
  private readonly autoDetectPii: boolean;
  private readonly enableAuditTrail: boolean;
  private readonly maxAuditLogEntries: number;
  private readonly rules: Map<string, DataClassificationRule> = new Map();
  private readonly auditLog: ClassificationAuditEntry[] = [];
  private readonly regexCache = new Map<string, RegExp>();

  constructor(options?: DataClassificationServiceOptions) {
    this.strictMode = options?.strictMode ?? false;
    this.autoDetectPii = options?.autoDetectPii ?? true;
    this.enableAuditTrail = options?.enableAuditTrail ?? true;
    this.maxAuditLogEntries = Math.max(1, options?.maxAuditLogEntries ?? DataClassificationService.DEFAULT_MAX_AUDIT_LOG_ENTRIES);
  }

  // ── Classification ────────────────────────────────────────────────────

  /**
   * Classifies content and returns the classification result.
   * This is the main entry point for determining content sensitivity.
   *
   * The classification process:
   * 1. Detects PII if auto-detection is enabled
   * 2. Checks custom rules for explicit classifications
   * 3. Applies keyword-based inference
   * 4. Upgrades level if high-confidence PII is found
   * 5. Overrides to restricted if dangerous keywords detected
   *
   * @param content - The content to classify
   * @param context - Optional context (source, tenant) for classification
   * @returns Classification result with level, PII info, and confidence
   */
  classify(
    contentOrInput: string | { dataType: string; context?: string },
    context?: { source?: string; tenantId?: string },
  ): ClassificationResult {
    if (typeof contentOrInput !== "string") {
      return this.classifyLegacyInput(contentOrInput);
    }
    const content = contentOrInput;
    const piiAnnotations = this.autoDetectPii ? this.detectPii(content) : [];
    const piiDetected = piiAnnotations.length > 0;
    const piiTypes = [...new Set(piiAnnotations.map((a) => a.type))];

    // Determine base classification from content
    let level = this.inferClassificationLevel(content, context);
    let confidence = 0.5;
    let reasoning = "keyword_based";
    let requiresAudit = false;
    let autoAnnotated = false;

    // Check custom rules first
    for (const rule of this.rules.values()) {
      if (this.matchesRule(content, rule)) {
        level = rule.level;
        confidence = 0.9;
        reasoning = `rule_match:${rule.name}`;
        autoAnnotated = rule.autoClassify;
        break;
      }
    }

    // PII detected bumps to at least confidential
    if (piiDetected && level === "public") {
      const maxPiiConfidence = Math.max(...piiAnnotations.map((a) => a.confidence));
      if (maxPiiConfidence > 0.8) {
        level = "confidential";
        reasoning = "pii_detected";
        autoAnnotated = true;
      }
    }

    // Restricted keywords always bump to restricted
    if (CLASSIFICATION_KEYWORDS.restricted.some((kw) => content.toLowerCase().includes(kw))) {
      level = "restricted";
      reasoning = "restricted_keyword_detected";
      requiresAudit = true;
    }

    // High confidence PII detection
    if (piiTypes.some((t) => ["ssn", "credit_card", "password", "secret"].includes(t))) {
      level = "restricted";
      reasoning = "high_value_pii_detected";
      requiresAudit = true;
    }

    return {
      level,
      piiTypes,
      piiDetected,
      confidence,
      reasoning,
      requiresAudit,
      autoAnnotated,
    };
  }

  // ── PII Detection ────────────────────────────────────────────────────

  /**
   * Detects PII in content using regex patterns.
   * Returns annotations with location and redaction information.
   *
   * @param content - The content to scan for PII
   * @returns Array of PII annotations with locations and redacted forms
   */
  detectPii(content: string): PiiAnnotation[] {
    const annotations: PiiAnnotation[] = [];

    for (const { type, pattern, confidence } of PII_PATTERNS) {
      const regex = this.getCachedRegex(pattern, "g");
      if (regex == null) {
        continue;
      }
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        annotations.push({
          type,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          redactedForm: this.redactPii(match[0], type),
          confidence,
        });
        // Prevent infinite loop on zero-width matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    }

    return annotations;
  }

  /**
   * Creates an appropriate redacted form for a PII value.
   * Preserves some characters for context while hiding sensitive data.
   *
   * @param value - The original PII value
   * @param type - The type of PII for appropriate redaction
   * @returns Redacted string safe for logging/display
   */
  private redactPii(value: string, type: PiiType): string {
    switch (type) {
      case "email": {
        const [user = "", domain = ""] = value.split("@");
        return `${user.slice(0, 2)}***@${domain}`;
      }
      case "phone":
        return `***-***-${value.slice(-4)}`;
      case "ssn":
        return "***-**-" + value.slice(-4);
      case "credit_card":
        return "****-****-****-" + value.slice(-4);
      case "ip_address":
        return "0.0.0.0";
      case "dob":
        return "[REDACTED-DOB]";
      default:
        return "[REDACTED]";
    }
  }

  // ── Handling Decisions ────────────────────────────────────────────────

  /**
   * Gets the handling decision for a classification level and dimension.
   * Combines default rules with strict mode adjustments.
   *
   * @param level - The classification level
   * @param dimension - The handling dimension
   * @param content - Optional content for context
   * @returns Handling decision with action and reason
   */
  getHandlingDecision(
    level: DataClassificationLevel,
    dimension: DataHandlingDimension,
    content?: string,
  ): HandlingDecision {
    const auditTrailId = this.enableAuditTrail ? newId("audit") : null;
    const defaultAction = DEFAULT_HANDLING_RULES[level][dimension];

    // In strict mode, downgrade "allow" to "audit" for internal+ content
    let action = defaultAction;
    if (this.strictMode && level !== "public" && action === "allow") {
      action = "audit";
    }

    const allowed = action === "allow";

    return {
      allowed,
      action,
      level,
      dimension,
      reason: `level:${level}_action:${action}_dimension:${dimension}`,
      auditTrailId,
    };
  }

  decide(input: { level: DataClassificationLevel; dimension: DataHandlingDimension }): HandlingDecision {
    return this.getHandlingDecision(input.level, input.dimension);
  }

  /**
   * Filters content for use in prompts based on its classification.
   * Applies appropriate redaction or denial based on policy.
   *
   * @param content - The content to filter
   * @param context - Optional context for classification
   * @returns Filtered content, decision made, and PII annotations
   */
  filterForPrompt(content: string, context?: { source?: string; tenantId?: string }): {
    filtered: string;
    decision: HandlingDecision;
    annotations: PiiAnnotation[];
  } {
    const classification = this.classify(content, context);
    const decision = this.getHandlingDecision(classification.level, "prompt", content);

    let filtered = content;
    let annotations: PiiAnnotation[] = [];

    if (decision.action === "deny") {
      filtered = "[CONTENT DENIED DUE TO CLASSIFICATION POLICY]";
    } else if (decision.action === "redact" || decision.action === "audit") {
      annotations = this.detectPii(content);
      filtered = this.redactContent(content, annotations);
    } else if (decision.action === "summarize") {
      filtered = `[SUMMARY OF ${classification.level.toUpperCase()} CONTENT - ORIGINAL EXCLUDED]`;
    }

    // Log audit trail
    if (this.enableAuditTrail && decision.action !== "allow") {
      this.logAuditEntry({
        originalContent: content.slice(0, 1000), // Truncate for storage
        classificationLevel: classification.level,
        dimension: "prompt",
        decision: decision.action,
        reason: decision.reason,
        auditTrailId: decision.auditTrailId!,
        piiAnnotations: annotations,
      });
    }

    return { filtered, decision, annotations };
  }

  /**
   * Filters content for logging based on its classification.
   * Applies redaction to protect sensitive data in logs.
   *
   * @param content - The content to filter
   * @param context - Optional context for classification
   * @returns Filtered content, decision made, and PII annotations
   */
  filterForLogs(content: string, context?: { source?: string; tenantId?: string }): {
    filtered: string;
    decision: HandlingDecision;
    annotations: PiiAnnotation[];
  } {
    const classification = this.classify(content, context);
    const decision = this.getHandlingDecision(classification.level, "logs", content);

    let filtered = content;
    let annotations: PiiAnnotation[] = [];

    if (decision.action === "deny") {
      filtered = "[LOG DENIED DUE TO CLASSIFICATION POLICY]";
    } else if (decision.action === "redact") {
      annotations = this.detectPii(content);
      filtered = this.redactContent(content, annotations);
    }

    return { filtered, decision, annotations };
  }

  /**
   * Filters content for memory storage based on its classification.
   * Determines whether content can be stored and at what protection level.
   *
   * @param content - The content to filter
   * @param context - Optional context for classification
   * @returns Filtered content, decision made, and PII annotations
   */
  filterForMemory(content: string, context?: { source?: string; tenantId?: string }): {
    filtered: string;
    decision: HandlingDecision;
    annotations: PiiAnnotation[];
  } {
    const classification = this.classify(content, context);
    const decision = this.getHandlingDecision(classification.level, "memory", content);

    let filtered = content;
    let annotations: PiiAnnotation[] = [];

    if (decision.action === "deny") {
      filtered = "[MEMORY DENIED DUE TO CLASSIFICATION POLICY]";
    } else if (decision.action === "redact" || decision.action === "audit") {
      annotations = this.detectPii(content);
      filtered = this.redactContent(content, annotations);
    } else if (decision.action === "summarize") {
      filtered = `[MEMORY SUMMARY OF ${classification.level.toUpperCase()} CONTENT - ORIGINAL EXCLUDED]`;
    }

    return { filtered, decision, annotations };
  }

  // ── Content Redaction ────────────────────────────────────────────────

  /**
   * Applies redaction annotations to content, replacing PII with redacted forms.
   * Annotations are processed in reverse order to maintain correct positions.
   *
   * @param content - The original content
   * @param annotations - PII annotations to apply
   * @returns Content with PII replaced by redacted forms
   */
  redactContent(content: string, annotations: PiiAnnotation[]): string {
    if (annotations.length === 0) return content;

    // Sort by start index descending to replace from end
    const sorted = [...annotations].sort((a, b) => b.startIndex - a.startIndex);

    let result = content;
    for (const annotation of sorted) {
      result = result.slice(0, annotation.startIndex) + annotation.redactedForm + result.slice(annotation.endIndex);
    }

    return result;
  }

  // ── Classification Rules ────────────────────────────────────────────

  /**
   * Defines a new custom classification rule.
   * Rules are evaluated before default keyword-based classification.
   *
   * @param input - Rule definition without id and createdAt
   * @returns The created rule with id and timestamp
   */
  defineRule(input: Omit<DataClassificationRule, "id" | "createdAt">): DataClassificationRule {
    const rule: DataClassificationRule = {
      id: newId("classrule"),
      createdAt: nowIso(),
      ...input,
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  /**
   * Retrieves a classification rule by ID.
   *
   * @param ruleId - The rule identifier
   * @returns The rule if found, null otherwise
   */
  getRule(ruleId: string): DataClassificationRule | null {
    return this.rules.get(ruleId) ?? null;
  }

  /**
   * Removes a classification rule.
   *
   * @param ruleId - The rule identifier to remove
   * @returns true if the rule was deleted
   */
  deleteRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Lists all defined classification rules.
   *
   * @returns Array of all classification rules
   */
  listRules(): DataClassificationRule[] {
    return [...this.rules.values()];
  }

  // ── Audit Trail ──────────────────────────────────────────────────────

  /**
   * Records a classification decision in the audit log.
   *
   * @param entry - The audit entry to log
   */
  private logAuditEntry(entry: Omit<ClassificationAuditEntry, "id" | "classifiedAt">): void {
    const fullEntry: ClassificationAuditEntry = {
      id: newId("clfsaudit"),
      classifiedAt: nowIso(),
      ...entry,
    };
    this.auditLog.push(fullEntry);
    if (this.auditLog.length > this.maxAuditLogEntries) {
      this.auditLog.splice(0, this.auditLog.length - this.maxAuditLogEntries);
    }
  }

  /**
   * Retrieves recent audit log entries.
   *
   * @param limit - Maximum number of entries to return
   * @returns Array of audit entries, most recent last
   */
  getAuditLog(limit: number = 100): ClassificationAuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Clears the audit log.
   * Use with caution - this cannot be undone.
   */
  clearAuditLog(request: AuditLogClearRequest): void {
    if (!request.authorized) {
      throw new ValidationError(
        "data_classification.audit_log_clear_forbidden",
        "data_classification.audit_log_clear_forbidden: Clearing classification audit logs requires explicit authorization.",
      );
    }
    const clearedEntries = this.auditLog.length;
    this.auditLog.length = 0;
    this.logAuditEntry({
      originalContent: "[audit-log-cleared]",
      classificationLevel: "restricted",
      dimension: "debug",
      decision: "audit",
      reason: `audit_log_cleared:${request.reason ?? "operator_request"}:${clearedEntries}`,
      auditTrailId: `audit://classification/audit-log-clear/${request.principalId}`,
      piiAnnotations: [],
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /**
   * Infers the classification level based on keywords in content.
   * Keywords are evaluated in order of severity (restricted first).
   *
   * @param content - The content to analyze
   * @param context - Optional context for additional determination
   * @returns Inferred classification level
   */
  private inferClassificationLevel(
    content: string,
    context?: { source?: string; tenantId?: string },
  ): DataClassificationLevel {
    const lower = content.toLowerCase();

    // Check keywords in order of severity
    for (const kw of CLASSIFICATION_KEYWORDS.restricted) {
      if (lower.includes(kw)) return "restricted";
    }
    for (const kw of CLASSIFICATION_KEYWORDS.confidential) {
      if (lower.includes(kw)) return "confidential";
    }
    for (const kw of CLASSIFICATION_KEYWORDS.internal) {
      if (lower.includes(kw)) return "internal";
    }

    return "public";
  }

  /**
   * Checks if content matches a classification rule.
   * A match occurs if any pattern OR any keyword matches.
   *
   * @param content - The content to check
   * @param rule - The rule to match against
   * @returns true if content matches the rule
   */
  private matchesRule(content: string, rule: DataClassificationRule): boolean {
    const lower = content.toLowerCase();

    // Check patterns
    for (const pattern of rule.patterns) {
      const regex = this.getCachedRegex(pattern, "i");
      if (regex == null) {
        continue;
      }
      regex.lastIndex = 0;
      if (regex.test(content)) return true;
    }

    // Check keywords
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword.toLowerCase())) return true;
    }

    return false;
  }

  private isRegexSafe(pattern: string): boolean {
    if (pattern.length === 0 || pattern.length > 512) {
      return false;
    }
    if (hasUnsafeRegexShape(pattern)) {
      return false;
    }
    try {
      void new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  }

  private classifyLegacyInput(input: { dataType: string; context?: string }): ClassificationResult {
    const key = `${input.dataType} ${input.context ?? ""}`.toLowerCase();
    const piiTypes: PiiType[] = [];
    let level: DataClassificationLevel = "public";
    let requiresAudit = false;

    if (key.includes("public_announcement")) {
      level = "public";
    } else if (key.includes("internal_report")) {
      level = "internal";
    } else if (key.includes("credit_card")) {
      level = "confidential";
      piiTypes.push("credit_card");
    } else if (key.includes("social_security")) {
      level = "restricted";
      piiTypes.push("ssn");
      requiresAudit = true;
    } else if (key.includes("email_address")) {
      level = "confidential";
      piiTypes.push("email");
    } else if (key.includes("trade_secret")) {
      level = "confidential";
      requiresAudit = true;
    } else if (key.includes("api_key")) {
      level = "restricted";
      requiresAudit = true;
    } else if (key.includes("medical_record")) {
      level = "restricted";
      requiresAudit = true;
    } else if (key.includes("restricted") || key.includes("secret")) {
      level = "restricted";
      requiresAudit = true;
    } else if (key.includes("confidential") || key.includes("payment")) {
      level = "confidential";
    } else if (key.includes("internal")) {
      level = "internal";
    }

    return {
      level,
      piiTypes,
      piiDetected: piiTypes.length > 0,
      confidence: 0.9,
      reasoning: `legacy_data_type:${input.dataType}`,
      requiresAudit,
      autoAnnotated: true,
    };
  }

  private getCachedRegex(pattern: string, flags: string): RegExp | null {
    if (!this.isRegexSafe(pattern)) {
      return null;
    }
    const cacheKey = `${flags}:${pattern}`;
    const cached = this.regexCache.get(cacheKey);
    if (cached != null) {
      return cached;
    }
    const compiled = new RegExp(pattern, flags);
    if (this.regexCache.size >= DataClassificationService.MAX_REGEX_CACHE_ENTRIES) {
      const oldestKey = this.regexCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.regexCache.delete(oldestKey);
      }
    }
    this.regexCache.set(cacheKey, compiled);
    return compiled;
  }
}

function hasUnsafeRegexShape(pattern: string): boolean {
  const nestedQuantifier = /\((?:[^()]|\\.)*[+*](?:[^()]|\\.)*\)[+*{]/;
  const repeatedWildcard = /(?:\.\*|\.\+){2,}/;
  const backReference = /\\[1-9]/;
  return nestedQuantifier.test(pattern) || repeatedWildcard.test(pattern) || backReference.test(pattern);
}
