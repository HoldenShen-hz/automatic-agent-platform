import { z } from "zod";

export const ACPMessageTypeSchema = z.enum([
  "task_request",
  "task_offer",
  "task_accept",
  "task_reject",
  "partial_result",
  "escalation_request",
  "completion_report",
  "takeover_notice",
]);
export type ACPMessageType = z.infer<typeof ACPMessageTypeSchema>;

const ACPMessageBaseSchema = z.object({
  messageId: z.string(),
  idempotency_key: z.string().optional(),
  sequence_no: z.number().int().min(1).optional(),
  expectedPreviousSequence: z.number().int().min(0).optional(),
  messageType: ACPMessageTypeSchema,
  correlation_id: z.string(),
  parent_run_id: z.string(),
  // Keep the §19.1 fields available while remaining backward compatible
  // with legacy ACP messages that predate these additions.
  delegationId: z.string().min(1).optional(),
  childRunId: z.string().min(1).optional(),
  capabilityIntersection: z.array(z.string()).optional(),
  budgetCap: z.number().min(0).optional(),
  dataBoundary: z.string().min(1).optional(),
  deadline: z.string().min(1).optional(),
  depth: z.number().int().min(0).max(255),
  sender_agent_id: z.string(),
  receiver_agent_id: z.string(),
  domain_id: z.string(),
  risk_level: z.number().min(0).max(100),
  budget_remaining: z.number().min(0),
  trace_id: z.string(),
  payload: z.record(z.string(), z.unknown()),
  timestamp: z.string(),
});

export const ACPMessageSchema = ACPMessageBaseSchema.transform((message) => ({
  ...message,
  delegationId: message.delegationId ?? message.parent_run_id,
  childRunId: message.childRunId ?? message.receiver_agent_id,
  capabilityIntersection: message.capabilityIntersection ?? [],
  budgetCap: message.budgetCap ?? message.budget_remaining,
  dataBoundary: message.dataBoundary ?? "default",
  deadline: message.deadline ?? message.timestamp,
}));
export type ACPMessageInput = z.input<typeof ACPMessageSchema>;
export type ACPMessage = z.infer<typeof ACPMessageSchema>;

export const ACPCompletionPayloadSchema = z.object({
  evidence: z.array(z.string()).min(1),
  result_summary: z.string(),
  artifacts: z.array(z.string()).default([]),
});
export type ACPCompletionPayload = z.infer<typeof ACPCompletionPayloadSchema>;
