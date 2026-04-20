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

export type DomainPromptTemplate = z.infer<typeof DomainPromptTemplateSchema>;
export type DomainPromptLibrary = z.infer<typeof DomainPromptLibrarySchema>;

export function resolvePromptTemplate(library: DomainPromptLibrary, promptId: string): DomainPromptTemplate | null {
  return library.prompts.find((item) => item.promptId === promptId) ?? null;
}
