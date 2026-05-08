import { z } from "zod";

export const CertificationRecordSchema = z.object({
  listingId: z.string().min(1),
  certificationId: z.string().min(1),
  status: z.enum(["pending", "approved", "revoked"]),
  approvedAt: z.string().nullable().default(null),
});

export type CertificationRecord = z.infer<typeof CertificationRecordSchema>;

export function isMarketplaceListingCertified(record: CertificationRecord): boolean {
  return record.status === "approved";
}
