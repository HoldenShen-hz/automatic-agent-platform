/**
 * Conversation Template Config Loader
 *
 * Loads conversation template configuration from config/conversation/templates.json
 */
import { z } from "zod";
import type { ConversationTemplate } from "./conversation-template-service.js";
declare const ConversationTemplateConfigSchema: z.ZodObject<{
    templates: z.ZodArray<z.ZodAny, "many">;
    defaultTemplateId: z.ZodOptional<z.ZodString>;
    maxStepsPerTemplate: z.ZodDefault<z.ZodNumber>;
    enableTemplateAutoSelection: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    templates: any[];
    maxStepsPerTemplate: number;
    enableTemplateAutoSelection: boolean;
    defaultTemplateId?: string | undefined;
}, {
    templates: any[];
    defaultTemplateId?: string | undefined;
    maxStepsPerTemplate?: number | undefined;
    enableTemplateAutoSelection?: boolean | undefined;
}>;
export type ConversationTemplateConfig = z.infer<typeof ConversationTemplateConfigSchema>;
/**
 * Load conversation template configuration from file
 */
export declare function loadConversationTemplateConfig(configPath?: string): ConversationTemplateConfig;
/**
 * Get templates from config
 */
export declare function getTemplatesFromConfig(config: ConversationTemplateConfig): readonly ConversationTemplate[];
export {};
