/**
 * Data Classification Types
 *
 * Defines the classification level hierarchy used across all planes
 * for data sensitivity categorization.
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
export type DataHandlingDimension =
  | "prompt"
  | "logs"
  | "memory"
  | "artifact"
  | "cross_worker"
  | "debug"
  | "audit";
