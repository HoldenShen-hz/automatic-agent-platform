import { z } from "zod";
export declare const DomainPromptTemplateSchema: z.ZodObject<{
    promptId: z.ZodString;
    stage: z.ZodEnum<["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"]>;
    version: z.ZodString;
    template: z.ZodString;
    guardrails: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    template: string;
    version: string;
    stage: "plan" | "execute" | "release" | "observe" | "assess" | "feedback" | "learn" | "improve";
    promptId: string;
    guardrails: string[];
}, {
    template: string;
    version: string;
    stage: "plan" | "execute" | "release" | "observe" | "assess" | "feedback" | "learn" | "improve";
    promptId: string;
    guardrails?: string[] | undefined;
}>;
export declare const DomainPromptLibrarySchema: z.ZodObject<{
    libraryId: z.ZodString;
    domainId: z.ZodString;
    prompts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        promptId: z.ZodString;
        stage: z.ZodEnum<["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"]>;
        version: z.ZodString;
        template: z.ZodString;
        guardrails: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        template: string;
        version: string;
        stage: "plan" | "execute" | "release" | "observe" | "assess" | "feedback" | "learn" | "improve";
        promptId: string;
        guardrails: string[];
    }, {
        template: string;
        version: string;
        stage: "plan" | "execute" | "release" | "observe" | "assess" | "feedback" | "learn" | "improve";
        promptId: string;
        guardrails?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    domainId: string;
    libraryId: string;
    prompts: {
        template: string;
        version: string;
        stage: "plan" | "execute" | "release" | "observe" | "assess" | "feedback" | "learn" | "improve";
        promptId: string;
        guardrails: string[];
    }[];
}, {
    domainId: string;
    libraryId: string;
    prompts?: {
        template: string;
        version: string;
        stage: "plan" | "execute" | "release" | "observe" | "assess" | "feedback" | "learn" | "improve";
        promptId: string;
        guardrails?: string[] | undefined;
    }[] | undefined;
}>;
export type DomainPromptTemplate = z.infer<typeof DomainPromptTemplateSchema>;
export type DomainPromptLibrary = z.infer<typeof DomainPromptLibrarySchema>;
export declare function resolvePromptTemplate(library: DomainPromptLibrary, promptId: string): DomainPromptTemplate | null;
export * from "./domain-prompt-governance-service.js";
