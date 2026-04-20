import { z } from "zod";

export const ScimProvisioningEventSchema = z.object({
  eventId: z.string().min(1),
  action: z.enum(["user_created", "user_updated", "user_disabled", "user_deleted", "group_updated"]),
  subjectId: z.string().min(1),
  occurredAt: z.string().min(1),
});

export type ScimProvisioningEvent = z.infer<typeof ScimProvisioningEventSchema>;

export function isTerminalScimAction(action: ScimProvisioningEvent["action"]): boolean {
  return action === "user_disabled" || action === "user_deleted";
}
