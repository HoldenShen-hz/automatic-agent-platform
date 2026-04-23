import { z } from "zod";
export const CertificationRecordSchema = z.object({
    listingId: z.string().min(1),
    certificationId: z.string().min(1),
    status: z.enum(["pending", "approved", "revoked"]),
    approvedAt: z.string().nullable().default(null),
});
export function isMarketplaceListingCertified(record) {
    return record.status === "approved";
}
//# sourceMappingURL=index.js.map