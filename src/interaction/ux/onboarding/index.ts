import { newId, nowIso } from "../../../platform/contracts/types/ids.js";

export interface UserPortalSession {
  readonly userId: string;
  readonly tenantId: string;
  readonly displayName?: string;
  readonly preferredLocale?: string;
}

export interface UserPortalPort {
  createSession(session: UserPortalSession): Promise<string>;
}

export interface PlatformMode {
  readonly mode: "solo" | "team" | "department" | "enterprise";
  readonly autoDetected: boolean;
  readonly features: {
    readonly multiTenancy: boolean;
    readonly approvalEngine: "self_approve" | "simple" | "full";
    readonly securityReview: "auto_only" | "auto_plus_manual" | "full_team";
    readonly onboarding: "wizard_3min" | "guided_1week" | "runbook_full";
    readonly dashboardLevels: readonly ("L1" | "L2" | "L3" | "L4")[];
    readonly governance: "self" | "delegated" | "hierarchical";
  };
  readonly upgradePath: string;
}

export interface UserPortalContext {
  readonly memberCount: number;
  readonly departmentCount: number;
  readonly requiresSso: boolean;
}

export interface PortalOnboardingPlan {
  readonly mode: PlatformMode;
  readonly recommendedDomains: readonly string[];
  readonly recommendedNextActions: readonly string[];
  readonly welcomePrompt: string;
}

export interface DomainOnboardingWizard {
  readonly steps: readonly {
    readonly stepId: "business_type" | "capability_setup" | "risk_setup" | "activation";
    readonly title: string;
    readonly description: string;
  }[];
  readonly recommendedDomains: readonly string[];
  readonly defaultMode: PlatformMode;
}

export interface WorkflowPreview {
  readonly estimatedDuration: string;
  readonly estimatedCost: string;
  readonly riskAssessment: string;
  readonly stepByStepDescription: readonly string[];
}

export interface DraggableComponent {
  readonly componentId: string;
  readonly name: string;
  readonly icon: string;
  readonly domainId: string;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly configSchema: Record<string, unknown>;
  readonly previewDescription: string;
  readonly requiredMode?: PlatformMode["mode"]; // Progressive disclosure: component hidden for lower modes
}

export interface ComponentCategory {
  readonly category: "trigger" | "action" | "condition" | "approval" | "output";
  readonly components: readonly DraggableComponent[];
}

/**
 * Domain recommendation result with confidence scoring
 */
export interface DomainRecommendation {
  readonly domainId: string;
  readonly confidence: number;
  readonly reason: string;
}

/**
 * Interface for domain recommendation strategies.
 * §44.4 requires business-context-aware intelligent domain recommendation
 * via LLM, user history, or DomainRegistry.
 */
export interface DomainRecommenderPort {
  /**
   * Recommends domains based on user description and context.
   * @param description - User's natural language description
   * @param userId - User ID for history-based recommendations
   * @param tenantId - Tenant ID for domain registry lookup
   * @returns Ranked list of domain recommendations with confidence scores
   */
  recommendDomains(
    description: string,
    userId?: string,
    tenantId?: string,
  ): Promise<readonly DomainRecommendation[]>;
}

export interface VisualWorkflowBuilder {
  readonly canvas: {
    readonly nodes: readonly {
      readonly nodeId: string;
      readonly componentId: string;
      readonly label: string;
    }[];
    readonly edges: readonly {
      readonly fromNodeId: string;
      readonly toNodeId: string;
    }[];
  };
  readonly componentPalette: readonly ComponentCategory[];
  readonly livePreview: WorkflowPreview;
  readonly validation: {
    readonly valid: boolean;
    readonly messages: readonly string[];
  };
}

interface StoredPortalSession {
  readonly sessionId: string;
  readonly session: UserPortalSession;
  readonly createdAt: string;
  readonly mode: PlatformMode;
  readonly context: UserPortalContext;
}

/**
 * Domain registry entry for business-context-aware domain recommendation.
 * Used by DefaultDomainRecommender for registry-based lookups.
 */
interface DomainRegistryEntry {
  readonly domainId: string;
  readonly keywords: readonly string[];
  readonly description: string;
}

/**
 * Default implementation of DomainRecommenderPort.
 * Uses a domain registry with keyword matching as a fallback.
 * Production implementations should use LLM-based or user-history-based recommendation.
 */
class DefaultDomainRecommender implements DomainRecommenderPort {
  private readonly domainRegistry: readonly DomainRegistryEntry[] = [
    { domainId: "advertising", keywords: ["marketing", "campaign", "广告", "投放", "增长"], description: "营销与广告投放" },
    { domainId: "finance", keywords: ["finance", "invoice", "budget", "财务", "预算"], description: "财务与预算管理" },
    { domainId: "hr", keywords: ["recruit", "hire", "hr", "招聘", "入职"], description: "人力资源与招聘" },
    { domainId: "customer_support", keywords: ["support", "customer", "客服", "工单"], description: "客户服务与工单" },
    { domainId: "engineering_ops", keywords: ["code", "engineering", "deploy", "bug", "代码", "研发", "发布"], description: "工程运维" },
    { domainId: "legal", keywords: ["contract", "compliance", "合同", "法务", "合规"], description: "法务与合规" },
    { domainId: "sales", keywords: ["crm", "lead", "客户", "销售", "商机"], description: "销售管理" },
  ];

  /**
   * @deprecated Use recommendDomains() with a proper LLM-based or history-based recommender.
   * This method provides a basic keyword-matching fallback per §44.4.
   */
  private legacyKeywordRecommend(description: string): string[] {
    const normalized = description.toLowerCase();
    const recommendations = new Set<string>();
    for (const entry of this.domainRegistry) {
      if (entry.keywords.some((kw) => new RegExp(kw, "i").test(description))) {
        recommendations.add(entry.domainId);
      }
    }
    if (recommendations.size === 0 && normalized.length > 0) {
      recommendations.add("general_ops");
    }
    return [...recommendations];
  }

  public async recommendDomains(
    description: string,
    _userId?: string,
    _tenantId?: string,
  ): Promise<readonly DomainRecommendation[]> {
    // §44.4: In production, this should call LLM or query user history.
    // For now, use keyword-based registry matching with confidence scoring.
    const normalized = description.toLowerCase();
    const results: DomainRecommendation[] = [];

    for (const entry of this.domainRegistry) {
      const matchedKeywords = entry.keywords.filter((kw) => new RegExp(kw, "i").test(description));
      if (matchedKeywords.length > 0) {
        // Confidence based on keyword match ratio
        const confidence = Math.min(0.5 + (matchedKeywords.length * 0.15), 0.95);
        results.push({
          domainId: entry.domainId,
          confidence,
          reason: `匹配关键词: ${matchedKeywords.join(", ")}`,
        });
      }
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence);

    if (results.length === 0 && normalized.length > 0) {
      results.push({
        domainId: "general_ops",
        confidence: 0.5,
        reason: "默认推荐，基于通用操作场景",
      });
    }

    return results;
  }
}

export class UserPortalService implements UserPortalPort {
  private readonly sessions = new Map<string, StoredPortalSession>();
  private readonly domainRecommender: DomainRecommenderPort;

  public constructor(domainRecommender?: DomainRecommenderPort) {
    this.domainRecommender = domainRecommender ?? new DefaultDomainRecommender();
  }

  public async createSession(session: UserPortalSession, context?: UserPortalContext): Promise<string> {
    const sessionId = newId("portal_session");
    const resolvedContext = context ?? {
      memberCount: 1,
      departmentCount: 1,
      requiresSso: false,
    };
    const mode = this.resolveMode(resolvedContext);
    this.sessions.set(sessionId, {
      sessionId,
      session,
      createdAt: nowIso(),
      mode,
      context: resolvedContext,
    });
    return sessionId;
  }

  public getSession(sessionId: string): StoredPortalSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  public resolveMode(context: UserPortalContext): PlatformMode {
    if (context.requiresSso || context.memberCount >= 100 || context.departmentCount >= 5) {
      return {
        mode: "enterprise",
        autoDetected: true,
        features: {
          multiTenancy: true,
          approvalEngine: "full",
          securityReview: "full_team",
          onboarding: "runbook_full",
          dashboardLevels: ["L1", "L2", "L3", "L4"],
          governance: "hierarchical",
        },
        upgradePath: "启用组织治理、SSO/SCIM 和 L3/L4 运维视图。",
      };
    }
    if (context.departmentCount > 1 || context.memberCount >= 20) {
      return {
        mode: "department",
        autoDetected: true,
        features: {
          multiTenancy: true,
          approvalEngine: "full",
          securityReview: "auto_plus_manual",
          onboarding: "guided_1week",
          dashboardLevels: ["L1", "L2", "L3"],
          governance: "delegated",
        },
        upgradePath: "补齐统一身份、跨部门治理和更细的预算边界。",
      };
    }
    if (context.memberCount > 1) {
      return {
        mode: "team",
        autoDetected: true,
        features: {
          multiTenancy: false,
          approvalEngine: "simple",
          securityReview: "auto_plus_manual",
          onboarding: "guided_1week",
          dashboardLevels: ["L1", "L2"],
          governance: "delegated",
        },
        upgradePath: "当团队扩大时升级到 department 或 enterprise 模式。",
      };
    }
    return {
      mode: "solo",
      autoDetected: true,
      features: {
        multiTenancy: false,
        approvalEngine: "self_approve",
        securityReview: "auto_only",
        onboarding: "wizard_3min",
        dashboardLevels: ["L1"],
        governance: "self",
      },
      upgradePath: "邀请协作者后会自动解锁团队模式。",
    };
  }

  public async buildOnboardingPlan(description: string, context: UserPortalContext): Promise<PortalOnboardingPlan> {
    const mode = this.resolveMode(context);
    // §44.4: Use DomainRecommenderPort for intelligent domain recommendation
    const domainRecommendations = await this.recommendDomainsAsync(description);
    const recommendedDomains = domainRecommendations.map((r) => r.domainId);
    const recommendedNextActions = [
      "确认业务目标和首个自动化场景",
      "选择合适的域模板并检查默认风控",
      "激活第一个 Agent 并在看板中观察结果",
    ];

    return {
      mode,
      recommendedDomains,
      recommendedNextActions,
      welcomePrompt: `你好，我会先按 ${mode.mode} 模式为你准备平台入口。`,
    };
  }

  public async buildDomainOnboardingWizard(description: string, context: UserPortalContext): Promise<DomainOnboardingWizard> {
    const mode = this.resolveMode(context);
    // §44.5: Progressive disclosure - simplify wizard steps based on mode
    const steps = this.getWizardStepsForMode(mode.mode);
    // §44.4: Use DomainRecommenderPort for intelligent domain recommendation
    const domainRecommendations = await this.recommendDomainsAsync(description);
    const recommendedDomains = domainRecommendations.map((r) => r.domainId);

    return {
      steps,
      recommendedDomains,
      defaultMode: mode,
    };
  }

  /**
   * §44.5: Returns wizard steps filtered by platform mode for progressive disclosure.
   * Higher complexity steps are hidden from lower modes.
   */
  private getWizardStepsForMode(mode: PlatformMode["mode"]): DomainOnboardingWizard["steps"] {
    const allSteps: DomainOnboardingWizard["steps"] = [
      {
        stepId: "business_type",
        title: "选择业务类型",
        description: "根据你的业务场景自动推荐领域模板。",
      },
      {
        stepId: "capability_setup",
        title: "配置核心能力",
        description: "勾选需要的执行能力、集成和默认工作流。",
      },
      {
        stepId: "risk_setup",
        title: "设置风控规则",
        description: "确认审批方式、预算约束和默认安全边界。",
      },
      {
        stepId: "activation",
        title: "激活上线",
        description: "创建首个 Agent 并进入看板观察运行状态。",
      },
    ];

    // Progressive disclosure: hide complexity from lower modes
    switch (mode) {
      case "solo":
        // Solo mode: only show essential steps (skip detailed capability/risk setup)
        return allSteps.filter((s) => s.stepId === "business_type" || s.stepId === "activation");
      case "team":
        // Team mode: show basic steps without advanced risk configuration
        return allSteps.filter((s) => s.stepId !== "risk_setup" || false); // Include all but risk_setup
      case "department":
      case "enterprise":
      default:
        // Full wizard for department+ modes
        return allSteps;
    }
  }

  /**
   * §44.4: Builds a visual workflow builder with domain-aware components.
   * Uses DomainRecommenderPort for intelligent domain recommendation.
   */
  public async buildVisualWorkflowBuilder(description: string, selectedDomains?: readonly string[]): Promise<VisualWorkflowBuilder> {
    // §44.4: Use DomainRecommenderPort for intelligent domain recommendation
    const domains = selectedDomains != null && selectedDomains.length > 0
      ? [...selectedDomains]
      : (await this.recommendDomainsAsync(description)).map((r) => r.domainId);
    const primaryDomain = domains[0] ?? "general_ops";

    // §44.5: Progressive disclosure - get components filtered by mode
    const mode = this.resolveMode({ memberCount: 1, departmentCount: 1, requiresSso: false });
    const componentPalette = this.buildComponentPaletteForMode(domains, mode.mode);

    return {
      canvas: {
        nodes: [
          { nodeId: "node_trigger", componentId: "manual_trigger", label: "手动触发" },
          { nodeId: "node_action", componentId: "domain_action", label: `${primaryDomain} 主动作` },
          { nodeId: "node_output", componentId: "report_output", label: "输出结果" },
        ] as const,
        edges: [
          { fromNodeId: "node_trigger", toNodeId: "node_action" },
          { fromNodeId: "node_action", toNodeId: "node_output" },
        ] as const,
      },
      componentPalette,
      livePreview: {
        estimatedDuration: "15m",
        estimatedCost: "$0.20",
        riskAssessment: domains.includes("finance") ? "中高风险，需要保留审批点" : "中等风险，可先以 supervised 模式运行",
        stepByStepDescription: [
          "接收触发条件并校验输入。",
          `在 ${primaryDomain} 域执行主要业务动作。`,
          "生成交付结果并推送到用户看板。",
        ],
      },
      validation: {
        valid: true,
        messages: ["流程结构有效，可继续配置审批和风控。"],
      },
    };
  }

  /**
   * §44.5: Builds component palette filtered by platform mode for progressive disclosure.
   * Higher-risk or more complex components are hidden from lower modes.
   */
  private buildComponentPaletteForMode(domains: string[], mode: PlatformMode["mode"]): readonly ComponentCategory[] {
    const baseCategories: ComponentCategory[] = [
      {
        category: "trigger",
        components: [
          {
            componentId: "manual_trigger",
            name: "手动触发",
            icon: "play",
            domainId: "platform",
            riskLevel: "low",
            configSchema: { type: "object", properties: {} },
            previewDescription: "由用户手动启动流程。",
          },
        ],
      },
      {
        category: "action",
        components: domains.map((domainId) => ({
          componentId: `${domainId}_action`,
          name: `${domainId} 动作`,
          icon: "bolt",
          domainId,
          riskLevel: this.resolveDomainRiskLevel(domainId, ""),
          configSchema: { type: "object", properties: { target: { type: "string" } } },
          previewDescription: `在 ${domainId} 域中执行核心动作。`,
        })),
      },
      {
        category: "output",
        components: [
          {
            componentId: "report_output",
            name: "生成报告",
            icon: "file-text",
            domainId: "platform",
            riskLevel: "low",
            configSchema: { type: "object", properties: { format: { type: "string" } } },
            previewDescription: "输出摘要、报表或通知。",
          },
        ],
      },
    ];

    // Progressive disclosure: add complexity for higher modes
    if (mode === "department" || mode === "enterprise") {
      // Add approval and condition categories for department+ modes
      baseCategories.push({
        category: "approval",
        components: [
          {
            componentId: "human_approval",
            name: "人工审批",
            icon: "user-check",
            domainId: "platform",
            riskLevel: "medium",
            configSchema: { type: "object", properties: { approvers: { type: "array" } } },
            previewDescription: "需要人工审批后继续执行。",
          },
        ],
      });
      baseCategories.push({
        category: "condition",
        components: [
          {
            componentId: "if_condition",
            name: "条件分支",
            icon: "git-branch",
            domainId: "platform",
            riskLevel: "low",
            configSchema: { type: "object", properties: { expression: { type: "string" } } },
            previewDescription: "根据条件选择执行分支。",
          },
        ],
      });
    }

    return baseCategories;
  }

  /**
   * §44.4: Async domain recommendation using DomainRecommenderPort.
   * Use this method in production for LLM-based or user-history-based recommendation.
   */
  public async recommendDomainsAsync(
    description: string,
    userId?: string,
    tenantId?: string,
  ): Promise<readonly DomainRecommendation[]> {
    const recommendations = await this.domainRecommender.recommendDomains(description, userId, tenantId);
    if (recommendations.length === 0) {
      return [{ domainId: "general_ops", confidence: 0.5, reason: "默认推荐" }];
    }
    return recommendations;
  }

  private resolveDomainRiskLevel(domainId: string, description: string): DraggableComponent["riskLevel"] {
    if (domainId === "finance") {
      if (/(payment|payroll|settlement|transfer|invoice approval|付款|工资|结算|转账)/i.test(description)) {
        return "critical";
      }
      return "high";
    }
    if (domainId === "engineering_ops" && /(production|prod|发布到生产|线上变更)/i.test(description)) {
      return "high";
    }
    return "medium";
  }
}
