import { z } from "zod";
export declare const InteractionTemplateSchema: z.ZodObject<{
    templateId: z.ZodString;
    title: z.ZodString;
    steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    steps: string[];
    templateId: string;
}, {
    title: string;
    templateId: string;
    steps?: string[] | undefined;
}>;
export type InteractionTemplate = z.infer<typeof InteractionTemplateSchema>;
export declare function applyInteractionTemplate(template: InteractionTemplate, overrides?: Partial<InteractionTemplate>): InteractionTemplate;
