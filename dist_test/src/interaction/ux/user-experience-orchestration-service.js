import { UserPortalService, } from "./onboarding/index.js";
import { WorkflowBuilderService } from "./workflow-builder-service.js";
import { applyInteractionTemplate } from "./template-engine/index.js";
export class UserExperienceOrchestrationService {
    portalService = new UserPortalService();
    workflowBuilderService = new WorkflowBuilderService();
    async bootstrap(request) {
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
                steps: builder.template.steps,
                validationFindings: builder.builder.validation.messages,
                ownerUserId: request.session.userId,
            },
            recommendedDomains: plan.recommendedDomains,
            welcomePrompt: plan.welcomePrompt,
        };
    }
}
//# sourceMappingURL=user-experience-orchestration-service.js.map