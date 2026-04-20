import { z } from "zod";

export const KnowledgeAccessLogRecordSchema = z.object({
  recordId: z.string().min(1),
  requesterId: z.string().min(1),
  boundaryId: z.string().min(1),
  purpose: z.string().min(1),
  allowed: z.boolean(),
  occurredAt: z.string().min(1),
});

export type KnowledgeAccessLogRecord = z.infer<typeof KnowledgeAccessLogRecordSchema>;

export function redactKnowledgeAccessLog(record: KnowledgeAccessLogRecord): KnowledgeAccessLogRecord {
  return {
    ...record,
    requesterId: `redacted:${record.requesterId.slice(0, 4)}`,
  };
}
