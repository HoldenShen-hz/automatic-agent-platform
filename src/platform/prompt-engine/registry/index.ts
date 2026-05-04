import { createHash } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";

export type PromptTemplateChannel = "planner" | "generator" | "evaluator" | "system";

/**
 * R10-43 FIX: Mapping between Harness pipeline role and LLM message role.
 * §16.2 role (planner/generator/evaluator/system) maps to LLM message role (assistant/system/user).
 * This ensures the registry uses Harness pipeline roles internally while
 * emitting correct LLM message roles in prompt assembly.
 */
export const CHANNEL_TO_MESSAGE_ROLE: Record<PromptTemplateChannel, "system" | "user" | "assistant"> = {
  planner: "assistant",   // Planner generates plans - LLM acts as assistant
  generator: "assistant", // Generator produces content - LLM acts as assistant
  evaluator: "assistant", // Evaluator assesses quality - LLM acts as assistant
  system: "system",       // System provides system-level instructions
};

export interface PromptTemplateVariableSpec {
  key: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

export type PromptTemplateStatus = "draft" | "review" | "staging" | "canary" | "stable" | "deprecated";

export interface PromptTemplateRecord {
  templateKey: string;
  /**
   * Integer version per §16.2 - incrementing positive integer for deterministic ordering.
   * Display version (semver) is stored separately in displayVersion field.
   */
  version: number;
  /**
   * §16.2 lifecycle status per PromptTemplateStatus.
   * Controls promotion workflow: draft → review → staging → canary → stable → deprecated.
   */
  status: PromptTemplateStatus;
  owner: string;
  channel: PromptTemplateChannel;
  /**
   * Human-readable display version in semver format.
   * R10-31 FIX: Separated from internal version (integer) per PromptVersionManager spec.
   */
  displayVersion: string;
  fixedPrefix: string;
  domainBlock: string;
  variableSuffixTemplate: string;
  variableSpecs: PromptTemplateVariableSpec[];
  compatibilityTags: string[];
  fixedPrefixHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplateRegistrationInput {
  templateKey: string;
  /**
   * Integer version per §16.2 - incrementing positive integer for deterministic ordering.
   */
  version: number;
  /**
   * Human-readable display version in semver format.
   * R10-31 FIX: Separated from internal version (integer) per PromptVersionManager spec.
   */
  displayVersion?: string;
  status?: PromptTemplateStatus;
  owner: string;
  channel?: PromptTemplateChannel;
  fixedPrefix: string;
  domainBlock: string;
  variableSuffixTemplate?: string;
  variableSpecs?: PromptTemplateVariableSpec[];
  compatibilityTags?: string[];
}

export class PromptTemplateRegistryService {
  private readonly templates = new Map<string, Map<string, PromptTemplateRecord>>();

  public registerTemplate(input: PromptTemplateRegistrationInput): PromptTemplateRecord {
    const templateKey = normalizeRequired(input.templateKey, "templateKey");
    // R10-31 FIX: version must be positive integer per §16.2
    const version = normalizeVersion(input.version, "version");
    const owner = normalizeRequired(input.owner, "owner");
    const fixedPrefix = normalizeRequired(input.fixedPrefix, "fixedPrefix");
    const domainBlock = normalizeRequired(input.domainBlock, "domainBlock");
    const variableSuffixTemplate = input.variableSuffixTemplate?.trim() ?? "";
    const variableSpecs = dedupeVariableSpecs(input.variableSpecs ?? []);
    const compatibilityTags = dedupeStrings(input.compatibilityTags ?? []);
    const now = nowIso();

    // R10-31 FIX: displayVersion is separate from internal version (integer)
    // Default to "v{major}.0.0" format derived from integer version
    const displayVersion = input.displayVersion ?? `v${version}.0.0`;

    const templateVersions = this.templates.get(templateKey) ?? new Map<string, PromptTemplateRecord>();
    if (templateVersions.has(String(version))) {
      throw new ValidationError(
        `prompt_template.version_conflict:${templateKey}:${version}`,
        `Prompt template ${templateKey}@${version} is already registered.`,
      );
    }

    const record: PromptTemplateRecord = {
      templateKey,
      version,
      displayVersion,
      status: input.status ?? "draft",
      owner,
      channel: input.channel ?? "system",
      fixedPrefix,
      domainBlock,
      variableSuffixTemplate,
      variableSpecs,
      compatibilityTags,
      fixedPrefixHash: hashPromptPrefix(fixedPrefix),
      createdAt: now,
      updatedAt: now,
    };
    templateVersions.set(String(version), record);
    this.templates.set(templateKey, templateVersions);
    return record;
  }

  public getTemplate(templateKey: string, version: number): PromptTemplateRecord | null {
    return this.templates.get(templateKey)?.get(String(version)) ?? null;
  }

  public listVersions(templateKey: string): PromptTemplateRecord[] {
    // R10-31 FIX: Sort by integer version (numeric), not string comparison
    return [...(this.templates.get(templateKey)?.values() ?? [])].sort((left, right) => left.version - right.version);
  }

  public listTemplates(): PromptTemplateRecord[] {
    return [...this.templates.values()].flatMap((versions) => [...versions.values()]);
  }
}

export function hashPromptPrefix(fixedPrefix: string): string {
  return createHash("sha256").update(fixedPrefix).digest("hex").slice(0, 16);
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ValidationError(`prompt_template.invalid_${field}`, `Prompt template field ${field} must be a non-empty string.`);
  }
  return normalized;
}

/**
 * R10-31 FIX: Validates version is a positive integer per §16.2.
 * version must be an incrementing integer for deterministic ordering, not semver string.
 */
function normalizeVersion(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(
      `prompt_template.invalid_${field}`,
      `Prompt template field ${field} must be a positive integer (got ${value}). §16.2 requires integer versioning.`,
    );
  }
  return value;
}

function dedupeVariableSpecs(specs: readonly PromptTemplateVariableSpec[]): PromptTemplateVariableSpec[] {
  const seen = new Set<string>();
  const result: PromptTemplateVariableSpec[] = [];
  for (const spec of specs) {
    const key = normalizeRequired(spec.key, "variable_key");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({
      key,
      required: spec.required,
      ...(spec.description?.trim() ? { description: spec.description.trim() } : {}),
      ...(spec.defaultValue?.trim() ? { defaultValue: spec.defaultValue.trim() } : {}),
    });
  }
  return result;
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

export * from "./hierarchical-registry-service.js";
export * from "./prompt-version-manager.js";
