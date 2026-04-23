import { z } from "zod";
export const InteractionTemplateSchema = z.object({
    templateId: z.string().min(1),
    title: z.string().min(1),
    steps: z.array(z.string()).default([]),
});
export function applyInteractionTemplate(template, overrides = {}) {
    return InteractionTemplateSchema.parse({
        ...template,
        ...overrides,
    });
}
//# sourceMappingURL=index.js.map