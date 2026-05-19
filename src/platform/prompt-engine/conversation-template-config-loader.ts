/**
 * Conversation Template Config Loader
 *
 * Loads conversation template configuration from config/conversation/templates.json
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";
import {
  ConversationTemplateSchema,
  type ConversationTemplate,
} from "./conversation-template-service.js";

const ConversationTemplateConfigSchema = z.object({
  templates: z.array(ConversationTemplateSchema),
  defaultTemplateId: z.string().optional(),
  maxStepsPerTemplate: z.number().default(10),
  enableTemplateAutoSelection: z.boolean().default(true),
});

export type ConversationTemplateConfig = z.infer<typeof ConversationTemplateConfigSchema>;

const DEFAULT_CONFIG_PATH = "config/conversation/templates.json";

/**
 * Load conversation template configuration from file
 */
export function loadConversationTemplateConfig(
  configPath?: string,
): ConversationTemplateConfig {
  try {
    const resolvedPath = resolve(configPath ?? DEFAULT_CONFIG_PATH);
    const content = readFileSync(resolvedPath, "utf-8");
    const parsed = JSON.parse(content);
    return ConversationTemplateConfigSchema.parse(parsed);
  } catch {
    return {
      templates: [],
      maxStepsPerTemplate: 10,
      enableTemplateAutoSelection: true,
    };
  }
}

/**
 * Get templates from config
 */
export function getTemplatesFromConfig(
  config: ConversationTemplateConfig,
): readonly ConversationTemplate[] {
  return config.templates as readonly ConversationTemplate[];
}
