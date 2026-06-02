import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import type { RuntimeLifecycleRepository } from "../../../platform/five-plane-state-evidence/truth/repositories/runtime-lifecycle-repository.js";

function emitOnboardingWarning(code: string, message: string): void {
  process.emitWarning(message, { code });
}

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
  readonly userMode?: "builder" | "operator" | "executive";
  readonly historicalDomainPreferences?: readonly string[];
}

export interface PortalOnboardingPlan {
  readonly mode: PlatformMode;
  readonly recommendedDomains: readonly string[];
  readonly recommendationReasons: readonly string[];
  readonly recommendedNextActions: readonly string[];
  readonly welcomePrompt: string;
}

export interface DomainOnboardingWizard {
  readonly steps: readonly {
    readonly stepId: "business_type" | "capability_setup" | "risk_setup" | "activation";
    readonly title: string;
    readonly description: string;
    readonly emphasis?: "minimal" | "guided" | "governed";
    readonly optional?: boolean;
    readonly visibleForModes?: readonly PlatformMode["mode"][];
  }[];
  readonly recommendedDomains: readonly string[];
  readonly defaultMode: PlatformMode;
  readonly progressiveDisclosure: {
    readonly level: "minimal" | "guided" | "governed";
    readonly visibleSections: readonly string[];
    readonly hiddenSections: readonly string[];
  };
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
  readonly sideEffectProfile?: {
    readonly mayCommitExternalEffect: boolean;
    readonly reversible: boolean;
  };
  readonly compensationModel?: {
    readonly strategy: "none" | "retry_only" | "idempotent_replay" | "automatic_rollback" | "manual_rollback";
  };
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
  readonly progressiveDisclosure: {
    readonly level: "minimal" | "guided" | "governed";
    readonly hiddenCategories: readonly string[];
    readonly defaultExpandedCategories: readonly string[];
  };
}

export interface StoredPortalSession {
  readonly sessionId: string;
  readonly session: UserPortalSession;
  readonly createdAt: string;
  readonly mode: PlatformMode;
  readonly context: UserPortalContext;
}

export interface UserPortalSessionRepository {
  saveSession(record: StoredPortalSession): void;
  loadSession(sessionId: string): StoredPortalSession | null;
}

export class InMemoryUserPortalSessionRepository implements UserPortalSessionRepository {
  private readonly sessions = new Map<string, StoredPortalSession>();

  public saveSession(record: StoredPortalSession): void {
    this.sessions.set(record.sessionId, record);
  }

  public loadSession(sessionId: string): StoredPortalSession | null {
    return this.sessions.get(sessionId) ?? null;
  }
}

export class DurableUserPortalSessionRepository implements UserPortalSessionRepository {
  public constructor(
    private readonly runtimeRepository: RuntimeLifecycleRepository,
    private readonly options: { readonly prefix?: string } = {},
  ) {}

  public saveSession(record: StoredPortalSession): void {
    const key = this.buildStorageKey(record.sessionId);
    this.runtimeRepository.updateWorkflowState(
      key,
      "portal_session",
      0,
      JSON.stringify(record),
      record.createdAt,
      record.sessionId,
    );
  }

  public loadSession(sessionId: string): StoredPortalSession | null {
    const state = this.runtimeRepository.getWorkflowState(this.buildStorageKey(sessionId));
    if (state == null) {
      return null;
    }
    try {
      const parsed = JSON.parse(state.outputsJson) as Partial<StoredPortalSession>;
      if (
        typeof parsed.sessionId !== "string"
        || parsed.session == null
        || typeof parsed.createdAt !== "string"
        || parsed.mode == null
        || parsed.context == null
      ) {
        return null;
      }
      return {
        sessionId: parsed.sessionId,
        session: parsed.session,
        createdAt: parsed.createdAt,
        mode: parsed.mode,
        context: parsed.context,
      };
    } catch (error) {
      emitOnboardingWarning(
        "interaction.onboarding.invalid_portal_session",
        `Failed to parse portal session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private buildStorageKey(sessionId: string): string {
    return `${this.options.prefix ?? "portal_session"}:${sessionId}`;
  }
}

export class UserPortalService implements UserPortalPort {
  private readonly repository: UserPortalSessionRepository;

  public constructor(repository: UserPortalSessionRepository = new InMemoryUserPortalSessionRepository()) {
    this.repository = repository;
  }

  public async createSession(session: UserPortalSession, context?: UserPortalContext): Promise<string> {
    const sessionId = newId("portal_session");
    const resolvedContext = context ?? {
      memberCount: 1,
      departmentCount: 1,
      requiresSso: false,
    };
    const mode = this.resolveMode(resolvedContext);
    this.repository.saveSession({
      sessionId,
      session,
      createdAt: nowIso(),
      mode,
      context: resolvedContext,
    });
    return sessionId;
  }

  public getSession(sessionId: string): StoredPortalSession | null {
    return this.repository.loadSession(sessionId);
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
    const { domains: recommendedDomains, reasons: recommendationReasons } = this.recommendDomains(description, context);
    const recommendedNextActions = mode.mode === "solo"
      ? [
          "确认业务目标和首个自动化场景",
          "直接套用推荐模板并保留默认风控",
          "激活第一个 Agent 并在简化看板中观察结果",
        ]
      : [
          "确认业务目标和首个自动化场景",
          "选择合适的域模板并检查默认风控",
          "激活第一个 Agent 并在看板中观察结果",
        ];

    return {
      mode,
      recommendedDomains,
      recommendationReasons,
      recommendedNextActions,
      welcomePrompt: `你好，我会先按 ${mode.mode} 模式为你准备平台入口。`,
    };
  }

  public buildDomainOnboardingWizard(description: string, context: UserPortalContext): DomainOnboardingWizard {
    const mode = this.resolveMode(context);
    const progressiveDisclosure = this.buildProgressiveDisclosure(mode);
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
          optional: mode.mode === "solo",
          visibleForModes: ["solo", "team", "department", "enterprise"],
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
      recommendedDomains: this.recommendDomains(description, context).domains,
      defaultMode: mode,
      progressiveDisclosure,
    };
  }

  public buildVisualWorkflowBuilder(description: string, selectedDomains?: readonly string[], context?: UserPortalContext): VisualWorkflowBuilder {
    const domains = selectedDomains != null && selectedDomains.length > 0
      ? [...selectedDomains]
      : this.recommendDomains(description, context ?? {
        memberCount: 1,
        departmentCount: 1,
        requiresSso: false,
      }).domains;
    const primaryDomain = domains[0] ?? "general-ops";
    const mode = context == null
      ? null
      : this.resolveMode(context);
    const includeApprovalStage = mode?.features.approvalEngine === "full";
    const progressiveDisclosure = mode == null
      ? {
          level: "guided" as const,
          hiddenCategories: [],
          defaultExpandedCategories: ["trigger", "action", "output"],
        }
      : {
          level: this.buildProgressiveDisclosure(mode).level,
          hiddenCategories: mode.mode === "solo" ? ["condition", "approval"] : mode.mode === "team" ? ["condition"] : [],
          defaultExpandedCategories: mode.mode === "enterprise"
            ? ["trigger", "action", "approval", "output"]
            : ["trigger", "action", "output"],
        };

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
              sideEffectProfile: {
                mayCommitExternalEffect: false,
                reversible: true,
              },
              compensationModel: {
                strategy: "none",
              },
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
            sideEffectProfile: {
              mayCommitExternalEffect: true,
              reversible: domainId !== "finance",
            },
            compensationModel: {
              strategy: domainId === "finance" ? "manual_rollback" : "automatic_rollback",
            },
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
                sideEffectProfile: {
                  mayCommitExternalEffect: false,
                  reversible: true,
                },
                compensationModel: {
                  strategy: "retry_only" as const,
                },
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
              sideEffectProfile: {
                mayCommitExternalEffect: true,
                reversible: true,
              },
              compensationModel: {
                strategy: "idempotent_replay" as const,
              },
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
      progressiveDisclosure,
    };
  }

  private recommendDomains(description: string, context?: UserPortalContext): {
    readonly domains: string[];
    readonly reasons: readonly string[];
  } {
    const normalized = description.toLowerCase();

    // Rich domain scoring signals
    interface DomainScoringSignal {
      readonly domainId: string;
      readonly keywords: readonly string[];
      readonly baseScore: number;
      readonly riskMultiplier: number;
      readonly userModeBonus?: Record<string, number>;
    }

    const DOMAIN_SCORING_SIGNALS: readonly DomainScoringSignal[] = [
      {
        domainId: "advertising",
        keywords: ["marketing", "campaign", "广告", "投放", "增长", "roi", "线索", "素材", "推广", "advertise"],
        baseScore: 2,
        riskMultiplier: 1.2,
        userModeBonus: { executive: 1 },
      },
      {
        domainId: "finance",
        keywords: ["finance", "invoice", "budget", "财务", "预算", "付款", "发票", "工资", "账务", "结算", "转账"],
        baseScore: 2,
        riskMultiplier: 1.5,
        userModeBonus: { executive: 2, operator: 1 },
      },
      {
        domainId: "hr",
        keywords: ["recruit", "hire", "hr", "招聘", "入职", "候选人", "员工", "人事", "绩效", "培训"],
        baseScore: 2,
        riskMultiplier: 1.0,
        userModeBonus: { operator: 1 },
      },
      {
        domainId: "customer_support",
        keywords: ["support", "customer", "客服", "工单", "ticket", "sla", "投诉", "售后", "服务"],
        baseScore: 2,
        riskMultiplier: 1.1,
      },
      {
        domainId: "engineering-ops",
        keywords: ["code", "engineering", "deploy", "bug", "代码", "研发", "发布", "生产环境", "pipeline", "ci/cd", "测试", "staging"],
        baseScore: 2,
        riskMultiplier: 1.3,
        userModeBonus: { operator: 2 },
      },
    ];

    const HIGH_RISK_KEYWORD_PATTERN = /(?:deploy|production|prod|付款|工资|预算|审批|删除|清空)/i;
    const scores = new Map<string, number>();
    const reasons = new Map<string, string[]>();

    for (const signal of DOMAIN_SCORING_SIGNALS) {
      let score = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of signal.keywords) {
        if (normalized.includes(keyword.toLowerCase())) {
          const isHighRisk = HIGH_RISK_KEYWORD_PATTERN.test(keyword);
          score += signal.baseScore * (isHighRisk ? 1.5 : 1);
          matchedKeywords.push(keyword);
        }
      }

      // Apply user mode bonus
      if (context?.userMode && signal.userModeBonus != null) {
        const modeBonus = signal.userModeBonus[context.userMode];
        if (modeBonus != null) {
          score += modeBonus;
          matchedKeywords.push(`mode_bonus:${context.userMode}`);
        }
      }

      // Apply enterprise/integration bonus
      if (context?.requiresSso && signal.domainId === "engineering-ops") {
        score += 1;
        matchedKeywords.push("enterprise_integration");
      }

      // Historical affinity bonus
      if (context?.historicalDomainPreferences?.includes(signal.domainId)) {
        score += 2;
        matchedKeywords.push("history_affinity");
      }

      // Apply risk multiplier for high-risk signals
      if (score > 0 && signal.riskMultiplier > 1) {
        score = Math.round(score * signal.riskMultiplier * 10) / 10;
        matchedKeywords.push(`risk_adjusted:${signal.riskMultiplier}x`);
      }

      if (score > 0) {
        scores.set(signal.domainId, score);
        reasons.set(signal.domainId, matchedKeywords.map((k) => `signal:${k}`));
      }
    }

    // Add general-ops as fallback if no domain matched
    if (scores.size === 0 && normalized.length > 0) {
      scores.set("general-ops", 1);
      reasons.set("general-ops", ["fallback:general-ops"]);
    }

    const ranked = [...scores.entries()]
      .sort((left, right) => {
        const scoreDelta = right[1] - left[1];
        if (scoreDelta !== 0) return scoreDelta;
        return left[0].localeCompare(right[0]);
      })
      .map(([domainId]) => domainId);

    const domains = ranked.length > 0 ? ranked : normalized.length > 0 ? ["general-ops"] : [];
    return {
      domains,
      reasons: domains.flatMap((domainId) => reasons.get(domainId) ?? [`fallback:${domainId}`]),
    };
  }

  private buildProgressiveDisclosure(mode: PlatformMode): DomainOnboardingWizard["progressiveDisclosure"] {
    if (mode.mode === "solo") {
      return {
        level: "minimal",
        visibleSections: ["business_type", "activation", "basic_risk"],
        hiddenSections: ["advanced_integrations", "governance_matrix", "org_hierarchy"],
      };
    }
    if (mode.mode === "enterprise") {
      return {
        level: "governed",
        visibleSections: ["business_type", "capability_setup", "risk_setup", "activation", "governance_matrix"],
        hiddenSections: [],
      };
    }
    return {
      level: "guided",
      visibleSections: ["business_type", "capability_setup", "risk_setup", "activation"],
      hiddenSections: ["org_hierarchy"],
    };
  }

  private resolveDomainRiskLevel(domainId: string, description: string): DraggableComponent["riskLevel"] {
    if (domainId === "finance") {
      if (/(payment|payroll|settlement|transfer|invoice approval|付款|工资|结算|转账)/i.test(description)) {
        return "critical";
      }
      return "high";
    }
    if (domainId === "engineering-ops" && /(production|prod|发布到生产|线上变更)/i.test(description)) {
      return "high";
    }
    return "medium";
  }
}
