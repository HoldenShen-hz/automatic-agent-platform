import { createHash } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";

export type PromptTemplateChannel = "system" | "developer" | "user";

export interface PromptTemplateVariableSpec {
  key: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

export interface PromptTemplateRecord {
  templateKey: string;
  version: string;
  owner: string;
  channel: PromptTemplateChannel;
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
  version: string;
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
    const version = normalizeRequired(input.version, "version");
    const owner = normalizeRequired(input.owner, "owner");
    const fixedPrefix = normalizeRequired(input.fixedPrefix, "fixedPrefix");
    const domainBlock = normalizeRequired(input.domainBlock, "domainBlock");
    const variableSuffixTemplate = input.variableSuffixTemplate?.trim() ?? "";
    const variableSpecs = dedupeVariableSpecs(input.variableSpecs ?? []);
    const compatibilityTags = dedupeStrings(input.compatibilityTags ?? []);
    const now = nowIso();

    const templateVersions = this.templates.get(templateKey) ?? new Map<string, PromptTemplateRecord>();
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
      fixedPrefix,
      domainBlock,
      variableSuffixTemplate,
      variableSpecs,
      compatibilityTags,
      fixedPrefixHash: hashPromptPrefix(fixedPrefix),
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
    return [...(this.templates.get(templateKey)?.values() ?? [])].sort((left, right) => left.version.localeCompare(right.version));
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
