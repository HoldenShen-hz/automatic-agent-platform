export interface ToolbeltAssemblyRequest {
  readonly allowedTools: readonly string[];
  readonly requestedTools: readonly string[];
  readonly requiredEvidence: readonly string[];
  /** Domain constraint policy for tool access */
  readonly domainPolicy?: Readonly<{
    readonly allowlist: readonly string[];
    readonly denylist: readonly string[];
  }>;
  /** Risk score context for dynamic tool restriction */
  readonly riskContext?: Readonly<{
    readonly currentRiskScore: number;
    readonly maxRiskScore: number;
  }>;
  /** Budget context for cost-based tool filtering */
  readonly budgetContext?: Readonly<{
    readonly remainingCost: number;
    readonly toolCostMap?: Readonly<Record<string, number>>;
  }>;
  /** Security policy for high-risk tool handling */
  readonly securityPolicy?: Readonly<{
    readonly requireApprovalFor: readonly string[];
    readonly blockedFor: readonly string[];
  }>;
  /** Reliability scores per tool */
  readonly reliabilityScores?: Readonly<Record<string, number>>;
}

export interface HarnessToolbelt {
  readonly allowedTools: readonly string[];
  readonly grantedTools: readonly string[];
  readonly blockedTools: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly assemblyTrace?: readonly string[];
}

export class ToolbeltAssembler {
  public assemble(request: ToolbeltAssemblyRequest): HarnessToolbelt {
    const assemblyTrace: string[] = [];

    // Step 1: Domain constraint filtering
    let domainAllowed = new Set<string>(request.requestedTools);
    if (request.domainPolicy) {
      const { allowlist, denylist } = request.domainPolicy;
      if (allowlist.length > 0) {
        domainAllowed = new Set([...domainAllowed].filter((t) => allowlist.includes(t)));
        assemblyTrace.push(`domain:filtered_by_allowlist_${domainAllowed.size}`);
      }
      for (const denied of denylist) {
        domainAllowed.delete(denied);
      }
      assemblyTrace.push(`domain:denylist_removed_${denylist.length}`);
    } else {
      assemblyTrace.push("domain:no_constraints");
    }

    // Step 2: Constraint pack filtering (base allowed tools)
    let constrained = new Set([...domainAllowed].filter((t) => request.allowedTools.includes(t)));
    assemblyTrace.push(`constraint:filtered_to_${constrained.size}`);

    // Step 3: Risk-based filtering
    let riskFiltered = new Set(constrained);
    if (request.riskContext) {
      const { currentRiskScore, maxRiskScore } = request.riskContext;
      if (currentRiskScore > maxRiskScore * 0.8) {
        // High risk: restrict to essential tools only
        const essentialTools = [...riskFiltered].slice(0, Math.ceil(riskFiltered.size * 0.5));
        riskFiltered = new Set(essentialTools);
        assemblyTrace.push(`risk:restricted_to_${riskFiltered.size}_due_to_high_risk`);
      } else {
        assemblyTrace.push("risk:no_restriction");
      }
    } else {
      assemblyTrace.push("risk:no_context");
    }

    // Step 4: Budget-based filtering
    let budgetFiltered = new Set(riskFiltered);
    if (request.budgetContext) {
      const { remainingCost, toolCostMap } = request.budgetContext;
      const affordable: string[] = [];
      for (const tool of budgetFiltered) {
        const cost = toolCostMap?.[tool] ?? 0;
        if (cost <= remainingCost) {
          affordable.push(tool);
        }
      }
      budgetFiltered = new Set(affordable);
      assemblyTrace.push(`budget:filtered_to_${budgetFiltered.size}_affordable`);
    } else {
      assemblyTrace.push("budget:no_context");
    }

    // Step 5: Security policy filtering
    let securityFiltered = new Set(budgetFiltered);
    if (request.securityPolicy) {
      for (const tool of [...securityFiltered]) {
        if (request.securityPolicy.blockedFor.includes(tool)) {
          securityFiltered.delete(tool);
        }
      }
      assemblyTrace.push(`security:blocked_${request.securityPolicy.blockedFor.length}`);
    } else {
      assemblyTrace.push("security:no_policy");
    }

    // Step 6: Reliability filtering
    let finalTools = new Set(securityFiltered);
    if (request.reliabilityScores) {
      const unreliable: string[] = [];
      for (const [tool, score] of Object.entries(request.reliabilityScores)) {
        if (score < 0.7 && finalTools.has(tool)) {
          unreliable.push(tool);
          finalTools.delete(tool);
        }
      }
      assemblyTrace.push(`reliability:removed_${unreliable.length}_low_score`);
    } else {
      assemblyTrace.push("reliability:no_scores");
    }

    // Final: Compute granted vs blocked
    const grantedTools: string[] = [];
    const blockedTools: string[] = [];
    for (const tool of request.requestedTools) {
      if (finalTools.has(tool)) {
        grantedTools.push(tool);
      } else {
        blockedTools.push(tool);
      }
    }

    return {
      allowedTools: [...request.allowedTools],
      grantedTools,
      blockedTools,
      requiredEvidence: [...request.requiredEvidence],
      assemblyTrace,
    };
  }
}
