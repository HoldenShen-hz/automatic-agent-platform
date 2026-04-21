/**
 * Conversation Template Config Loader
 *
 * Loads conversation template configuration from config/conversation/templates.json
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";
import { PolicyDeniedError } from "../../../contracts/errors.js";
import { checkSandboxPath, createConfigReadPolicy, type SandboxPolicy } from "../../../control-plane/iam/sandbox-policy.js";
import type { ConversationTemplate } from "./conversation-template-service.js";

const ConversationTemplateConfigSchema = z.object({
  templates: z.array(z.any()),
  defaultTemplateId: z.string().optional(),
  maxStepsPerTemplate: z.number().default(10),
  enableTemplateAutoSelection: z.boolean().default(true),
});

export type ConversationTemplateConfig = z.infer<typeof ConversationTemplateConfigSchema>;

const DEFAULT_CONFIG_PATH = "config/conversation/templates.json";

/**
 * Load conversation template configuration from file
 *
 * @param configPath - Optional path to config file (defaults to config/conversation/templates.json)
 * @param sandboxPolicy - Optional sandbox policy for path validation
 */
export function loadConversationTemplateConfig(
  configPath?: string,
  sandboxPolicy?: SandboxPolicy,
): ConversationTemplateConfig {
  let resolvedPath = resolve(configPath ?? DEFAULT_CONFIG_PATH);

  // Validate path before reading to prevent path traversal attacks
  if (sandboxPolicy != null) {
    const check = checkSandboxPath(sandboxPolicy, resolvedPath);
    if (!check.allowed) {
      throw new PolicyDeniedError(
        check.reasonCode ?? "config.conversation_template_denied",
        check.reasonCode ?? "config.conversation_template_denied",
      );
    }
    resolvedPath = check.normalizedPath;
  }

  try {
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
