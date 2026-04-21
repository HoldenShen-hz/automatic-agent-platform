export interface ParsedIntentToken {
    readonly intentType: "task_create" | "task_query" | "task_modify" | "status_inquiry" | "approval_action";
    readonly confidence: number;
}
export declare function parseIntentTokens(message: string): ParsedIntentToken[];
