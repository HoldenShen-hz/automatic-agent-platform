import {
  UserPortalService,
  type DomainOnboardingWizard,
  type DraggableComponent,
  type UserPortalContext,
  type UserPortalSession,
  type VisualWorkflowBuilder,
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
  // R7-37 fix: DAG nodes/edges replaces legacy linear steps model
  readonly planGraph: {
    readonly nodes: ReadonlyArray<{
      nodeId: string;
      label: string;
      inputBindings: ReadonlyArray<string>;
      outputKey: string;
      toolset?: string;
      parallel?: boolean;
    }>;
    readonly edges: ReadonlyArray<{
      fromNodeId: string;
      toNodeId: string;
      dependencyType: "hard" | "soft";
    }>;
  };
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
  private readonly portalService = new UserPortalService();
  private readonly workflowBuilderService = new WorkflowBuilderService();

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
        // R7-37 fix: DAG planGraph replaces legacy linear steps
        planGraph: this.convertBuilderToPlanGraph(builder),
        validationFindings: builder.builder.validation.messages,
        ownerUserId: request.session.userId,
      },
      recommendedDomains: plan.recommendedDomains,
      welcomePrompt: plan.welcomePrompt,
    };
  }

  // R7-37 fix: convert builder canvas to canonical DAG planGraph
  private convertBuilderToPlanGraph(builder: { builder: VisualWorkflowBuilder; template: InteractionTemplate }): WorkflowBuilderDraft["planGraph"] {
    const canvasNodes = builder.builder.canvas.nodes as unknown as Array<Record<string, unknown>>;
    const canvasEdges = builder.builder.canvas.edges as unknown as Array<Record<string, unknown>>;
    const templateSteps = builder.template.steps as unknown as string[];

    // Build nodes from canvas nodes
    const nodes = canvasNodes.map((node, idx) => ({
      nodeId: String(node.componentId ?? `node_${idx}`),
      label: String(node.label ?? node.componentId ?? `Node ${idx}`),
      inputBindings: (node.inputBindings as readonly string[] | undefined) ?? ([] as readonly string[]),
      outputKey: String(node.outputKey ?? `output_${idx}`),
      toolset: node.toolset as string | undefined,
      parallel: node.parallel as boolean | undefined,
    })) as WorkflowBuilderDraft["planGraph"]["nodes"];

    // Build edges from canvas edges or infer from template steps order
    const edges: { fromNodeId: string; toNodeId: string; dependencyType: "hard" | "soft" }[] = [];
    if (canvasEdges.length > 0) {
      for (const edge of canvasEdges) {
        edges.push({
          fromNodeId: String(edge.from ?? edge.source ?? ""),
          toNodeId: String(edge.to ?? edge.target ?? ""),
          dependencyType: (edge.dependencyType as "hard" | "soft") ?? "hard",
        });
      }
    } else {
      // Infer sequential edges from template steps
      for (let i = 0; i < Math.max(0, templateSteps.length - 1); i++) {
        edges.push({
          fromNodeId: templateSteps[i] ?? "",
          toNodeId: templateSteps[i + 1] ?? "",
          dependencyType: "hard",
        });
      }
    }

    return { nodes: nodes as WorkflowBuilderDraft["planGraph"]["nodes"], edges: edges as WorkflowBuilderDraft["planGraph"]["edges"] };
  }
}
