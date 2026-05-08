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
    readonly emphasis?: "minimal" | "guided" | "governed";
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
}

export interface ComponentCategory {
  readonly category: "trigger" | "action" | "condition" | "approval" | "output";
  readonly components: readonly DraggableComponent[];
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

export class UserPortalService implements UserPortalPort {
  private readonly sessions = new Map<string, StoredPortalSession>();

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

  public buildOnboardingPlan(description: string, context: UserPortalContext): PortalOnboardingPlan {
    const mode = this.resolveMode(context);
    const recommendedDomains = this.recommendDomains(description);
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

  public buildDomainOnboardingWizard(description: string, context: UserPortalContext): DomainOnboardingWizard {
    const mode = this.resolveMode(context);
    return {
      steps: [
        {
          stepId: "business_type",
          title: "选择业务类型",
          description: mode.mode === "solo"
            ? "根据你的业务场景快速推荐第一个可运行模板。"
            : "根据组织场景推荐领域模板，并标记需要协作的业务边界。",
          emphasis: mode.mode === "solo" ? "minimal" : "guided",
        },
        {
          stepId: "capability_setup",
          title: "配置核心能力",
          description: mode.mode === "enterprise"
            ? "按部门与环境分层配置能力、集成和默认工作流。"
            : "勾选需要的执行能力、集成和默认工作流。",
          emphasis: mode.mode === "solo" ? "minimal" : "guided",
        },
        {
          stepId: "risk_setup",
          title: "设置风控规则",
          description: mode.mode === "solo"
            ? "确认默认预算和基础安全边界。"
            : "确认审批方式、预算约束和默认安全边界。",
          emphasis: mode.mode === "enterprise" ? "governed" : "guided",
        },
        {
          stepId: "activation",
          title: "激活上线",
          description: mode.mode === "enterprise"
            ? "先进入受控灰度，再在多级看板中观察运行状态。"
            : "创建首个 Agent 并进入看板观察运行状态。",
          emphasis: mode.mode === "enterprise" ? "governed" : "guided",
        },
      ],
      recommendedDomains: this.recommendDomains(description),
      defaultMode: mode,
    };
  }

  public buildVisualWorkflowBuilder(description: string, selectedDomains?: readonly string[], context?: UserPortalContext): VisualWorkflowBuilder {
    const domains = selectedDomains != null && selectedDomains.length > 0
      ? [...selectedDomains]
      : this.recommendDomains(description);
    const primaryDomain = domains[0] ?? "general_ops";
    const mode = context == null
      ? null
      : this.resolveMode(context);
    const includeApprovalStage = mode?.features.approvalEngine === "full";

    return {
      canvas: {
        nodes: [
          { nodeId: "node_trigger", componentId: "manual_trigger", label: "手动触发" },
          { nodeId: "node_action", componentId: "domain_action", label: `${primaryDomain} 主动作` },
          ...(includeApprovalStage ? [{ nodeId: "node_approval", componentId: "policy_approval", label: "审批与预算校验" }] : []),
          { nodeId: "node_output", componentId: "report_output", label: "输出结果" },
        ],
        edges: [
          { fromNodeId: "node_trigger", toNodeId: "node_action" },
          ...(includeApprovalStage
            ? [{ fromNodeId: "node_action", toNodeId: "node_approval" }, { fromNodeId: "node_approval", toNodeId: "node_output" }]
            : [{ fromNodeId: "node_action", toNodeId: "node_output" }]),
        ],
      },
      componentPalette: [
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
            riskLevel: this.resolveDomainRiskLevel(domainId, description),
            configSchema: { type: "object", properties: { target: { type: "string" } } },
            previewDescription: `在 ${domainId} 域中执行核心动作。`,
          })),
        },
        ...(includeApprovalStage
          ? [{
            category: "approval" as const,
            components: [
              {
                componentId: "policy_approval",
                name: "审批与预算校验",
                icon: "shield",
                domainId: "platform",
                riskLevel: "high" as const,
                configSchema: { type: "object", properties: { approverGroup: { type: "string" } } },
                previewDescription: "在执行前校验预算、权限和审批策略。",
              },
            ],
          }]
          : []),
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
      ],
      livePreview: {
        estimatedDuration: includeApprovalStage ? "20m" : "15m",
        estimatedCost: includeApprovalStage ? "$0.28" : "$0.20",
        riskAssessment: domains.includes("finance")
          ? "中高风险，需要保留审批点"
          : includeApprovalStage
            ? "组织模式要求先经过审批与预算校验"
            : "中等风险，可先以 supervised 模式运行",
        stepByStepDescription: [
          "接收触发条件并校验输入。",
          `在 ${primaryDomain} 域执行主要业务动作。`,
          ...(includeApprovalStage ? ["执行审批、预算和权限校验。"] : []),
          "生成交付结果并推送到用户看板。",
        ],
      },
      validation: {
        valid: true,
        messages: ["流程结构有效，可继续配置审批和风控。"],
      },
    };
  }

  private recommendDomains(description: string): string[] {
    const normalized = description.toLowerCase();
    const lexicon: Readonly<Record<string, readonly string[]>> = {
      advertising: ["marketing", "campaign", "广告", "投放", "增长", "roi", "线索"],
      finance: ["finance", "invoice", "budget", "财务", "预算", "付款", "发票", "工资"],
      hr: ["recruit", "hire", "hr", "招聘", "入职", "候选人", "员工"],
      customer_support: ["support", "customer", "客服", "工单", "ticket", "sla", "投诉"],
      engineering_ops: ["code", "engineering", "deploy", "bug", "代码", "研发", "发布", "生产环境", "pipeline"],
    };
    const scores = new Map<string, number>();
    for (const [domainId, keywords] of Object.entries(lexicon)) {
      let score = 0;
      for (const keyword of keywords) {
        if (normalized.includes(keyword.toLowerCase())) {
          score += /(deploy|production|prod|付款|工资|预算)/i.test(keyword) ? 3 : 2;
        }
      }
      if (score > 0) {
        scores.set(domainId, score);
      }
    }
    const ranked = [...scores.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([domainId]) => domainId);
    return ranked.length > 0 ? ranked : normalized.length > 0 ? ["general_ops"] : [];
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
