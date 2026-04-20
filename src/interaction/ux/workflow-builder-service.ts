import { applyInteractionTemplate, type InteractionTemplate } from "./template-engine/index.js";
import { canAdvanceWizard, type WizardSession, type WizardStep } from "./wizard/index.js";
import type {
  DomainOnboardingWizard,
  VisualWorkflowBuilder,
  DraggableComponent,
  ComponentCategory,
  WorkflowPreview,
} from "./onboarding/index.js";

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

function categorizeComponents(components: readonly DraggableComponent[]): ComponentCategory[] {
  const groups = new Map<ComponentCategory["category"], DraggableComponent[]>();
  for (const component of components) {
    const category = component.componentId.includes("trigger")
      ? "trigger"
      : component.componentId.includes("condition")
        ? "condition"
        : component.componentId.includes("approval")
          ? "approval"
          : component.componentId.includes("output")
            ? "output"
            : "action";
    groups.set(category, [...(groups.get(category) ?? []), component]);
  }
  return [...groups.entries()].map(([category, items]) => ({
    category,
    components: items,
  }));
}

function buildPreview(template: InteractionTemplate, steps: readonly WizardStep[]): WorkflowPreview {
  return {
    estimatedDuration: `${Math.max(1, steps.length * 5)} min`,
    estimatedCost: `$${(template.steps.length * 0.03).toFixed(2)}`,
    riskAssessment: steps.some((item) => item.completed === false) ? "needs review" : "ready",
    stepByStepDescription: template.steps,
  };
}

export class WorkflowBuilderService {
  public build(request: WorkflowBuilderRequest): WorkflowBuilderResult {
    const template = applyInteractionTemplate(request.template);
    const nextStepAllowed = canAdvanceWizard(request.session);
    const palette = categorizeComponents(request.components);
    const builder: VisualWorkflowBuilder = {
      canvas: {
        nodes: template.steps.map((step, index) => ({
          nodeId: `node_${index + 1}`,
          componentId: palette.flatMap((item) => item.components).find((component) =>
            component.previewDescription.toLowerCase().includes(step.toLowerCase())
              || component.name.toLowerCase().includes(step.toLowerCase()),
          )?.componentId ?? `template_step_${index + 1}`,
          label: step,
        })),
        edges: template.steps.slice(1).map((_, index) => ({
          fromNodeId: `node_${index + 1}`,
          toNodeId: `node_${index + 2}`,
        })),
      },
      componentPalette: palette,
      livePreview: buildPreview(template, request.session.steps),
      validation: {
        valid: nextStepAllowed || request.session.steps.every((step) => step.completed),
        messages: nextStepAllowed
          ? []
          : [`complete current step before leaving ${request.session.currentStepId}`],
      },
    };

    return {
      session: request.session,
      template,
      builder,
      nextStepAllowed,
    };
  }
}
