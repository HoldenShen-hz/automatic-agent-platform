import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
import { sha256HexPrefix } from "../../shared/cache/utils/sha256.js";

export type PromptTemplateChannel = "system" | "developer" | "user";

/**
 * R10-43 fix: Agent roles are distinct from prompt channels.
 * - role: The agent role in the harness loop (planner, generator, evaluator)
 * - channel: The prompt channel type (system, developer, user)
 *
 * These serve different purposes:
 * - role determines which agent component processes the prompt
 * - channel determines how the prompt is formatted/sent to the model
 */
export type PromptTemplateRole = "planner" | "generator" | "evaluator" | "system";

export interface PromptTemplateVariableSpec {
  key: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

/** Lifecycle status for prompt templates per §20.6 */
export type PromptTemplateLifecycleStatus = "draft" | "active" | "deprecated" | "archived";

export interface PromptTemplateRecord {
  templateKey: string;
  version: string;
  owner: string;
  /** R10-43 fix: channel is distinct from role - channel is system|developer|user */
  channel: PromptTemplateChannel;
  /** Role this template is used for in the harness loop */
  role: PromptTemplateRole;
  fixedPrefix: string;
  domainBlock: string;
  variableSuffixTemplate: string;
  variableSpecs: PromptTemplateVariableSpec[];
  compatibilityTags: string[];
  fixedPrefixHash: string;
  /** R10-30 fix: Added lifecycle status field for template management */
  status: PromptTemplateLifecycleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplateRegistrationInput {
  templateKey: string;
  version: string | number;
  owner: string;
  /** R10-43 fix: channel is system|developer|user, distinct from role */
  channel?: PromptTemplateChannel;
  /** Role this template is used for in the harness loop */
  role?: PromptTemplateRole;
  fixedPrefix: string;
  domainBlock: string;
  variableSuffixTemplate?: string;
  variableSpecs?: PromptTemplateVariableSpec[];
  compatibilityTags?: string[];
  /** R10-30 fix: Lifecycle status, defaults to active */
  status?: PromptTemplateLifecycleStatus;
}

export class PromptTemplateRegistryService {
  private readonly templates = new Map<string, Map<string, PromptTemplateRecord>>();

  public registerTemplate(input: PromptTemplateRegistrationInput): PromptTemplateRecord {
    const templateKey = normalizeRequired(input.templateKey, "templateKey");
    const version = normalizeRequired(input.version, "version");
    const owner = normalizeRequired(input.owner, "owner");
    const fixedPrefix = normalizeRequired(input.fixedPrefix, "fixedPrefix");
    const domainBlock = input.domainBlock.trim();
    const variableSuffixTemplate = input.variableSuffixTemplate?.trim() ?? "";
    const variableSpecs = dedupeVariableSpecs(input.variableSpecs ?? []);
    const compatibilityTags = dedupeStrings(input.compatibilityTags ?? []);
    const now = nowIso();

    const templateVersions = new Map(this.templates.get(templateKey) ?? []);
    if (templateVersions.has(version)) {
      throw new ValidationError(
        `prompt_template.version_conflict:${templateKey}:${version}`,
        `Prompt template ${templateKey}@${version} is already registered.`,
      );
    }

    const record: PromptTemplateRecord = {
      templateKey,
      version,
      owner,
      channel: input.channel ?? "system",
      role: input.role ?? "system",
      fixedPrefix,
      domainBlock,
      variableSuffixTemplate,
      variableSpecs,
      compatibilityTags,
      fixedPrefixHash: hashPromptPrefix(fixedPrefix),
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    };
    templateVersions.set(version, record);
    this.templates.set(templateKey, templateVersions);
    return record;
  }

  public getTemplate(templateKey: string, version: string): PromptTemplateRecord | null {
    return this.templates.get(templateKey)?.get(version) ?? null;
  }

  public listVersions(templateKey: string): PromptTemplateRecord[] {
    return [...(this.templates.get(templateKey)?.values() ?? [])].sort((left, right) => comparePromptVersions(left.version, right.version));
  }

  public listTemplates(
    options: {
      offset?: number;
      limit?: number;
    } = {},
  ): PromptTemplateRecord[] {
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    const limit = options.limit == null ? Number.POSITIVE_INFINITY : Math.max(0, Math.trunc(options.limit));
    return [...this.templates.entries()]
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .flatMap(([, versions]) => [...versions.values()].sort((left, right) => comparePromptVersions(left.version, right.version)))
      .slice(offset, offset + limit);
  }
}

export function hashPromptPrefix(fixedPrefix: string): string {
  return sha256HexPrefix(fixedPrefix, 32);
}

function normalizeRequired(value: string | number, field: string): string {
  const normalized = String(value).trim();
  if (normalized.length === 0) {
    throw new ValidationError(`prompt_template.invalid_${field}`, `Prompt template field ${field} must be a non-empty string.`);
  }
  return normalized;
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

function comparePromptVersions(left: string, right: string): number {
  const leftParts = normalizeVersionParts(left);
  const rightParts = normalizeVersionParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }
  return left.localeCompare(right);
}

function normalizeVersionParts(version: string): number[] {
  return version
    .trim()
    .replace(/^[^\d]*/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

export * from "./hierarchical-registry-service.js";
export * from "./prompt-version-manager.js";
