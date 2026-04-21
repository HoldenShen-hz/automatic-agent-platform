import { z } from "zod";

export const DomainInteractionModeSchema = z.enum(["allow", "approval_required", "deny"]);

export const DomainInteractionRuleSchema = z.object({
  sourceDomainId: z.string().min(1),
  targetDomainId: z.string().min(1),
  mode: DomainInteractionModeSchema,
  maxConcurrentWorkflows: z.number().int().positive().default(1),
  compensationRequired: z.boolean().default(false),
});

export type DomainInteractionMode = z.infer<typeof DomainInteractionModeSchema>;
export type DomainInteractionRule = z.infer<typeof DomainInteractionRuleSchema>;

export interface DomainInteractionRequest {
  readonly sourceDomainId: string;
  readonly targetDomainId: string;
  readonly actorId: string;
  readonly workflowId: string;
  readonly concurrentWorkflowCount: number;
}

export interface DomainInteractionDecision {
  readonly allowed: boolean;
  readonly requiresApproval: boolean;
  readonly compensationRequired: boolean;
  readonly reasonCodes: readonly string[];
  readonly applicableRule: DomainInteractionRule | null;
}

export function isCrossDomainInteractionAllowed(
  rules: readonly DomainInteractionRule[],
  sourceDomainId: string,
  targetDomainId: string,
): boolean {
  const match = rules.find((item) => item.sourceDomainId === sourceDomainId && item.targetDomainId === targetDomainId);
  return match?.mode === "allow";
}

export class DomainInteractionPolicyService {
  public evaluate(
    rules: readonly DomainInteractionRule[],
    request: DomainInteractionRequest,
  ): DomainInteractionDecision {
    const rule = rules.find((item) =>
      item.sourceDomainId === request.sourceDomainId && item.targetDomainId === request.targetDomainId,
    ) ?? null;
    if (rule == null) {
      return {
        allowed: false,
        requiresApproval: false,
        compensationRequired: false,
        reasonCodes: ["domain_interaction.rule_not_found"],
        applicableRule: null,
      };
    }
    if (request.concurrentWorkflowCount > rule.maxConcurrentWorkflows) {
      return {
        allowed: false,
        requiresApproval: false,
        compensationRequired: rule.compensationRequired,
        reasonCodes: ["domain_interaction.concurrent_limit_exceeded"],
        applicableRule: rule,
      };
    }
    if (rule.mode === "deny") {
      return {
        allowed: false,
        requiresApproval: false,
        compensationRequired: rule.compensationRequired,
        reasonCodes: ["domain_interaction.denied"],
        applicableRule: rule,
      };
    }
    if (rule.mode === "approval_required") {
      return {
        allowed: false,
        requiresApproval: true,
        compensationRequired: rule.compensationRequired,
        reasonCodes: ["domain_interaction.approval_required"],
        applicableRule: rule,
      };
    }
    return {
      allowed: true,
      requiresApproval: false,
      compensationRequired: rule.compensationRequired,
      reasonCodes: [
        "domain_interaction.allowed",
        ...(rule.compensationRequired ? ["domain_interaction.compensation_required"] : []),
      ],
      applicableRule: rule,
    };
  }
}
