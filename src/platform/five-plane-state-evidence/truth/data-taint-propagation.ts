/**
 * @fileoverview Data Taint Propagation Service
 *
 * Implements §11.6 DataTaintPropagation hard rules:
 * - output_data_class must not be lower than highest input data_class
 * - taint_labels must propagate with ToolOutput, PromptExecutionRecord,
 *   MemoryWriteRequest, FeedbackSignal, LearningObject, and explanation artifacts
 * - Downgrade requires explicit sanitization proof + redaction_report + reviewer evidence
 *
 * @see docs_zh/contracts/data_classification_and_prompt_handling_contract.md
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import type { DataClassificationLevel } from "../../control-plane/iam/data-classification-service.js";

// Re-export the classification level type for convenience
export type { DataClassificationLevel };

/**
 * DataTaintPropagationRecord minimum fields per §11.6:
 * - input_data_classes: The classification levels of all inputs
 * - max_input_data_class: The highest classification level among inputs
 * - output_data_class: The resulting classification level after transformation
 * - taint_labels: Propagation metadata for cross-plugin contamination tracking
 * - redaction_report_ref?: Proof of field-level redaction if downgrade occurred
 * - desensitization_evidence_ref?: Evidence of sanitization applied
 * - reviewer_decision_ref?: Policy/reviewer approval for any exceptions
 */
export interface DataTaintPropagationRecord {
  readonly id: string;
  readonly sourceObjectType: TaintSourceObjectType;
  readonly sourceObjectId: string;
  readonly inputDataClasses: readonly DataClassificationLevel[];
  readonly maxInputDataClass: DataClassificationLevel;
  readonly outputDataClass: DataClassificationLevel;
  readonly taintLabels: readonly DataTaintLabel[];
  readonly redactionReportRef?: string;
  readonly desensitizationEvidenceRef?: string;
  readonly reviewerDecisionRef?: string;
  readonly createdAt: string;
  readonly description?: string;
}

/**
 * Types of objects that can be sources or carriers of taint propagation.
 * Per §11.6, taint_labels must propagate with these artifact types.
 */
export type TaintSourceObjectType =
  | "ToolOutput"
  | "PromptExecutionRecord"
  | "MemoryWriteRequest"
  | "FeedbackSignal"
  | "LearningObject"
  | "ExplanationArtifact"
  | "DelegationResult"
  | "Artifact"
  | "Summary";

/**
 * Individual taint label for tracking contamination.
 * Tracks source, label, severity, and propagation chain.
 */
export interface DataTaintLabel {
  readonly sourcePluginId: string;
  readonly label: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly propagatedAt: string;
  readonly expiresAt?: string;
  readonly propagationChain: readonly string[];
}

/**
 * Result of computing taint propagation for a transformation.
 * Includes the computed output classification and any warnings/violations.
 */
export interface TaintPropagationResult {
  readonly record: DataTaintPropagationRecord;
  readonly violations: readonly TaintViolation[];
  readonly warnings: readonly string[];
  readonly downgradeApproved: boolean;
}

/**
 * Violation of taint propagation hard rules.
 * When output_data_class < max_input_data_class without proper approval.
 */
export interface TaintViolation {
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
  readonly requiresEscalation: boolean;
}

/**
 * Options for computing taint propagation.
 */
export interface ComputeTaintPropagationOptions {
  /** Source type of the object being created */
  sourceObjectType: TaintSourceObjectType;
  /** Unique ID of the source object */
  sourceObjectId: string;
  /** Classification levels of all inputs to the transformation */
  inputDataClasses: readonly DataClassificationLevel[];
  /** Taint labels from input objects */
  inputTaintLabels?: readonly DataTaintLabel[];
  /** Optional redaction report reference if sanitization was applied */
  redactionReportRef?: string;
  /** Optional desensitization evidence if sanitization was applied */
  desensitizationEvidenceRef?: string;
  /** Optional reviewer decision reference for exceptions */
  reviewerDecisionRef?: string;
  /** Human-readable description of the transformation */
  description?: string;
  /** Source plugin ID for labeling */
  sourcePluginId: string;
}

/**
 * Service for computing and enforcing data taint propagation rules.
 *
 * ## Hard Rules (§11.6)
 *
 * 1. output_data_class must NOT be lower than max_input_data_class
 *    - Exception: when sanitization proof + redaction report + reviewer evidence all exist
 * 2. taint_labels must propagate with the output object
 * 3. If downstream objects lack taint metadata, fail-closed or elevate output_data_class
 */
export class DataTaintPropagationService {
  private readonly records: Map<string, DataTaintPropagationRecord> = new Map();

  /**
   * Compute taint propagation for a transformation.
   *
   * @param options - Configuration for computing propagation
   * @returns Result with propagation record and any violations
   */
  computePropagation(options: ComputeTaintPropagationOptions): TaintPropagationResult {
    const { inputDataClasses } = options;

    // Determine maximum input classification level
    const maxInputDataClass = this.computeMaxLevel(inputDataClasses);

    // Determine output level based on downgrade rules
    const downgradeApproved = this.isDowngradeApproved(options, maxInputDataClass);

    // Compute output class - must be at least max input unless approved
    let outputDataClass: DataClassificationLevel;

    if (options.inputDataClasses.length === 0) {
      // No inputs - output inherits source plugin trust level default
      outputDataClass = "internal";
    } else if (downgradeApproved) {
      // Downgrade was approved with proper evidence
      outputDataClass = options.inputDataClasses.includes("confidential")
        ? "internal"
        : options.inputDataClasses.includes("restricted")
          ? "confidential"
          : maxInputDataClass;
    } else {
      // Fail-closed: output cannot be lower than max input
      outputDataClass = maxInputDataClass;
    }

    // Propagate taint labels from inputs
    const propagatedLabels = this.propagateTaintLabels(
      options.inputTaintLabels ?? [],
      options.sourcePluginId,
      options.sourceObjectId,
    );

    const record: DataTaintPropagationRecord = {
      id: newId("taintprop"),
      sourceObjectType: options.sourceObjectType,
      sourceObjectId: options.sourceObjectId,
      inputDataClasses: [...inputDataClasses],
      maxInputDataClass,
      outputDataClass,
      taintLabels: propagatedLabels,
      createdAt: nowIso(),
      ...(options.redactionReportRef !== undefined && { redactionReportRef: options.redactionReportRef }),
      ...(options.desensitizationEvidenceRef !== undefined && { desensitizationEvidenceRef: options.desensitizationEvidenceRef }),
      ...(options.reviewerDecisionRef !== undefined && { reviewerDecisionRef: options.reviewerDecisionRef }),
      ...(options.description !== undefined && { description: options.description }),
    };

    // Check for violations
    const violations = this.computeViolations(record, options, downgradeApproved);
    const warnings = this.computeWarnings(record, options);

    return {
      record,
      violations,
      warnings,
      downgradeApproved,
    };
  }

  /**
   * Store a computed taint propagation record.
   * Call this after a transformation is complete.
   */
  recordPropagation(record: DataTaintPropagationRecord): void {
    this.records.set(record.id, record);
  }

  /**
   * Retrieve a taint propagation record by ID.
   */
  getRecord(id: string): DataTaintPropagationRecord | null {
    return this.records.get(id) ?? null;
  }

  /**
   * Retrieve taint propagation records for a source object.
   */
  getRecordsBySourceObject(sourceObjectId: string): readonly DataTaintPropagationRecord[] {
    const results: DataTaintPropagationRecord[] = [];
    for (const record of this.records.values()) {
      if (record.sourceObjectId === sourceObjectId) {
        results.push(record);
      }
    }
    return results;
  }

  /**
   * Check if an object has specific taint labels.
   */
  hasTaintLabel(sourceObjectId: string, label: string): boolean {
    const records = this.getRecordsBySourceObject(sourceObjectId);
    return records.some((record) =>
      record.taintLabels.some((l) => l.label === label),
    );
  }

  /**
   * Get all taint labels for an object.
   */
  getTaintLabels(sourceObjectId: string): readonly DataTaintLabel[] {
    const records = this.getRecordsBySourceObject(sourceObjectId);
    const allLabels: DataTaintLabel[] = [];
    for (const record of records) {
      allLabels.push(...record.taintLabels);
    }
    return allLabels;
  }

  /**
   * Validate that output classification is valid per hard rules.
   * Returns violations if any rules are broken.
   */
  validateOutputClassification(
    inputDataClasses: readonly DataClassificationLevel[],
    outputDataClass: DataClassificationLevel,
    sourceObjectId: string,
  ): readonly TaintViolation[] {
    const maxInput = this.computeMaxLevel(inputDataClasses);
    const outputRank = this.rankLevel(outputDataClass);
    const maxInputRank = this.rankLevel(maxInput);

    const violations: TaintViolation[] = [];

    if (outputRank < maxInputRank) {
      // Check if there's approval for this downgrade
      const records = this.getRecordsBySourceObject(sourceObjectId);
      const hasApproval = records.some((r) => r.redactionReportRef && r.reviewerDecisionRef);

      if (!hasApproval) {
        violations.push({
          code: "TAINT_PROPAGATION_HARD_RULE_VIOLATION",
          message: `output_data_class (${outputDataClass}) cannot be lower than max_input_data_class (${maxInput}) without explicit sanitization proof, redaction_report, and reviewer evidence`,
          severity: "error",
          requiresEscalation: true,
        });
      }
    }

    return violations;
  }

  /**
   * Compute the maximum classification level from a list.
   */
  computeMaxLevel(levels: readonly DataClassificationLevel[]): DataClassificationLevel {
    if (levels.length === 0) {
      return "public";
    }

    let max: DataClassificationLevel = "public";
    for (const level of levels) {
      if (this.rankLevel(level) > this.rankLevel(max)) {
        max = level;
      }
    }
    return max;
  }

  /**
   * Rank classification levels by security sensitivity.
   * Higher rank = more sensitive = should not be downgraded without evidence.
   */
  private rankLevel(level: DataClassificationLevel): number {
    switch (level) {
      case "public":
        return 0;
      case "internal":
        return 1;
      case "confidential":
        return 2;
      case "restricted":
        return 3;
      default:
        return -1;
    }
  }

  /**
   * Check if a downgrade is properly approved per §11.6.
   * Downgrade requires ALL THREE: sanitization proof + redaction_report + reviewer evidence.
   */
  private isDowngradeApproved(
    options: ComputeTaintPropagationOptions,
    maxInput: DataClassificationLevel,
  ): boolean {
    // Check if we actually need a downgrade
    // Default output is maxInput unless we have explicit approval
    const needsDowngrade = options.inputDataClasses.some(
      (l) => this.rankLevel(l) > this.rankLevel(maxInput),
    );
    if (!needsDowngrade) {
      return false;
    }

    // All three required for downgrade approval
    const hasRedactionReport = !!options.redactionReportRef;
    const hasDesensitizationEvidence = !!options.desensitizationEvidenceRef;
    const hasReviewerDecision = !!options.reviewerDecisionRef;

    return hasRedactionReport && hasDesensitizationEvidence && hasReviewerDecision;
  }

  /**
   * Propagate taint labels from inputs to the output.
   * Labels must propagate and not be lost at intermediate layers.
   */
  private propagateTaintLabels(
    inputLabels: readonly DataTaintLabel[],
    targetPluginId: string,
    targetObjectId: string,
  ): DataTaintLabel[] {
    const now = nowIso();
    const propagated: DataTaintLabel[] = [];

    for (const label of inputLabels) {
      propagated.push({
        ...label,
        sourcePluginId: targetPluginId,
        propagatedAt: now,
        propagationChain: [...label.propagationChain, targetObjectId],
      });
    }

    return propagated;
  }

  /**
   * Compute violations for a propagation result.
   */
  private computeViolations(
    record: DataTaintPropagationRecord,
    options: ComputeTaintPropagationOptions,
    downgradeApproved: boolean,
  ): TaintViolation[] {
    const violations: TaintViolation[] = [];

    const outputRank = this.rankLevel(record.outputDataClass);
    const maxInputRank = this.rankLevel(record.maxInputDataClass);

    if (outputRank < maxInputRank && !downgradeApproved) {
      violations.push({
        code: "TAINT_PROPAGATION_HARD_RULE_VIOLATION",
        message: `output_data_class (${record.outputDataClass}) is lower than max_input_data_class (${record.maxInputDataClass}). Downgrade requires explicit sanitization proof + redaction_report + reviewer evidence.`,
        severity: "error",
        requiresEscalation: true,
      });
    }

    // Check that taint_labels were propagated
    if (options.inputTaintLabels && options.inputTaintLabels.length > 0) {
      if (record.taintLabels.length === 0) {
        violations.push({
          code: "TAINT_LABELS_NOT_PROPAGATED",
          message: "input taint_labels were not propagated to output - taint_labels must not be lost at intermediate layers",
          severity: "error",
          requiresEscalation: false,
        });
      }
    }

    return violations;
  }

  /**
   * Compute warnings that don't rise to violation level.
   */
  private computeWarnings(
    record: DataTaintPropagationRecord,
    options: ComputeTaintPropagationOptions,
  ): string[] {
    const warnings: string[] = [];

    // Warn if input data class is high sensitivity
    if (record.maxInputDataClass === "restricted") {
      warnings.push("Processing restricted data - ensure proper handling per §11.6");
    }

    // Warn if no taint labels provided but high sensitivity input
    if (
      record.maxInputDataClass === "confidential" &&
      record.taintLabels.length === 0 &&
      (!options.inputTaintLabels || options.inputTaintLabels.length === 0)
    ) {
      warnings.push("No taint labels provided for confidential data - consider adding for traceability");
    }

    return warnings;
  }

  /**
   * Get classification rank for ordering.
   */
  getClassificationRank(level: DataClassificationLevel): number {
    return this.rankLevel(level);
  }
}

// Singleton instance for platform-wide use
let globalServiceInstance: DataTaintPropagationService | null = null;

/**
 * Get the global DataTaintPropagationService instance.
 */
export function getDataTaintPropagationService(): DataTaintPropagationService {
  if (!globalServiceInstance) {
    globalServiceInstance = new DataTaintPropagationService();
  }
  return globalServiceInstance;
}