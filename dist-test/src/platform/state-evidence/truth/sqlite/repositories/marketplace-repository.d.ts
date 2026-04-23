import type { ExtensionPackageRecord, MarketplaceGovernanceReportRecord, MarketplacePublicationRecord, MarketplaceReviewRecord } from "../../../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../sqlite-database.js";
/**
 * Standalone repository boundary for extension package / review / publication /
 * governance records.
 */
export declare class MarketplaceRepository {
    private readonly db;
    constructor(db: AuthoritativeSqlDatabase);
    upsertMarketplaceReview(record: MarketplaceReviewRecord): void;
    upsertMarketplacePublication(record: MarketplacePublicationRecord): void;
    insertMarketplaceGovernanceReport(record: MarketplaceGovernanceReportRecord): void;
    upsertExtensionPackage(record: ExtensionPackageRecord): void;
    getExtensionPackage(packageId: string, tenantId?: string | null): ExtensionPackageRecord | null;
    listExtensionPackages(limit?: number, tenantId?: string | null): ExtensionPackageRecord[];
    getMarketplaceReview(reviewId: string, tenantId?: string | null): MarketplaceReviewRecord | null;
    listMarketplaceReviews(limit?: number, tenantId?: string | null): MarketplaceReviewRecord[];
    getLatestMarketplaceReviewForPackage(packageId: string, tenantId?: string | null): MarketplaceReviewRecord | null;
    getMarketplacePublication(publicationId: string, tenantId?: string | null): MarketplacePublicationRecord | null;
    getActiveMarketplacePublicationForPackage(packageId: string, tenantId?: string | null): MarketplacePublicationRecord | null;
    listMarketplacePublications(limit?: number, tenantId?: string | null): MarketplacePublicationRecord[];
    listMarketplaceGovernanceReports(limit?: number, tenantId?: string | null): MarketplaceGovernanceReportRecord[];
}
