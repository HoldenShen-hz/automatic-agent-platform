import { z } from "zod";
export declare const CertificationRecordSchema: z.ZodObject<{
    listingId: z.ZodString;
    certificationId: z.ZodString;
    status: z.ZodEnum<["pending", "approved", "revoked"]>;
    approvedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "approved" | "revoked";
    approvedAt: string | null;
    listingId: string;
    certificationId: string;
}, {
    status: "pending" | "approved" | "revoked";
    listingId: string;
    certificationId: string;
    approvedAt?: string | null | undefined;
}>;
export type CertificationRecord = z.infer<typeof CertificationRecordSchema>;
export declare function isMarketplaceListingCertified(record: CertificationRecord): boolean;
