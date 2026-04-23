import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
export class UserPortalService {
    sessions = new Map();
    async createSession(session, context) {
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
    getSession(sessionId) {
        return this.sessions.get(sessionId) ?? null;
    }
    resolveMode(context) {
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
    buildOnboardingPlan(description, context) {
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
    buildDomainOnboardingWizard(description, context) {
        return {
            steps: [
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
            ],
            recommendedDomains: this.recommendDomains(description),
            defaultMode: this.resolveMode(context),
        };
    }
    buildVisualWorkflowBuilder(description, selectedDomains) {
        const domains = selectedDomains != null && selectedDomains.length > 0
            ? [...selectedDomains]
            : this.recommendDomains(description);
        const primaryDomain = domains[0] ?? "general_ops";
        return {
            canvas: {
                nodes: [
                    { nodeId: "node_trigger", componentId: "manual_trigger", label: "手动触发" },
                    { nodeId: "node_action", componentId: "domain_action", label: `${primaryDomain} 主动作` },
                    { nodeId: "node_output", componentId: "report_output", label: "输出结果" },
                ],
                edges: [
                    { fromNodeId: "node_trigger", toNodeId: "node_action" },
                    { fromNodeId: "node_action", toNodeId: "node_output" },
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
    recommendDomains(description) {
        const normalized = description.toLowerCase();
        const recommendations = new Set();
        if (/(marketing|campaign|广告|投放|增长)/i.test(description))
            recommendations.add("advertising");
        if (/(finance|invoice|budget|财务|预算)/i.test(description))
            recommendations.add("finance");
        if (/(recruit|hire|hr|招聘|入职)/i.test(description))
            recommendations.add("hr");
        if (/(support|customer|客服|工单)/i.test(description))
            recommendations.add("customer_support");
        if (/(code|engineering|deploy|bug|代码|研发|发布)/i.test(description))
            recommendations.add("engineering_ops");
        if (recommendations.size === 0 && normalized.length > 0)
            recommendations.add("general_ops");
        return [...recommendations];
    }
    resolveDomainRiskLevel(domainId, description) {
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
//# sourceMappingURL=index.js.map