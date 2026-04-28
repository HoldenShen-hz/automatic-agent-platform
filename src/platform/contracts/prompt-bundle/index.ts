/**
 * PromptBundle Contract
 *
 * Defines the PromptBundle type as specified in architecture document §16.
 * A PromptBundle is a composition of system prompt + user prompt + few-shot examples + constraints.
 */

export interface PromptBundle {
  bundleId: string;
  name: string;
  version: string;
  domain: string;
  taskType: string;
  packId: string | undefined;
  systemPrompt: PromptBundleSegment;
  userPrompt: PromptBundleSegment | undefined;
  fewShotExamples: FewShotExample[];
  constraints: PromptBundleConstraints;
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
  version: string;
  domain: string;
  taskType: string;
  packId: string | undefined;
  systemPrompt: PromptBundleSegment;
  userPrompt: PromptBundleSegment | undefined;
  fewShotExamples: FewShotExample[] | undefined;
  constraints: PromptBundleConstraints | undefined;
  metadata: PromptBundleMetadata | undefined;
}

export interface PromptBundleVersion {
  version: string;
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
