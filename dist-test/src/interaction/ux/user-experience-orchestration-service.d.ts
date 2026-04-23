import { type DomainOnboardingWizard, type DraggableComponent, type UserPortalContext, type UserPortalSession } from "./onboarding/index.js";
import { type InteractionTemplate } from "./template-engine/index.js";
import { type WizardSession } from "./wizard/index.js";
export interface GuidedOnboardingSession {
    readonly sessionId: string;
    readonly userRole: "operator" | "domain_admin" | "platform_ops" | "fleet_admin";
    readonly currentStep: string;
    readonly completedSteps: readonly string[];
    readonly recommendedTemplates: readonly string[];
}
export interface WorkflowBuilderDraft {
    readonly draftId: string;
    readonly workflowId?: string;
    readonly steps: readonly string[];
    readonly validationFindings: readonly string[];
    readonly ownerUserId: string;
}
export interface UserExperienceBootstrapRequest {
    readonly session: UserPortalSession;
    readonly context: UserPortalContext;
    readonly userRole: GuidedOnboardingSession["userRole"];
    readonly businessDescription: string;
    readonly template: InteractionTemplate;
    readonly wizardSession: WizardSession;
    readonly components: readonly DraggableComponent[];
}
export interface UserExperienceBootstrapResult {
    readonly guidedSession: GuidedOnboardingSession;
    readonly wizard: DomainOnboardingWizard;
    readonly draft: WorkflowBuilderDraft;
    readonly recommendedDomains: readonly string[];
    readonly welcomePrompt: string;
}
export declare class UserExperienceOrchestrationService {
    private readonly portalService;
    private readonly workflowBuilderService;
    bootstrap(request: UserExperienceBootstrapRequest): Promise<UserExperienceBootstrapResult>;
}
