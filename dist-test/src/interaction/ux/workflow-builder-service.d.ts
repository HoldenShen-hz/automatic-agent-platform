import { type InteractionTemplate } from "./template-engine/index.js";
import { type WizardSession } from "./wizard/index.js";
import type { DomainOnboardingWizard, VisualWorkflowBuilder, DraggableComponent } from "./onboarding/index.js";
export interface WorkflowBuilderRequest {
    readonly session: WizardSession;
    readonly template: InteractionTemplate;
    readonly onboardingWizard: DomainOnboardingWizard;
    readonly components: readonly DraggableComponent[];
}
export interface WorkflowBuilderResult {
    readonly session: WizardSession;
    readonly template: InteractionTemplate;
    readonly builder: VisualWorkflowBuilder;
    readonly nextStepAllowed: boolean;
}
export declare class WorkflowBuilderService {
    build(request: WorkflowBuilderRequest): WorkflowBuilderResult;
}
