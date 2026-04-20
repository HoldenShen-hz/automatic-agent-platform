/**
 * Conversation Template Service
 *
 * Provides conversation templates for the UX layer.
 * Implements §45 "对话模板" requirement.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §45
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
  public register(template: ConversationTemplate): void {
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
      intent: "task_create",
      steps: [
        {
          stepId: "title",
          prompt: "请描述您要创建的任务标题：",
          expectedEntities: [],
          isRequired: true,
        },
        {
          stepId: "description",
          prompt: "请详细描述任务内容：",
          expectedEntities: [],
          isRequired: false,
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
          expectedEntities: [],
          isRequired: true,
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
      intent: "task_query",
      steps: [
        {
          stepId: "task_id",
          prompt: "请提供要查询的任务ID或任务标题：",
          expectedEntities: ["taskId"],
          isRequired: true,
        },
        {
          stepId: "detail_level",
          prompt: "需要了解哪些信息？（状态/进度/详情）",
          expectedEntities: [],
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
      intent: "task_modify",
      steps: [
        {
          stepId: "identify",
          prompt: "请提供要修改的任务ID：",
          expectedEntities: ["taskId"],
          isRequired: true,
        },
        {
          stepId: "field",
          prompt: "您想修改任务的哪个字段？（状态/优先级/截止日期/描述）",
          expectedEntities: [],
          isRequired: true,
        },
        {
          stepId: "new_value",
          prompt: "请提供新的值：",
          expectedEntities: [],
          isRequired: true,
        },
        {
          stepId: "confirm",
          prompt: "确定要应用这些修改吗？",
          expectedEntities: [],
          isRequired: true,
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
      intent: "approval_action",
      steps: [
        {
          stepId: "approval_type",
          prompt: "请选择审批类型（发起/查看/批准/拒绝）：",
          expectedEntities: [],
          isRequired: true,
        },
        {
          stepId: "target",
          prompt: "请提供关联的资源或任务ID：",
          expectedEntities: ["taskId"],
          isRequired: true,
        },
        {
          stepId: "reason",
          prompt: "请提供审批理由或备注：",
          expectedEntities: [],
          isRequired: false,
          allowSkip: true,
        },
        {
          stepId: "confirm",
          prompt: "请确认提交审批：",
          expectedEntities: [],
          isRequired: true,
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
      intent: "status_inquiry",
      steps: [
        {
          stepId: "scope",
          prompt: "您想查询什么的状态？（任务/工作流/系统/用户）",
          expectedEntities: [],
          isRequired: true,
        },
        {
          stepId: "identifier",
          prompt: "请提供具体的ID或名称：",
          expectedEntities: [],
          isRequired: true,
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
   */
  public next(
    conversation: TemplatedConversation,
    response?: string,
    context?: Record<string, unknown>,
  ): TemplatedConversation {
    const updatedContext = { ...conversation.context, ...context };

    if (response !== undefined) {
      const currentStep = conversation.steps[conversation.currentStepIndex];
      updatedContext[currentStep?.stepId] = response;
    }

    let nextIndex = conversation.currentStepIndex;
    if (response !== undefined) {
      nextIndex = Math.min(conversation.currentStepIndex + 1, conversation.steps.length);
    }

    return this.buildTemplatedConversation(
      conversation.templateId,
      nextIndex,
      updatedContext,
    );
  }

  /**
   * Skip current step if allowed
   */
  public skip(conversation: TemplatedConversation): TemplatedConversation | null {
    const currentStep = conversation.steps[conversation.currentStepIndex];
    if (!currentStep?.allowSkip) {
      return null;
    }

    return this.next(conversation);
  }

  /**
   * Build a templated conversation from a template
   */
  private buildTemplatedConversation(
    templateIdOrTemplate: string | ConversationTemplate,
    stepIndex: number,
    context: Record<string, unknown>,
  ): TemplatedConversation {
    const template =
      typeof templateIdOrTemplate === "string"
        ? this.registry.get(templateIdOrTemplate)
        : templateIdOrTemplate;

    if (!template) {
      throw new Error(`Template not found: ${templateIdOrTemplate}`);
    }

    const isComplete = stepIndex >= template.steps.length;
    const currentStep = template.steps[stepIndex];
    const progress = template.steps.length > 0
      ? Math.round((stepIndex / template.steps.length) * 100)
      : 100;

    return {
      templateId: template.templateId,
      currentStepIndex: stepIndex,
      steps: template.steps,
      context,
      progress,
      isComplete,
      nextPrompt: currentStep?.prompt,
    };
  }
}
