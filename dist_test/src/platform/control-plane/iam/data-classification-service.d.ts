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
export declare class DataClassificationService {
    private readonly strictMode;
    private readonly autoDetectPii;
    private readonly enableAuditTrail;
    private readonly rules;
    private readonly auditLog;
    constructor(options?: DataClassificationServiceOptions);
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
    classify(content: string, context?: {
        source?: string;
        tenantId?: string;
    }): ClassificationResult;
    /**
     * Detects PII in content using regex patterns.
     * Returns annotations with location and redaction information.
     *
     * @param content - The content to scan for PII
     * @returns Array of PII annotations with locations and redacted forms
     */
    detectPii(content: string): PiiAnnotation[];
    /**
     * Creates an appropriate redacted form for a PII value.
     * Preserves some characters for context while hiding sensitive data.
     *
     * @param value - The original PII value
     * @param type - The type of PII for appropriate redaction
     * @returns Redacted string safe for logging/display
     */
    private redactPii;
    /**
     * Gets the handling decision for a classification level and dimension.
     * Combines default rules with strict mode adjustments.
     *
     * @param level - The classification level
     * @param dimension - The handling dimension
     * @param content - Optional content for context
     * @returns Handling decision with action and reason
     */
    getHandlingDecision(level: DataClassificationLevel, dimension: DataHandlingDimension, content?: string): HandlingDecision;
    /**
     * Filters content for use in prompts based on its classification.
     * Applies appropriate redaction or denial based on policy.
     *
     * @param content - The content to filter
     * @param context - Optional context for classification
     * @returns Filtered content, decision made, and PII annotations
     */
    filterForPrompt(content: string, context?: {
        source?: string;
        tenantId?: string;
    }): {
        filtered: string;
        decision: HandlingDecision;
        annotations: PiiAnnotation[];
    };
    /**
     * Filters content for logging based on its classification.
     * Applies redaction to protect sensitive data in logs.
     *
     * @param content - The content to filter
     * @param context - Optional context for classification
     * @returns Filtered content, decision made, and PII annotations
     */
    filterForLogs(content: string, context?: {
        source?: string;
        tenantId?: string;
    }): {
        filtered: string;
        decision: HandlingDecision;
        annotations: PiiAnnotation[];
    };
    /**
     * Filters content for memory storage based on its classification.
     * Determines whether content can be stored and at what protection level.
     *
     * @param content - The content to filter
     * @param context - Optional context for classification
     * @returns Filtered content, decision made, and PII annotations
     */
    filterForMemory(content: string, context?: {
        source?: string;
        tenantId?: string;
    }): {
        filtered: string;
        decision: HandlingDecision;
        annotations: PiiAnnotation[];
    };
    /**
     * Applies redaction annotations to content, replacing PII with redacted forms.
     * Annotations are processed in reverse order to maintain correct positions.
     *
     * @param content - The original content
     * @param annotations - PII annotations to apply
     * @returns Content with PII replaced by redacted forms
     */
    redactContent(content: string, annotations: PiiAnnotation[]): string;
    /**
     * Defines a new custom classification rule.
     * Rules are evaluated before default keyword-based classification.
     *
     * @param input - Rule definition without id and createdAt
     * @returns The created rule with id and timestamp
     */
    defineRule(input: Omit<DataClassificationRule, "id" | "createdAt">): DataClassificationRule;
    /**
     * Retrieves a classification rule by ID.
     *
     * @param ruleId - The rule identifier
     * @returns The rule if found, null otherwise
     */
    getRule(ruleId: string): DataClassificationRule | null;
    /**
     * Removes a classification rule.
     *
     * @param ruleId - The rule identifier to remove
     * @returns true if the rule was deleted
     */
    deleteRule(ruleId: string): boolean;
    /**
     * Lists all defined classification rules.
     *
     * @returns Array of all classification rules
     */
    listRules(): DataClassificationRule[];
    /**
     * Records a classification decision in the audit log.
     *
     * @param entry - The audit entry to log
     */
    private logAuditEntry;
    /**
     * Retrieves recent audit log entries.
     *
     * @param limit - Maximum number of entries to return
     * @returns Array of audit entries, most recent last
     */
    getAuditLog(limit?: number): ClassificationAuditEntry[];
    /**
     * Clears the audit log.
     * Use with caution - this cannot be undone.
     */
    clearAuditLog(): void;
    /**
     * Infers the classification level based on keywords in content.
     * Keywords are evaluated in order of severity (restricted first).
     *
     * @param content - The content to analyze
     * @param context - Optional context for additional determination
     * @returns Inferred classification level
     */
    private inferClassificationLevel;
    /**
     * Checks if content matches a classification rule.
     * A match occurs if any pattern OR any keyword matches.
     *
     * @param content - The content to check
     * @param rule - The rule to match against
     * @returns true if content matches the rule
     */
    private matchesRule;
}
