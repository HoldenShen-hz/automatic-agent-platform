/**
 * Conversation Template Service
 *
 * Provides conversation templates for the UX layer.
 * Implements §45 "Conversation Template" requirement.
 *
 * @see docs_en/reviews/architecture-design-vs-implementation-review.md §45
 */

import { z } from "zod";

/**
 * Conversation template step
 */
export const ConversationTemplateStepSchema = z.object({
  stepId: z.string(),
  prompt: z.string(),
  responseTemplate: z.string().optional(),
  expectedEntities: z.array(z.string()).default([]),
  isRequired: z.boolean().default(true),
  allowSkip: z.boolean().default(false),
});

export type ConversationTemplateStep = z.infer<typeof ConversationTemplateStepSchema>;

/**
 * Conversation template schema
 */
export const ConversationTemplateSchema = z.object({
  templateId: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string().default("1.0"),
  intent: z.enum([
    "task_create",
    "task_query",
    "task_modify",
    "status_inquiry",
    "approval_action",
    "system_config",
  ]),
  steps: z.array(ConversationTemplateStepSchema),
  estimatedDurationMinutes: z.number().default(5),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export type ConversationTemplate = z.infer<typeof ConversationTemplateSchema>;

/**
 * Conversation template with applied context
 */
export interface TemplatedConversation {
  readonly templateId: string;
  readonly currentStepIndex: number;
  readonly steps: readonly ConversationTemplateStep[];
  readonly context: Record<string, unknown>;
  readonly progress: number;
  readonly isComplete: boolean;
  readonly nextPrompt?: string;
}

/**
 * Conversation template registry
 */
export class ConversationTemplateRegistry {
  private readonly templates = new Map<string, ConversationTemplate>();

  public constructor(initialTemplates?: readonly ConversationTemplate[]) {
    if (initialTemplates) {
      for (const template of initialTemplates) {
        this.register(template);
      }
    } else {
      this.registerBuiltInTemplates();
    }
  }

  /**
   * Register a conversation template
   */
  public register(template: z.input<typeof ConversationTemplateSchema>): void {
    const validated = ConversationTemplateSchema.parse(template);
    this.templates.set(validated.templateId, validated);
  }

  /**
   * Get a template by ID
   */
  public get(templateId: string): ConversationTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * List all active templates
   */
  public listActive(): readonly ConversationTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.isActive);
  }

  /**
   * List templates by intent type
   */
  public listByIntent(
    intent: ConversationTemplate["intent"],
  ): readonly ConversationTemplate[] {
    return this.listActive().filter((t) => t.intent === intent);
  }

  /**
   * List templates by tag
   */
  public listByTag(tag: string): readonly ConversationTemplate[] {
    return this.listActive().filter((t) => t.tags.includes(tag));
  }

  /**
   * Search templates by name or description
   */
  public search(query: string): readonly ConversationTemplate[] {
    const normalized = query.toLowerCase();
    return this.listActive().filter(
      (t) =>
        t.name.toLowerCase().includes(normalized) ||
        t.description.toLowerCase().includes(normalized),
    );
  }

  /**
   * Register built-in conversation templates
   */
  private registerBuiltInTemplates(): void {
    // Task Creation Template
    this.register({
      templateId: "task_create_standard",
      name: "标准任务创建",
      description: "引导用户完成标准任务创建流程",
      version: "1.0",
      intent: "task_create",
      steps: [
        {
          stepId: "title",
          prompt: "请描述您要创建的任务标题：",
          expectedEntities: [] as string[],
          isRequired: true,
          allowSkip: false,
        },
        {
          stepId: "description",
          prompt: "请详细描述任务内容：",
          expectedEntities: [] as string[],
          isRequired: false,
          allowSkip: true,
        },
        {
          stepId: "priority",
          prompt: "任务的优先级是什么？（高/中/低）",
          expectedEntities: ["priority"],
          isRequired: false,
          allowSkip: true,
        },
        {
          stepId: "deadline",
          prompt: "任务的截止日期是什么时候？",
          expectedEntities: ["date"],
          isRequired: false,
          allowSkip: true,
        },
        {
          stepId: "confirm",
          prompt: "请确认任务信息无误，我将为您创建：",
          expectedEntities: [] as string[],
          isRequired: true,
          allowSkip: false,
        },
      ],
      estimatedDurationMinutes: 3,
      tags: ["task", "creation", "onboarding"],
    });

    // Task Query Template
    this.register({
      templateId: "task_query_status",
      name: "任务状态查询",
      description: "查询任务当前状态和进度",
      version: "1.0",
      intent: "task_query",
      steps: [
        {
          stepId: "task_id",
          prompt: "请提供要查询的任务ID或任务标题：",
          expectedEntities: ["taskId"],
          isRequired: true,
          allowSkip: false,
        },
        {
          stepId: "detail_level",
          prompt: "需要了解哪些信息？（状态/进度/详情）",
          expectedEntities: [] as string[],
          isRequired: false,
          allowSkip: true,
        },
      ],
      estimatedDurationMinutes: 1,
      tags: ["task", "query", "status"],
    });

    // Task Modification Template
    this.register({
      templateId: "task_modify_update",
      name: "任务修改",
      description: "修改已有任务的内容或状态",
      version: "1.0",
      intent: "task_modify",
      steps: [
        {
          stepId: "identify",
          prompt: "请提供要修改的任务ID：",
          expectedEntities: ["taskId"],
          isRequired: true,
          allowSkip: false,
        },
        {
          stepId: "field",
          prompt: "您想修改任务的哪个字段？（状态/优先级/截止日期/描述）",
          expectedEntities: [] as string[],
          isRequired: true,
          allowSkip: false,
        },
        {
          stepId: "new_value",
          prompt: "请提供新的值：",
          expectedEntities: [] as string[],
          isRequired: true,
          allowSkip: false,
        },
        {
          stepId: "confirm",
          prompt: "确定要应用这些修改吗？",
          expectedEntities: [] as string[],
          isRequired: true,
          allowSkip: false,
        },
      ],
      estimatedDurationMinutes: 2,
      tags: ["task", "modification", "update"],
    });

    // Approval Action Template
    this.register({
      templateId: "approval_request",
      name: "审批请求",
      description: "发起或处理审批请求",
      version: "1.0",
      intent: "approval_action",
      steps: [
        {
          stepId: "approval_type",
          prompt: "请选择审批类型（发起/查看/批准/拒绝）：",
          expectedEntities: [] as string[],
          isRequired: true,
          allowSkip: false,
        },
        {
          stepId: "target",
          prompt: "请提供关联的资源或任务ID：",
          expectedEntities: ["taskId"],
          isRequired: true,
          allowSkip: false,
        },
        {
          stepId: "reason",
          prompt: "请提供审批理由或备注：",
          expectedEntities: [] as string[],
          isRequired: false,
          allowSkip: true,
        },
        {
          stepId: "confirm",
          prompt: "请确认提交审批：",
          expectedEntities: [] as string[],
          isRequired: true,
          allowSkip: false,
        },
      ],
      estimatedDurationMinutes: 2,
      tags: ["approval", "workflow"],
    });

    // Status Inquiry Template
    this.register({
      templateId: "status_inquiry_general",
      name: "状态查询",
      description: "通用状态查询对话",
      version: "1.0",
      intent: "status_inquiry",
      steps: [
        {
          stepId: "scope",
          prompt: "您想查询什么的状态？（任务/工作流/系统/用户）",
          expectedEntities: [] as string[],
          isRequired: true,
          allowSkip: false,
        },
        {
          stepId: "identifier",
          prompt: "请提供具体的ID或名称：",
          expectedEntities: [] as string[],
          isRequired: true,
          allowSkip: false,
        },
      ],
      estimatedDurationMinutes: 1,
      tags: ["status", "inquiry"],
    });
  }
}

/**
 * Conversation template executor
 */
export class ConversationTemplateExecutor {
  private readonly registry: ConversationTemplateRegistry;

  public constructor(registry?: ConversationTemplateRegistry) {
    this.registry = registry ?? new ConversationTemplateRegistry();
  }

  /**
   * Get the template registry
   */
  public getRegistry(): ConversationTemplateRegistry {
    return this.registry;
  }

  /**
   * Start a templated conversation
   */
  public start(
    templateId: string,
    initialContext?: Record<string, unknown>,
  ): TemplatedConversation | null {
    const template = this.registry.get(templateId);
    if (!template || !template.isActive) {
      return null;
    }

    return this.buildTemplatedConversation(template, 0, initialContext ?? {});
  }

  /**
   * Get next step in a templated conversation
   * Returns the conversation unchanged if template was deactivated
   */
  public next(
    conversation: TemplatedConversation,
    response?: string,
    context?: Record<string, unknown>,
  ): TemplatedConversation {
    const updatedContext = { ...conversation.context, ...context };

    if (response !== undefined) {
      const currentStep = conversation.steps[conversation.currentStepIndex];
      if (currentStep) {
        updatedContext[currentStep.stepId] = response;
      }
    }

    let nextIndex = conversation.currentStepIndex;
    if (response !== undefined) {
      nextIndex = Math.min(conversation.currentStepIndex + 1, conversation.steps.length);
    }

    // R16-16 FIX: Handle null return from buildTemplatedConversation
    // if template was deactivated/deregistered
    const result = this.buildTemplatedConversation(
      conversation.templateId,
      nextIndex,
      updatedContext,
    );
    // If template not found, return the conversation as-is rather than crashing
    return result ?? conversation;
  }

  /**
   * Skip current step if allowed
   */
  public skip(conversation: TemplatedConversation): TemplatedConversation | null {
    const currentStep = conversation.steps[conversation.currentStepIndex];
    if (!currentStep?.allowSkip) {
      return null;
    }

    const nextIndex = Math.min(
      conversation.currentStepIndex + 1,
      conversation.steps.length,
    );

    return this.buildTemplatedConversation(
      conversation.templateId,
      nextIndex,
      conversation.context,
    );
  }

  /**
   * Build a templated conversation from a template
   * Returns null if template is not found (e.g., deactivated or deregistered)
   */
  private buildTemplatedConversation(
    templateIdOrTemplate: string | ConversationTemplate,
    stepIndex: number,
    context: Record<string, unknown>,
  ): TemplatedConversation | null {
    const template =
      typeof templateIdOrTemplate === "string"
        ? this.registry.get(templateIdOrTemplate)
        : templateIdOrTemplate;

    // R16-16 FIX: Return null instead of throwing if template not found
    // This handles the case where a template was deactivated/deregistered
    // after a conversation was started
    if (!template) {
      return null;
    }

    const isComplete = stepIndex >= template.steps.length;
    const currentStep = template.steps[stepIndex];
    const progress = template.steps.length > 0
      ? Math.round((stepIndex / template.steps.length) * 100)
      : 100;

    const result: TemplatedConversation = {
      templateId: template.templateId,
      currentStepIndex: stepIndex,
      steps: template.steps,
      context,
      progress,
      isComplete,
      ...(currentStep ? { nextPrompt: currentStep.prompt } : {}),
    };
    return result;
  }
}
