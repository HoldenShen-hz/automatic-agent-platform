import { z } from "zod";
export declare const KnowledgeBoundarySchema: z.ZodObject<{
    boundaryId: z.ZodString;
    ownerOrgNodeId: z.ZodString;
    namespaceIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    defaultVisibility: z.ZodDefault<z.ZodEnum<["private", "shared", "public"]>>;
    allowedOrgNodeIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    namespaceIds: string[];
    boundaryId: string;
    ownerOrgNodeId: string;
    defaultVisibility: "public" | "private" | "shared";
    allowedOrgNodeIds: string[];
}, {
    boundaryId: string;
    ownerOrgNodeId: string;
    namespaceIds?: string[] | undefined;
    defaultVisibility?: "public" | "private" | "shared" | undefined;
    allowedOrgNodeIds?: string[] | undefined;
}>;
export type KnowledgeBoundary = z.infer<typeof KnowledgeBoundarySchema>;
export declare function canAccessKnowledgeBoundary(boundary: KnowledgeBoundary, requesterOrgNodeId: string): boolean;
