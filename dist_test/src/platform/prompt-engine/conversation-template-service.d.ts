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
export declare const ConversationTemplateStepSchema: z.ZodObject<{
    stepId: z.ZodString;
    prompt: z.ZodString;
    responseTemplate: z.ZodOptional<z.ZodString>;
    expectedEntities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    isRequired: z.ZodDefault<z.ZodBoolean>;
    allowSkip: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    stepId: string;
    prompt: string;
    expectedEntities: string[];
    isRequired: boolean;
    allowSkip: boolean;
    responseTemplate?: string | undefined;
}, {
    stepId: string;
    prompt: string;
    responseTemplate?: string | undefined;
    expectedEntities?: string[] | undefined;
    isRequired?: boolean | undefined;
    allowSkip?: boolean | undefined;
}>;
export type ConversationTemplateStep = z.infer<typeof ConversationTemplateStepSchema>;
/**
 * Conversation template schema
 */
export declare const ConversationTemplateSchema: z.ZodObject<{
    templateId: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    version: z.ZodDefault<z.ZodString>;
    intent: z.ZodEnum<["task_create", "task_query", "task_modify", "status_inquiry", "approval_action", "system_config"]>;
    steps: z.ZodArray<z.ZodObject<{
        stepId: z.ZodString;
        prompt: z.ZodString;
        responseTemplate: z.ZodOptional<z.ZodString>;
        expectedEntities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        isRequired: z.ZodDefault<z.ZodBoolean>;
        allowSkip: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        stepId: string;
        prompt: string;
        expectedEntities: string[];
        isRequired: boolean;
        allowSkip: boolean;
        responseTemplate?: string | undefined;
    }, {
        stepId: string;
        prompt: string;
        responseTemplate?: string | undefined;
        expectedEntities?: string[] | undefined;
        isRequired?: boolean | undefined;
        allowSkip?: boolean | undefined;
    }>, "many">;
    estimatedDurationMinutes: z.ZodDefault<z.ZodNumber>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: string;
    description: string;
    tags: string[];
    steps: {
        stepId: string;
        prompt: string;
        expectedEntities: string[];
        isRequired: boolean;
        allowSkip: boolean;
        responseTemplate?: string | undefined;
    }[];
    intent: "task_create" | "task_query" | "task_modify" | "system_config" | "status_inquiry" | "approval_action";
    templateId: string;
    estimatedDurationMinutes: number;
    isActive: boolean;
}, {
    name: string;
    description: string;
    steps: {
        stepId: string;
        prompt: string;
        responseTemplate?: string | undefined;
        expectedEntities?: string[] | undefined;
        isRequired?: boolean | undefined;
        allowSkip?: boolean | undefined;
    }[];
    intent: "task_create" | "task_query" | "task_modify" | "system_config" | "status_inquiry" | "approval_action";
    templateId: string;
    version?: string | undefined;
    tags?: string[] | undefined;
    estimatedDurationMinutes?: number | undefined;
    isActive?: boolean | undefined;
}>;
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
export declare class ConversationTemplateRegistry {
    private readonly templates;
    constructor(initialTemplates?: readonly ConversationTemplate[]);
    /**
     * Register a conversation template
     */
    register(template: z.input<typeof ConversationTemplateSchema>): void;
    /**
     * Get a template by ID
     */
    get(templateId: string): ConversationTemplate | undefined;
    /**
     * List all active templates
     */
    listActive(): readonly ConversationTemplate[];
    /**
     * List templates by intent type
     */
    listByIntent(intent: ConversationTemplate["intent"]): readonly ConversationTemplate[];
    /**
     * List templates by tag
     */
    listByTag(tag: string): readonly ConversationTemplate[];
    /**
     * Search templates by name or description
     */
    search(query: string): readonly ConversationTemplate[];
    /**
     * Register built-in conversation templates
     */
    private registerBuiltInTemplates;
}
/**
 * Conversation template executor
 */
export declare class ConversationTemplateExecutor {
    private readonly registry;
    constructor(registry?: ConversationTemplateRegistry);
    /**
     * Get the template registry
     */
    getRegistry(): ConversationTemplateRegistry;
    /**
     * Start a templated conversation
     */
    start(templateId: string, initialContext?: Record<string, unknown>): TemplatedConversation | null;
    /**
     * Get next step in a templated conversation
     */
    next(conversation: TemplatedConversation, response?: string, context?: Record<string, unknown>): TemplatedConversation;
    /**
     * Skip current step if allowed
     */
    skip(conversation: TemplatedConversation): TemplatedConversation | null;
    /**
     * Build a templated conversation from a template
     */
    private buildTemplatedConversation;
}
