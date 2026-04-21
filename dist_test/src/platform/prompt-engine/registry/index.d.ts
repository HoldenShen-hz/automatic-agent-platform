export type PromptTemplateChannel = "system" | "developer" | "user";
export interface PromptTemplateVariableSpec {
    key: string;
    required: boolean;
    description?: string;
    defaultValue?: string;
}
export interface PromptTemplateRecord {
    templateKey: string;
    version: string;
    owner: string;
    channel: PromptTemplateChannel;
    fixedPrefix: string;
    domainBlock: string;
    variableSuffixTemplate: string;
    variableSpecs: PromptTemplateVariableSpec[];
    compatibilityTags: string[];
    fixedPrefixHash: string;
    createdAt: string;
    updatedAt: string;
}
export interface PromptTemplateRegistrationInput {
    templateKey: string;
    version: string;
    owner: string;
    channel?: PromptTemplateChannel;
    fixedPrefix: string;
    domainBlock: string;
    variableSuffixTemplate?: string;
    variableSpecs?: PromptTemplateVariableSpec[];
    compatibilityTags?: string[];
}
export declare class PromptTemplateRegistryService {
    private readonly templates;
    registerTemplate(input: PromptTemplateRegistrationInput): PromptTemplateRecord;
    getTemplate(templateKey: string, version: string): PromptTemplateRecord | null;
    listVersions(templateKey: string): PromptTemplateRecord[];
    listTemplates(): PromptTemplateRecord[];
}
export declare function hashPromptPrefix(fixedPrefix: string): string;
