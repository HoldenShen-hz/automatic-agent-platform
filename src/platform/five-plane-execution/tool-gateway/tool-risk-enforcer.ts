import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isPlainObject,
  parseLimitedYaml,
  toObjectArray,
  toStringArray,
} from "../../../domains/governance/division-loader-support.js";

export type ToolRiskClass = "R0" | "R1" | "R2" | "R3" | "R4" | "R5";

export interface ToolActionDescriptor {
  readonly toolId: string;
  readonly actionId: string;
  readonly riskClass: ToolRiskClass;
  readonly sideEffect: string;
  readonly reversible: boolean;
  readonly requiresHITL: boolean;
  readonly requiresPreparedAction: boolean;
  readonly rollbackPolicyRef: string | null;
  readonly dataClassesTouched: readonly string[];
  readonly allowedFamilies: readonly string[];
  readonly trustedSourcesOnly: boolean;
}

export interface ToolRiskAssessmentInput {
  readonly toolName: string;
  readonly actionId?: string | null;
  readonly familyId?: string | null;
  readonly preparedActionApproved?: boolean;
  readonly hitlApproved?: boolean;
  readonly requestSource?: "trusted" | "untrusted" | (string & {});
}

export interface ToolRiskDecision {
  readonly allow: boolean;
  readonly code: string;
  readonly reason: string;
  readonly riskClass: ToolRiskClass | null;
  readonly descriptor: ToolActionDescriptor | null;
}

export interface ToolRiskEnforcerOptions {
  readonly platformRoot?: string;
  readonly descriptorRoot?: string;
  readonly yamlReader?: (path: string) => string;
}

function resolvePlatformRoot(platformRoot?: string): string {
  return platformRoot ?? process.env.AA_PLATFORM_ROOT ?? process.cwd();
}

export class ToolRiskEnforcer {
  private readonly descriptorRoot: string;
  private readonly yamlReader: (path: string) => string;

  public constructor(options: ToolRiskEnforcerOptions = {}) {
    const platformRoot = resolvePlatformRoot(options.platformRoot);
    this.descriptorRoot = options.descriptorRoot ?? join(platformRoot, "config", "tool-risk", "tool-action-descriptors");
    this.yamlReader = options.yamlReader ?? ((path) => readFileSync(path, "utf8"));
  }

  public listDescriptors(): ToolActionDescriptor[] {
    if (!existsSync(this.descriptorRoot)) {
      return [];
    }
    return readdirSync(this.descriptorRoot)
      .filter((entry) => entry.endsWith(".yaml"))
      .flatMap((entry) => this.readDescriptorFile(join(this.descriptorRoot, entry)));
  }

  public findDescriptor(toolName: string, actionId: string): ToolActionDescriptor | null {
    return this.listDescriptors().find((entry) => entry.toolId === toolName && entry.actionId === actionId) ?? null;
  }

  public evaluate(input: ToolRiskAssessmentInput): ToolRiskDecision {
    const actionId = input.actionId?.trim() ?? null;
    if (actionId == null) {
      return {
        allow: true,
        code: "tool_risk.not_applicable",
        reason: "action id missing; tool-risk enforcement skipped",
        riskClass: null,
        descriptor: null,
      };
    }
    const descriptor = this.findDescriptor(input.toolName, actionId);
    if (descriptor == null) {
      return {
        allow: false,
        code: "tool_risk.descriptor_missing",
        reason: `Missing ToolActionDescriptor for ${input.toolName}:${actionId}`,
        riskClass: null,
        descriptor: null,
      };
    }
    if (
      descriptor.allowedFamilies.length > 0
      && input.familyId != null
      && !descriptor.allowedFamilies.includes(input.familyId)
    ) {
      return {
        allow: false,
        code: "tool_risk.family_not_allowed",
        reason: `Family ${input.familyId} cannot invoke ${descriptor.toolId}:${descriptor.actionId}`,
        riskClass: descriptor.riskClass,
        descriptor,
      };
    }
    if (descriptor.trustedSourcesOnly && input.requestSource === "untrusted") {
      return {
        allow: false,
        code: "tool_risk.untrusted_source_denied",
        reason: `${descriptor.toolId}:${descriptor.actionId} requires trusted source material`,
        riskClass: descriptor.riskClass,
        descriptor,
      };
    }
    if (descriptor.riskClass === "R5" && input.hitlApproved !== true && input.preparedActionApproved !== true) {
      return {
        allow: false,
        code: "tool_risk.r5_autonomous_denied",
        reason: `${descriptor.toolId}:${descriptor.actionId} is R5 and cannot execute autonomously`,
        riskClass: descriptor.riskClass,
        descriptor,
      };
    }
    if (
      ["R3", "R4"].includes(descriptor.riskClass)
      && descriptor.requiresHITL
      && descriptor.requiresPreparedAction
      && input.hitlApproved !== true
      && input.preparedActionApproved !== true
    ) {
      return {
        allow: false,
        code: "tool_risk.hitl_or_prepared_action_required",
        reason: `${descriptor.toolId}:${descriptor.actionId} requires HITL or prepared action approval`,
        riskClass: descriptor.riskClass,
        descriptor,
      };
    }
    if (
      ["R3", "R4", "R5"].includes(descriptor.riskClass)
      && descriptor.requiresHITL
      && !descriptor.requiresPreparedAction
      && input.hitlApproved !== true
    ) {
      return {
        allow: false,
        code: "tool_risk.hitl_required",
        reason: `${descriptor.toolId}:${descriptor.actionId} requires HITL approval`,
        riskClass: descriptor.riskClass,
        descriptor,
      };
    }
    if (
      ["R3", "R4", "R5"].includes(descriptor.riskClass)
      && !descriptor.requiresHITL
      && descriptor.requiresPreparedAction
      && input.preparedActionApproved !== true
    ) {
      return {
        allow: false,
        code: "tool_risk.prepared_action_required",
        reason: `${descriptor.toolId}:${descriptor.actionId} requires prepared action approval`,
        riskClass: descriptor.riskClass,
        descriptor,
      };
    }
    return {
      allow: true,
      code: "tool_risk.allowed",
      reason: `${descriptor.toolId}:${descriptor.actionId} allowed`,
      riskClass: descriptor.riskClass,
      descriptor,
    };
  }

  private readDescriptorFile(path: string): ToolActionDescriptor[] {
    const parsed = parseLimitedYaml(this.yamlReader(path), path);
    const object = isPlainObject(parsed) ? parsed : {};
    const toolId = typeof object.toolId === "string" ? object.toolId : path.split("/").pop()?.replace(/\.yaml$/, "") ?? "unknown-tool";
    return toObjectArray(object.actions).map((entry) => ({
      toolId,
      actionId: typeof entry.actionId === "string" ? entry.actionId : "unknown-action",
      riskClass: this.normalizeRiskClass(entry.riskClass),
      sideEffect: typeof entry.sideEffect === "string" ? entry.sideEffect : "none",
      reversible: entry.reversible !== false,
      requiresHITL: entry.requiresHITL === true,
      requiresPreparedAction: entry.requiresPreparedAction === true,
      rollbackPolicyRef: typeof entry.rollbackPolicyRef === "string" ? entry.rollbackPolicyRef : null,
      dataClassesTouched: toStringArray(entry.dataClassesTouched),
      allowedFamilies: toStringArray(entry.allowedFamilies),
      trustedSourcesOnly: entry.trustedSourcesOnly === true,
    }));
  }

  private normalizeRiskClass(value: unknown): ToolRiskClass {
    switch (value) {
      case "R0":
      case "R1":
      case "R2":
      case "R3":
      case "R4":
      case "R5":
        return value;
      default:
        return "R0";
    }
  }
}
