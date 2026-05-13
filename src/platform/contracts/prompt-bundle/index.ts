/**
 * PromptBundle Contract
 *
 * Defines the PromptBundle type as specified in architecture document §16.
 * A PromptBundle is a composition of system prompt + user prompt + few-shot examples + constraints.
 *
 * §16.2: version is an incrementing integer (not semver) for deterministic ordering.
 * Use semver format only in display/metadata, not for version comparison.
 */

import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";

/** §16.4: Compatibility matrix for a PromptBundle covering Tool/Evaluator/Domain/Model compatibility */
export interface PromptBundleCompatibilityMatrix {
  /** Tool schema versions this bundle is compatible with */
  toolSchemaVersions: ReadonlyArray<{ toolName: string; schemaVersion: number }>;
  /** Evaluator schema versions this bundle is compatible with */
  evaluatorSchemaVersions: ReadonlyArray<{ evaluatorName: string; schemaVersion: number }>;
  /** DomainDescriptor versions this bundle is compatible with */
  domainDescriptorVersions: ReadonlyArray<{ domainId: string; version: number }>;
  /** Model routing profiles this bundle is compatible with */
  modelRoutingProfiles: ReadonlyArray<{ modelId: string; profileVersion: number }>;
}

export interface PromptBundle {
  bundleId: string;
  name: string;
  /** §16.2: Incrementing integer version for deterministic ordering */
  version: number;
  /** Display version in semver format (for human readability only, not for comparison) */
  displayVersion: string;
  domain: string;
  taskType: string;
  packId: string | undefined;
  systemPrompt: PromptBundleSegment;
  userPrompt: PromptBundleSegment | undefined;
  fewShotExamples: FewShotExample[];
  constraints: PromptBundleConstraints;
  /** §16.4: Compatibility matrix - must cover Tool/Evaluator/DomainDescriptor/Model routing */
  compatibilityMatrix: PromptBundleCompatibilityMatrix;
  metadata: PromptBundleMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface PromptBundleSegment {
  content: string;
  templateVariables: string[];
  channel: "system" | "developer" | "user";
}

export interface FewShotExample {
  exampleId: string;
  input: string;
  output: string;
  explanation: string | undefined;
  tags: string[];
}

export interface PromptBundleConstraints {
  maxTokens: number | undefined;
  temperature: number | undefined;
  topP: number | undefined;
  stopSequences: string[] | undefined;
  responseFormat: "text" | "json" | "xml" | "markdown" | undefined;
  customConstraints: Record<string, unknown>;
}

export interface PromptBundleMetadata {
  owner: string;
  /** @deprecated Use lifecycleStatus instead - deprecated boolean flag */
  deprecated: boolean;
  /** §20.6: Prompt lifecycle status - draft→active→deprecated→archived */
  lifecycleStatus: PromptLifecycleStatus;
  tags: string[];
  compatibilityTags: string[];
  trafficAllocation: PromptBundleTrafficAllocation;
}

/** §20.6: Prompt lifecycle phases */
export type PromptLifecycleStatus = "draft" | "active" | "deprecated" | "archived";

export interface PromptBundleTrafficAllocation {
  /** Percentage of traffic for this version (0-100) */
  weight: number;
  /** Start time for this allocation (ISO timestamp) */
  startTime: string | undefined;
  /** End time for this allocation (ISO timestamp) */
  endTime: string | undefined;
  /** Targeting criteria for A/B testing */
  targeting: TrafficTargeting | undefined;
}

export interface TrafficTargeting {
  tenantIds: string[] | undefined;
  userSegments: string[] | undefined;
  regions: string[] | undefined;
  modelTiers: string[] | undefined;
}

export interface PromptBundleRegistrationInput {
  name: string;
  /** §16.2: Incrementing integer version for deterministic ordering, or semver string for backward compat */
  version: number | string;
  /** Display version in semver format (for human readability only) */
  displayVersion: string;
  domain: string;
  taskType: string;
  packId: string | undefined;
  systemPrompt: PromptBundleSegment;
  userPrompt: PromptBundleSegment | undefined;
  fewShotExamples: FewShotExample[] | undefined;
  constraints: PromptBundleConstraints | undefined;
  /** §16.4: Compatibility matrix - must cover Tool/Evaluator/DomainDescriptor/Model routing */
  compatibilityMatrix: PromptBundleCompatibilityMatrix;
  metadata: PromptBundleMetadata | undefined;
}

export interface PromptBundleVersion {
  /** §16.2: Incrementing integer version for deterministic ordering */
  version: number;
  /** Display version in semver format (for human readability only) */
  displayVersion: string;
  isCurrent: boolean;
  isDefault: boolean;
  trafficWeight: number;
  createdAt: string;
  deprecated: boolean;
  /** R2-8: Full lifecycle status for prompt lifecycle management */
  lifecycleStatus: PromptLifecycleStatus;
}

export interface PromptBundleListResult {
  bundle: PromptBundle;
  availableVersions: PromptBundleVersion[];
  currentVersion: string;
}

export interface CreatePromptBundleInput extends PromptBundleRegistrationInput {
  bundleId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function createPromptBundle(input: CreatePromptBundleInput): PromptBundle {
  validatePromptBundleRegistrationInput(input);
  const normalizedVersion = normalizeVersion(input.version);

  const createdAt = input.createdAt ?? nowIso();
  const metadata = normalizeMetadata(input.metadata);
  const bundle: PromptBundle = {
    bundleId: input.bundleId ?? newId("promptbundle"),
    name: input.name,
    version: normalizedVersion,
    displayVersion: input.displayVersion,
    domain: input.domain,
    taskType: input.taskType,
    packId: input.packId,
    systemPrompt: cloneSegment(input.systemPrompt),
    userPrompt: input.userPrompt ? cloneSegment(input.userPrompt) : undefined,
    fewShotExamples: (input.fewShotExamples ?? []).map(cloneFewShotExample),
    constraints: normalizeConstraints(input.constraints),
    compatibilityMatrix: normalizeCompatibilityMatrix(input.compatibilityMatrix),
    metadata,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  };

  return validatePromptBundle(bundle);
}

export function validatePromptBundleRegistrationInput(input: PromptBundleRegistrationInput): PromptBundleRegistrationInput {
  assertNonEmpty(input.name, "prompt_bundle.invalid_name", "Bundle name must be non-empty.");
  // Note: version validation is done in normalizeVersion() within createPromptBundle()
  assertNonEmpty(input.displayVersion, "prompt_bundle.invalid_display_version", "Bundle displayVersion must be non-empty.");
  assertNonEmpty(input.domain, "prompt_bundle.invalid_domain", "Bundle domain must be non-empty.");
  assertNonEmpty(input.taskType, "prompt_bundle.invalid_task_type", "Bundle taskType must be non-empty.");
  validateSegment(input.systemPrompt, "systemPrompt");
  if (input.userPrompt) {
    validateSegment(input.userPrompt, "userPrompt");
  }
  validateCompatibilityMatrixShape(input.compatibilityMatrix);
  return input;
}

export function validatePromptBundle(bundle: PromptBundle): PromptBundle {
  assertNonEmpty(bundle.bundleId, "prompt_bundle.invalid_bundle_id", "Bundle id must be non-empty.");
  validatePromptBundleRegistrationInput(bundle);
  validateTrafficAllocation(bundle.metadata.trafficAllocation);
  if (bundle.metadata.deprecated === true && bundle.metadata.lifecycleStatus === "active") {
    throw new ValidationError(
      "prompt_bundle.invalid_lifecycle_status",
      "Deprecated bundles cannot retain lifecycleStatus active.",
    );
  }
  return bundle;
}

function normalizeConstraints(input?: PromptBundleConstraints): PromptBundleConstraints {
  return {
    maxTokens: input?.maxTokens,
    temperature: input?.temperature,
    topP: input?.topP,
    stopSequences: input?.stopSequences ? [...input.stopSequences] : undefined,
    responseFormat: input?.responseFormat,
    customConstraints: { ...(input?.customConstraints ?? {}) },
  };
}

function normalizeMetadata(input?: PromptBundleMetadata): PromptBundleMetadata {
  const deprecated = input?.deprecated ?? false;
  return {
    owner: input?.owner?.trim() ? input.owner : "system",
    deprecated,
    lifecycleStatus: input?.lifecycleStatus ?? (deprecated ? "deprecated" : "active"),
    tags: [...(input?.tags ?? [])],
    compatibilityTags: [...(input?.compatibilityTags ?? [])],
    trafficAllocation: normalizeTrafficAllocation(input?.trafficAllocation),
  };
}

function normalizeTrafficAllocation(input?: PromptBundleTrafficAllocation): PromptBundleTrafficAllocation {
  return {
    weight: input?.weight ?? 100,
    startTime: input?.startTime,
    endTime: input?.endTime,
    targeting: input?.targeting
      ? {
          tenantIds: input.targeting.tenantIds ? [...input.targeting.tenantIds] : undefined,
          userSegments: input.targeting.userSegments ? [...input.targeting.userSegments] : undefined,
          regions: input.targeting.regions ? [...input.targeting.regions] : undefined,
          modelTiers: input.targeting.modelTiers ? [...input.targeting.modelTiers] : undefined,
        }
      : undefined,
  };
}

function emptyCompatibilityMatrix(): PromptBundleCompatibilityMatrix {
  return {
    toolSchemaVersions: [],
    evaluatorSchemaVersions: [],
    domainDescriptorVersions: [],
    modelRoutingProfiles: [],
  };
}

function normalizeCompatibilityMatrix(input?: PromptBundleCompatibilityMatrix): PromptBundleCompatibilityMatrix {
  if (input == null) {
    return emptyCompatibilityMatrix();
  }
  validateCompatibilityMatrixShape(input);
  return {
    toolSchemaVersions: input.toolSchemaVersions.map((item) => ({ ...item })),
    evaluatorSchemaVersions: input.evaluatorSchemaVersions.map((item) => ({ ...item })),
    domainDescriptorVersions: input.domainDescriptorVersions.map((item) => ({ ...item })),
    modelRoutingProfiles: input.modelRoutingProfiles.map((item) => ({ ...item })),
  };
}

function validateCompatibilityMatrixShape(input?: PromptBundleCompatibilityMatrix): void {
  if (input == null) {
    return;
  }
  if (
    !Array.isArray(input.toolSchemaVersions) ||
    !Array.isArray(input.evaluatorSchemaVersions) ||
    !Array.isArray(input.domainDescriptorVersions) ||
    !Array.isArray(input.modelRoutingProfiles)
  ) {
    throw new ValidationError(
      "prompt_bundle.invalid_compatibility_matrix",
      "Prompt bundle compatibilityMatrix must define all compatibility arrays.",
    );
  }
}

function validateTrafficAllocation(allocation: PromptBundleTrafficAllocation): void {
  if (!Number.isFinite(allocation.weight) || allocation.weight < 0 || allocation.weight > 100) {
    throw new ValidationError(
      "prompt_bundle.invalid_traffic_weight",
      "Prompt bundle traffic allocation weight must be between 0 and 100.",
    );
  }
}

function validateSegment(segment: PromptBundleSegment, field: string): void {
  assertNonEmpty(
    segment.content,
    `prompt_bundle.invalid_${field}`,
    `Prompt bundle ${field} content must be non-empty.`,
  );
}

function cloneSegment(segment: PromptBundleSegment): PromptBundleSegment {
  return {
    content: segment.content,
    templateVariables: [...segment.templateVariables],
    channel: segment.channel,
  };
}

function cloneFewShotExample(example: FewShotExample): FewShotExample {
  return {
    exampleId: example.exampleId,
    input: example.input,
    output: example.output,
    explanation: example.explanation,
    tags: [...example.tags],
  };
}

function assertNonEmpty(value: string, code: string, message: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(code, message);
  }
}

/**
 * Normalizes version to a positive integer.
 * Accepts semver strings (v1, v1.0, v1.0.0, 1, 1.0, 1.0.0) and converts them to integer representation.
 * Also accepts direct integer values.
 */
function normalizeVersion(version: number | string): number {
  if (typeof version === "number") {
    if (!Number.isInteger(version) || version <= 0) {
      throw new ValidationError("prompt_bundle.invalid_version", "Prompt bundle version must be a positive integer.");
    }
    return version;
  }
  // Handle string version (semver format) - v1 or v1.0 or v1.0.0
  const fullSemverMatch = version.match(/^v?(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (fullSemverMatch) {
    const major = parseInt(fullSemverMatch[1]!, 10);
    const minor = parseInt(fullSemverMatch[2]!, 10);
    const patch = fullSemverMatch[3] !== undefined ? parseInt(fullSemverMatch[3]!, 10) : 0;
    // Combine major.minor.patch into a single integer (e.g., v1.2.3 -> 123)
    return major * 100 + minor * 10 + patch;
  }
  // Handle simple version format: v1 or 1 (major only, minor=0, patch=0)
  const simpleMatch = version.match(/^v?(\d+)$/);
  if (simpleMatch) {
    const major = parseInt(simpleMatch[1]!, 10);
    // Treat as major.0.0 -> 0*100 + 0*10 + major = major (but for deterministic ordering use 10*majors)
    return major * 10;  // v1 -> 10, v2 -> 20, etc.
  }
  // Fallback: try direct numeric conversion
  const parsed = parseInt(version, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new ValidationError("prompt_bundle.invalid_version", `Prompt bundle version must be a positive integer, got: ${version}`);
  }
  return parsed;
}

function assertPositiveIntegerVersion(value: number | string, code: string): void {
  // Normalize string version to number before validation
  const normalized = normalizeVersion(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new ValidationError(code, "Prompt bundle version must be a positive integer.");
  }
}
