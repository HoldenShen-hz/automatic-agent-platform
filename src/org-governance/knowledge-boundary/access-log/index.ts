import { z } from "zod";

export const KnowledgeAccessLogRecordSchema = z.object({
  recordId: z.string().min(1),
  requesterId: z.string().min(1),
  boundaryId: z.string().min(1),
  tenantId: z.string().min(1).nullable().optional(),
  purpose: z.string().min(1),
  allowed: z.boolean(),
  occurredAt: z.string().min(1),
});

export type KnowledgeAccessLogRecord = z.infer<typeof KnowledgeAccessLogRecordSchema>;

export function redactKnowledgeAccessLog(record: KnowledgeAccessLogRecord): KnowledgeAccessLogRecord {
  const requesterId = typeof record.requesterId === "string" ? record.requesterId : String(record.requesterId ?? "");
  return {
    ...record,
    requesterId: `redacted:${requesterId.slice(0, 4)}`,
  };
}
