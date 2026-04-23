/**
 * AsyncMarketplaceRepository - Async data access for marketplace reviews, publications, and extension packages.
 */
import type { ExtensionPackageRecord, MarketplaceGovernanceReportRecord, MarketplacePublicationRecord, MarketplaceReviewRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncMarketplaceRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    upsertMarketplaceReview(record: MarketplaceReviewRecord): Promise<void>;
    upsertMarketplacePublication(record: MarketplacePublicationRecord): Promise<void>;
    insertMarketplaceGovernanceReport(record: MarketplaceGovernanceReportRecord): Promise<void>;
    upsertExtensionPackage(record: ExtensionPackageRecord): Promise<void>;
    getExtensionPackage(packageId: string, tenantId?: string | null): Promise<ExtensionPackageRecord | null>;
    listExtensionPackages(limit?: number, tenantId?: string | null): Promise<ExtensionPackageRecord[]>;
    getMarketplaceReview(reviewId: string, tenantId?: string | null): Promise<MarketplaceReviewRecord | null>;
    listMarketplaceReviews(limit?: number, tenantId?: string | null): Promise<MarketplaceReviewRecord[]>;
    getLatestMarketplaceReviewForPackage(packageId: string, tenantId?: string | null): Promise<MarketplaceReviewRecord | null>;
    getMarketplacePublication(publicationId: string, tenantId?: string | null): Promise<MarketplacePublicationRecord | null>;
    getActiveMarketplacePublicationForPackage(packageId: string, tenantId?: string | null): Promise<MarketplacePublicationRecord | null>;
    listMarketplacePublications(limit?: number, tenantId?: string | null): Promise<MarketplacePublicationRecord[]>;
    listMarketplaceGovernanceReports(limit?: number, tenantId?: string | null): Promise<MarketplaceGovernanceReportRecord[]>;
}
