import { ValidationError } from "../../contracts/errors.js";
import type { PromptTemplateRecord } from "../registry/index.js";

export interface RenderPromptInput {
  template: PromptTemplateRecord;
  variables?: Record<string, string>;
  includeFixedPrefix?: boolean;
  includeDomainBlock?: boolean;
}

export interface RenderedPrompt {
  prompt: string;
  segments: {
    fixedPrefix: string;
    domainBlock: string;
    variableSuffix: string;
  };
  cacheKey: string;
  unresolvedVariables: string[];
}

export class PromptRendererService {
  public render(input: RenderPromptInput): RenderedPrompt {
    const variables = input.variables ?? {};
    const resolvedVariables = new Map<string, string>();
    const unresolvedVariables: string[] = [];

    for (const spec of input.template.variableSpecs) {
      const provided = variables[spec.key]?.trim();
      const resolved = provided?.length ? provided : spec.defaultValue?.trim();
      if (resolved == null || resolved.length === 0) {
        if (spec.required) {
          unresolvedVariables.push(spec.key);
        }
        continue;
      }
      resolvedVariables.set(spec.key, resolved);
    }

    if (unresolvedVariables.length > 0) {
      throw new ValidationError(
        `prompt_renderer.missing_required_variables:${unresolvedVariables.join(",")}`,
        `Prompt rendering requires variables: ${unresolvedVariables.join(", ")}.`,
      );
    }

    const variableSuffix = input.template.variableSuffixTemplate.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key) => {
      return resolvedVariables.get(key) ?? "";
    }).trim();

    const fixedPrefix = input.includeFixedPrefix === false ? "" : input.template.fixedPrefix.trim();
    const domainBlock = input.includeDomainBlock === false ? "" : input.template.domainBlock.trim();
    const prompt = [fixedPrefix, domainBlock, variableSuffix].filter((segment) => segment.length > 0).join("\n\n");

    return {
      prompt,
      segments: { fixedPrefix, domainBlock, variableSuffix },
      cacheKey: `${input.template.templateKey}:${input.template.version}:${input.template.fixedPrefixHash}`,
      unresolvedVariables: [],
    };
  }
}
