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
export declare class UserPortalService implements UserPortalPort {
    private readonly sessions;
    createSession(session: UserPortalSession, context?: UserPortalContext): Promise<string>;
    getSession(sessionId: string): StoredPortalSession | null;
    resolveMode(context: UserPortalContext): PlatformMode;
    buildOnboardingPlan(description: string, context: UserPortalContext): PortalOnboardingPlan;
    buildDomainOnboardingWizard(description: string, context: UserPortalContext): DomainOnboardingWizard;
    buildVisualWorkflowBuilder(description: string, selectedDomains?: readonly string[]): VisualWorkflowBuilder;
    private recommendDomains;
    private resolveDomainRiskLevel;
}
export {};
