import { z } from "zod";
export declare const ScimProvisioningEventSchema: z.ZodObject<{
    eventId: z.ZodString;
    action: z.ZodEnum<["user_created", "user_updated", "user_disabled", "user_deleted", "group_updated"]>;
    subjectId: z.ZodString;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    occurredAt: string;
    action: "user_created" | "user_updated" | "user_disabled" | "user_deleted" | "group_updated";
    eventId: string;
    subjectId: string;
}, {
    occurredAt: string;
    action: "user_created" | "user_updated" | "user_disabled" | "user_deleted" | "group_updated";
    eventId: string;
    subjectId: string;
}>;
export type ScimProvisioningEvent = z.infer<typeof ScimProvisioningEventSchema>;
export declare function isTerminalScimAction(action: ScimProvisioningEvent["action"]): boolean;
