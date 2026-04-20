import { z } from "zod";

export const InteractionTemplateSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1),
  steps: z.array(z.string()).default([]),
});

export type InteractionTemplate = z.infer<typeof InteractionTemplateSchema>;

export function applyInteractionTemplate(template: InteractionTemplate, overrides: Partial<InteractionTemplate> = {}): InteractionTemplate {
  return InteractionTemplateSchema.parse({
    ...template,
    ...overrides,
  });
}
