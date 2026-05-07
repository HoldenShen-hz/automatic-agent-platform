import { createHash } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";

/**
 * R10-43 FIX: LLM message channel for prompt assembly.
 * Used when constructing messages to send to the LLM API.
 * Distinct from role (pipeline coordination).
 */
export type PromptTemplateChannel = "system" | "developer" | "user";

/**
 * R10-43 FIX: Pipeline coordination role per §16.2 semantics.
 * Distinct from channel - role is for Harness pipeline coordination
 * (planner/generator/evaluator/system), while channel is for LLM message routing.
 */
export type PromptTemplateRole = "planner" | "generator" | "evaluator" | "system";

/**
 * R10-43 FIX: Mapping between Harness pipeline role and LLM message channel.
 * §16.2 role (planner/generator/evaluator/system) maps to channel (developer/user/system).
 * This ensures the registry uses Harness pipeline roles internally while
 * emitting correct LLM message channels in prompt assembly.
 */
export const ROLE_TO_MESSAGE_CHANNEL: Record<PromptTemplateRole, PromptTemplateChannel> = {
  planner: "developer",    // Planner provides guidance - developer channel
  generator: "user",       // Generator acts on behalf of user - user channel
  evaluator: "developer",  // Evaluator analyzes - developer channel
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
  /**
   * R10-43 FIX: Pipeline coordination role per §16.2 semantics.
   * This is distinct from channel - role is for Harness pipeline coordination
   * (planner/generator/evaluator/system), while channel is for LLM message routing.
   */
  role: PromptTemplateRole;
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
  /**
   * R10-43 FIX: Pipeline coordination role per §16.2 semantics.
   * Defaults to "planner" if not specified.
   */
  role?: PromptTemplateRole;
  channel?: PromptTemplateChannel;
  fixedPrefix: string;
  domainBlock: string;
  variableSuffixTemplate?: string;
  variableSpecs?: PromptTemplateVariableSpec[];
  compatibilityTags?: string[];
}

export interface VariableBindings {
  [variableKey: string]: string;
}

/**
 * R10-33 FIX: Tool compatibility constraints for a role.
 * §16.4 requires PromptBundleCompatibilityMatrix validation.
 * R10-43 FIX: Relates to role (pipeline coordination), not channel (LLM message).
 */
export interface ToolCompatibility {
  allowedTools: string[];
  disallowedTools: string[];
}

/**
 * R10-33 FIX: Evaluator compatibility constraints for a role.
 * §16.4 requires PromptBundleCompatibilityMatrix validation.
 * R10-43 FIX: Relates to role (pipeline coordination), not channel (LLM message).
 */
export interface EvaluatorCompatibility {
  allowedEvaluators: string[];
  disallowedEvaluators: string[];
}

/**
 * R10-33 FIX: DomainDescriptor compatibility constraints for a role.
 * §16.4 requires PromptBundleCompatibilityMatrix validation.
 * R10-43 FIX: Relates to role (pipeline coordination), not channel (LLM message).
 */
export interface DomainDescriptorCompatibility {
  allowedDomains: string[];
  disallowedDomains: string[];
}

/**
 * R10-33 FIX: Model compatibility constraints for a role.
 * §16.4 requires PromptBundleCompatibilityMatrix validation.
 * R10-43 FIX: Relates to role (pipeline coordination), not channel (LLM message).
 */
export interface ModelCompatibility {
  allowedModels: string[];
  disallowedModels: string[];
}

/**
 * R10-33 FIX: Compatibility entry for a specific role in the matrix.
 * §16.4 requires PromptBundleCompatibilityMatrix validation.
 * R10-43 FIX: Uses role (pipeline coordination) not channel (LLM message).
 */
export interface PromptBundleCompatibilityEntry {
  role: PromptTemplateRole;
  toolCompatibility: ToolCompatibility;
  evaluatorCompatibility: EvaluatorCompatibility;
  domainCompatibility: DomainDescriptorCompatibility;
  modelCompatibility: ModelCompatibility;
}

/**
 * R10-33 FIX: PromptBundleCompatibilityMatrix per §16.4.
 * Defines valid combinations of Tool/Evaluator/DomainDescriptor/Model compatibility per role.
 * R10-43 FIX: Uses role (pipeline coordination) not channel (LLM message).
 */
export type PromptBundleCompatibilityMatrix = PromptBundleCompatibilityEntry[];

/**
 * R10-33 FIX: Default compatibility matrix per §16.4.
 * Defines valid Tool, Evaluator, DomainDescriptor, and Model combinations for each role.
 * Bundles with combinations not in this matrix will be rejected during registration.
 * R10-43 FIX: Uses role (pipeline coordination) not channel (LLM message).
 */
export const DEFAULT_PROMPT_BUNDLE_COMPATIBILITY_MATRIX: PromptBundleCompatibilityMatrix = [
  {
    role: "planner",
    toolCompatibility: {
      allowedTools: ["planner-tools"],
      disallowedTools: ["deprecated-planner-tool"],
    },
    evaluatorCompatibility: {
      allowedEvaluators: ["planner-evaluator"],
      disallowedEvaluators: [],
    },
    domainCompatibility: {
      allowedDomains: ["execution-domain", "orchestration-domain"],
      disallowedDomains: ["legacy-domain"],
    },
    modelCompatibility: {
      allowedModels: ["claude-sonnet-4-20250514", "claude-opus-4-20250514"],
      disallowedModels: [],
    },
  },
  {
    role: "generator",
    toolCompatibility: {
      allowedTools: ["generator-tools", "content-tools"],
      disallowedTools: [],
    },
    evaluatorCompatibility: {
      allowedEvaluators: ["generator-evaluator"],
      disallowedEvaluators: [],
    },
    domainCompatibility: {
      allowedDomains: ["execution-domain", "content-domain"],
      disallowedDomains: ["legacy-domain"],
    },
    modelCompatibility: {
      allowedModels: ["claude-sonnet-4-20250514", "claude-opus-4-20250514"],
      disallowedModels: [],
    },
  },
  {
    role: "evaluator",
    toolCompatibility: {
      allowedTools: ["evaluator-tools"],
      disallowedTools: [],
    },
    evaluatorCompatibility: {
      allowedEvaluators: ["quality-evaluator", "safety-evaluator"],
      disallowedEvaluators: [],
    },
    domainCompatibility: {
      allowedDomains: ["execution-domain", "quality-domain"],
      disallowedDomains: [],
    },
    modelCompatibility: {
      allowedModels: ["claude-sonnet-4-20250514"],
      disallowedModels: [],
    },
  },
  {
    role: "system",
    toolCompatibility: {
      allowedTools: [],
      disallowedTools: [],
    },
    evaluatorCompatibility: {
      allowedEvaluators: [],
      disallowedEvaluators: [],
    },
    domainCompatibility: {
      allowedDomains: ["system-domain"],
      disallowedDomains: [],
    },
    modelCompatibility: {
      allowedModels: [],
      disallowedModels: [],
    },
  },
];

export class PromptTemplateRegistryService {
  private readonly templates = new Map<string, Map<string, PromptTemplateRecord>>();

  /**
   * R10-33 FIX: Validates a bundle against the PromptBundleCompatibilityMatrix.
   * R10-43 FIX: Uses role (pipeline coordination) not channel (LLM message).
   * @param role The role to validate compatibility for
   * @param compatibilityTags The compatibility tags to validate
   * @param matrix The compatibility matrix to validate against (defaults to DEFAULT_PROMPT_BUNDLE_COMPATIBILITY_MATRIX)
   * @throws ValidationError if the bundle has invalid combinations
   */
  public validateBundleCompatibility(
    role: PromptTemplateRole,
    compatibilityTags: readonly string[],
    matrix: PromptBundleCompatibilityMatrix = DEFAULT_PROMPT_BUNDLE_COMPATIBILITY_MATRIX,
  ): void {
    const entry = matrix.find((e) => e.role === role);
    if (!entry) {
      throw new ValidationError(
        `prompt_template.unknown_role:${role}`,
        `Unknown role "${role}" in compatibility matrix.`,
      );
    }

    // Check disallowed tools
    for (const tag of compatibilityTags) {
      if (entry.toolCompatibility.disallowedTools.includes(tag)) {
        throw new ValidationError(
          `prompt_template.incompatible_tool:${tag}`,
          `Tool "${tag}" is disallowed for role "${role}".`,
        );
      }
    }

    // Check disallowed evaluators
    for (const tag of compatibilityTags) {
      if (entry.evaluatorCompatibility.disallowedEvaluators.includes(tag)) {
        throw new ValidationError(
          `prompt_template.incompatible_evaluator:${tag}`,
          `Evaluator "${tag}" is disallowed for role "${role}".`,
        );
      }
    }

    // Check disallowed domains
    for (const tag of compatibilityTags) {
      if (entry.domainCompatibility.disallowedDomains.includes(tag)) {
        throw new ValidationError(
          `prompt_template.incompatible_domain:${tag}`,
          `Domain "${tag}" is disallowed for role "${role}".`,
        );
      }
    }

    // Check disallowed models
    for (const tag of compatibilityTags) {
      if (entry.modelCompatibility.disallowedModels.includes(tag)) {
        throw new ValidationError(
          `prompt_template.incompatible_model:${tag}`,
          `Model "${tag}" is disallowed for role "${role}".`,
        );
      }
    }

    // Check allowed tools (if any are specified, at least one must match)
    if (entry.toolCompatibility.allowedTools.length > 0) {
      const hasAllowedTool = compatibilityTags.some((tag) => entry.toolCompatibility.allowedTools.includes(tag));
      if (!hasAllowedTool) {
        throw new ValidationError(
          `prompt_template.no_allowed_tool:${role}`,
          `Role "${role}" requires at least one allowed tool from: ${entry.toolCompatibility.allowedTools.join(", ")}.`,
        );
      }
    }

    // Check allowed evaluators (if any are specified, at least one must match)
    if (entry.evaluatorCompatibility.allowedEvaluators.length > 0) {
      const hasAllowedEvaluator = compatibilityTags.some((tag) =>
        entry.evaluatorCompatibility.allowedEvaluators.includes(tag),
      );
      if (!hasAllowedEvaluator) {
        throw new ValidationError(
          `prompt_template.no_allowed_evaluator:${role}`,
          `Role "${role}" requires at least one allowed evaluator from: ${entry.evaluatorCompatibility.allowedEvaluators.join(", ")}.`,
        );
      }
    }

    // Check allowed domains (if any are specified, at least one must match)
    if (entry.domainCompatibility.allowedDomains.length > 0) {
      const hasAllowedDomain = compatibilityTags.some((tag) =>
        entry.domainCompatibility.allowedDomains.includes(tag),
      );
      if (!hasAllowedDomain) {
        throw new ValidationError(
          `prompt_template.no_allowed_domain:${role}`,
          `Role "${role}" requires at least one allowed domain from: ${entry.domainCompatibility.allowedDomains.join(", ")}.`,
        );
      }
    }

    // Check allowed models (if any are specified, at least one must match)
    if (entry.modelCompatibility.allowedModels.length > 0) {
      const hasAllowedModel = compatibilityTags.some((tag) => entry.modelCompatibility.allowedModels.includes(tag));
      if (!hasAllowedModel) {
        throw new ValidationError(
          `prompt_template.no_allowed_model:${role}`,
          `Role "${role}" requires at least one allowed model from: ${entry.modelCompatibility.allowedModels.join(", ")}.`,
        );
      }
    }
  }

  /**
   * R10-32 FIX: Validates that all required variables are bound and no unknown variables are provided.
   * @param template The prompt template record
   * @param bindings The variable bindings to validate
   * @throws ValidationError if validation fails
   */
  public validateVariableBindings(template: PromptTemplateRecord, bindings: VariableBindings): void {
    const boundKeys = new Set(Object.keys(bindings));

    // Check for unknown variables in bindings
    for (const key of boundKeys) {
      const spec = template.variableSpecs.find((s) => s.key === key);
      if (!spec) {
        throw new ValidationError(
          `prompt_template.unknown_variable:${key}`,
          `Unknown variable "${key}" provided for template ${template.templateKey}@${template.version}. Expected one of: ${template.variableSpecs.map((s) => s.key).join(", ") || "none"}.`,
        );
      }
    }

    // Check that all required variables are bound
    for (const spec of template.variableSpecs) {
      if (spec.required && !boundKeys.has(spec.key) && spec.defaultValue === undefined) {
        throw new ValidationError(
          `prompt_template.missing_required_variable:${spec.key}`,
          `Required variable "${spec.key}" is not bound for template ${template.templateKey}@${template.version} and has no default value.`,
        );
      }
    }
  }

  /**
   * R10-32 FIX: Renders the variableSuffixTemplate by replacing {{variable}} patterns with bound values.
   * @param template The prompt template record
   * @param bindings The variable bindings
   * @returns The rendered variable suffix string
   */
  public renderVariableTemplate(template: PromptTemplateRecord, bindings: VariableBindings): string {
    if (!template.variableSuffixTemplate) {
      return "";
    }

    // Validate bindings first
    this.validateVariableBindings(template, bindings);

    let rendered = template.variableSuffixTemplate;

    // Replace {{variable}} patterns with bound values
    for (const spec of template.variableSpecs) {
      const placeholder = `{{${spec.key}}}`;
      const value = bindings[spec.key] ?? spec.defaultValue ?? "";
      rendered = rendered.split(placeholder).join(value);
    }

    return rendered;
  }

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
    const channel = input.channel ?? "system";
    // R10-43 FIX: role defaults to "planner" per §16.2 pipeline coordination semantics
    const role: PromptTemplateRole = input.role ?? "planner";
    const now = nowIso();

    // R10-33 FIX: Validate bundle compatibility against the matrix before registration
    // R10-43 FIX: Validate role (pipeline coordination) not channel (LLM message)
    this.validateBundleCompatibility(role, compatibilityTags);

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
      role,
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
