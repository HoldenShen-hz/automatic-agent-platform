import {
  UserPortalService,
  type DomainOnboardingWizard,
  type DraggableComponent,
  type UserPortalSessionRepository,
  type UserPortalContext,
  type UserPortalSession,
} from "./onboarding/index.js";
import { WorkflowBuilderService } from "./workflow-builder-service.js";
import { applyInteractionTemplate, type InteractionTemplate } from "./template-engine/index.js";
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

export class UserExperienceOrchestrationService {
  private readonly portalService: UserPortalService;
  private readonly workflowBuilderService: WorkflowBuilderService;

  public constructor(options: {
    readonly portalRepository?: UserPortalSessionRepository;
    readonly workflowBuilderService?: WorkflowBuilderService;
  } = {}) {
    this.portalService = new UserPortalService(options.portalRepository);
    this.workflowBuilderService = options.workflowBuilderService ?? new WorkflowBuilderService();
  }

  public async bootstrap(request: UserExperienceBootstrapRequest): Promise<UserExperienceBootstrapResult> {
    const sessionId = await this.portalService.createSession(request.session, request.context);
    const plan = this.portalService.buildOnboardingPlan(request.businessDescription, request.context);
    const wizard = this.portalService.buildDomainOnboardingWizard(request.businessDescription, request.context);
    const template = applyInteractionTemplate(request.template);
    const builder = this.workflowBuilderService.build({
      session: request.wizardSession,
      template,
      onboardingWizard: wizard,
      components: request.components,
    });

    return {
      guidedSession: {
        sessionId,
        userRole: request.userRole,
        currentStep: request.wizardSession.currentStepId,
        completedSteps: request.wizardSession.steps.filter((item) => item.completed).map((item) => item.stepId),
        recommendedTemplates: [template.templateId, ...wizard.recommendedDomains].slice(0, 4),
      },
      wizard,
      draft: {
        draftId: `${sessionId}:draft`,
        ...(builder.builder.canvas.nodes[0]?.componentId == null
          ? {}
          : { workflowId: builder.builder.canvas.nodes[0].componentId }),
        steps: builder.template.steps.map((step) => typeof step === "string" ? step : step.stepId),
        validationFindings: builder.builder.validation.messages,
        ownerUserId: request.session.userId,
      },
      recommendedDomains: plan.recommendedDomains,
      welcomePrompt: plan.welcomePrompt,
    };
  }
}
