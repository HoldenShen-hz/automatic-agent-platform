/**
 * Conversation Template Config Loader
 *
 * Loads conversation template configuration from config/conversation/templates.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ValidationError } from "../contracts/errors.js";
import {
  ConversationTemplateSchema,
  type ConversationTemplate,
} from "./conversation-template-service.js";

const ConversationTemplateConfigSchema = z.object({
  templates: z.array(ConversationTemplateSchema).default([]),
  defaultTemplateId: z.string().optional(),
  maxStepsPerTemplate: z.number().default(10),
  enableTemplateAutoSelection: z.boolean().default(true),
});

export type ConversationTemplateConfig = z.infer<typeof ConversationTemplateConfigSchema>;

const DEFAULT_CONFIG_PATH = "config/conversation/templates.json";
const MAX_TEMPLATE_CONFIG_BYTES = 1024 * 1024;

function isMissingConfigError(error: unknown): boolean {
  return error != null
    && typeof error === "object"
    && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}

/**
 * Load conversation template configuration from file
 */
export function loadConversationTemplateConfig(
  configPath?: string,
): ConversationTemplateConfig {
  const resolvedPath = resolve(configPath ?? DEFAULT_CONFIG_PATH);
  try {
    const content = readFileSync(resolvedPath, "utf-8");
    if (Buffer.byteLength(content, "utf8") > MAX_TEMPLATE_CONFIG_BYTES) {
      throw new ValidationError(
        "conversation_template_config.too_large",
        "conversation_template_config.too_large",
        { retryable: false, details: { configPath: resolvedPath, maxBytes: MAX_TEMPLATE_CONFIG_BYTES } },
      );
    }
    const parsed = JSON.parse(content);
    const validated = ConversationTemplateConfigSchema.safeParse(parsed);
    if (!validated.success) {
      throw new ValidationError(
        "conversation_template_config.invalid",
        "conversation_template_config.invalid",
        {
          retryable: false,
          details: {
            configPath: resolvedPath,
            issues: validated.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
      );
    }
    return validated.data;
  } catch (error) {
    if (!isMissingConfigError(error)) {
      throw error;
    }
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
  return [...config.templates];
}
