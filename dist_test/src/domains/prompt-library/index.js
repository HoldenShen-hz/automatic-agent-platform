import { z } from "zod";
export const DomainPromptTemplateSchema = z.object({
    promptId: z.string().min(1),
    stage: z.enum(["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"]),
    version: z.string().min(1),
    template: z.string().min(1),
    guardrails: z.array(z.string()).default([]),
});
export const DomainPromptLibrarySchema = z.object({
    libraryId: z.string().min(1),
    domainId: z.string().min(1),
    prompts: z.array(DomainPromptTemplateSchema).default([]),
});
export function resolvePromptTemplate(library, promptId) {
    return library.prompts.find((item) => item.promptId === promptId) ?? null;
}
export * from "./domain-prompt-governance-service.js";
//# sourceMappingURL=index.js.map