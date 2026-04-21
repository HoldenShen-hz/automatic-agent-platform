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
export declare class PromptRendererService {
    render(input: RenderPromptInput): RenderedPrompt;
}
