import { z } from "zod";
import type { KnowledgeBoundary } from "../boundary-manager/index.js";
export declare const KnowledgeShareGrantSchema: z.ZodObject<{
    grantId: z.ZodString;
    boundaryId: z.ZodString;
    requesterOrgNodeId: z.ZodString;
    purpose: z.ZodString;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    expiresAt: string;
    boundaryId: string;
    purpose: string;
    grantId: string;
    requesterOrgNodeId: string;
}, {
    expiresAt: string;
    boundaryId: string;
    purpose: string;
    grantId: string;
    requesterOrgNodeId: string;
}>;
export type KnowledgeShareGrant = z.infer<typeof KnowledgeShareGrantSchema>;
export declare function evaluateKnowledgeShare(boundary: KnowledgeBoundary, requesterOrgNodeId: string, grants: readonly KnowledgeShareGrant[], nowIso: string): boolean;
