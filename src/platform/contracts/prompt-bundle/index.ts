/**
 * PromptBundle Contract
 *
 * Defines the PromptBundle type as specified in architecture document §16.
 * A PromptBundle is a composition of system prompt + user prompt + few-shot examples + constraints.
 *
 * §16.2: version is an incrementing integer (not semver) for deterministic ordering.
 * Use semver format only in display/metadata, not for version comparison.
 */

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
  /** §16.2: Incrementing integer version for deterministic ordering */
  version: number;
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
}

export interface PromptBundleListResult {
  bundle: PromptBundle;
  availableVersions: PromptBundleVersion[];
  currentVersion: string;
}
