import { z } from "zod";
export declare const ACPMessageTypeSchema: z.ZodEnum<["task_request", "task_offer", "task_accept", "task_reject", "partial_result", "escalation_request", "completion_report", "takeover_notice"]>;
export type ACPMessageType = z.infer<typeof ACPMessageTypeSchema>;
export declare const ACPMessageSchema: z.ZodObject<{
    messageId: z.ZodString;
    messageType: z.ZodEnum<["task_request", "task_offer", "task_accept", "task_reject", "partial_result", "escalation_request", "completion_report", "takeover_notice"]>;
    correlation_id: z.ZodString;
    parent_run_id: z.ZodString;
    depth: z.ZodNumber;
    sender_agent_id: z.ZodString;
    receiver_agent_id: z.ZodString;
    domain_id: z.ZodString;
    risk_level: z.ZodNumber;
    budget_remaining: z.ZodNumber;
    trace_id: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    trace_id: string;
    messageType: "task_request" | "task_offer" | "task_accept" | "task_reject" | "partial_result" | "escalation_request" | "completion_report" | "takeover_notice";
    messageId: string;
    payload: Record<string, unknown>;
    timestamp: string;
    risk_level: number;
    depth: number;
    correlation_id: string;
    parent_run_id: string;
    sender_agent_id: string;
    receiver_agent_id: string;
    domain_id: string;
    budget_remaining: number;
}, {
    trace_id: string;
    messageType: "task_request" | "task_offer" | "task_accept" | "task_reject" | "partial_result" | "escalation_request" | "completion_report" | "takeover_notice";
    messageId: string;
    payload: Record<string, unknown>;
    timestamp: string;
    risk_level: number;
    depth: number;
    correlation_id: string;
    parent_run_id: string;
    sender_agent_id: string;
    receiver_agent_id: string;
    domain_id: string;
    budget_remaining: number;
}>;
export type ACPMessage = z.infer<typeof ACPMessageSchema>;
export declare const ACPCompletionPayloadSchema: z.ZodObject<{
    evidence: z.ZodArray<z.ZodString, "many">;
    result_summary: z.ZodString;
    artifacts: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    artifacts: string[];
    evidence: string[];
    result_summary: string;
}, {
    evidence: string[];
    result_summary: string;
    artifacts?: string[] | undefined;
}>;
export type ACPCompletionPayload = z.infer<typeof ACPCompletionPayloadSchema>;
