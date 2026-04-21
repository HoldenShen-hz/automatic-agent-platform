/**
 * AsyncMarketplaceListingRepository - Async data access for marketplace tables.
 *
 * Implements §26 storage layer - missing tables: marketplace_listings, pack_reviews, pack_downloads
 */
import type { AsyncSqlConnection } from "../async-sql-database.js";
export interface MarketplaceListingRecord {
    listingId: string;
    packId: string;
    status: string;
    title: string;
    description: string | null;
    category: string | null;
    version: string;
    publishedAt: string | null;
    deprecatedAt: string | null;
    downloadCount: number;
    ratingAvg: number;
    ratingCount: number;
    createdAt: string;
    updatedAt: string;
}
export interface PackReviewRecord {
    reviewId: string;
    listingId: string;
    userId: string;
    rating: number;
    title: string | null;
    body: string | null;
    helpfulCount: number;
    status: string;
    createdAt: string;
    updatedAt: string;
}
export interface PackDownloadRecord {
    downloadId: string;
    listingId: string;
    tenantId: string | null;
    userId: string;
    packVersion: string;
    downloadedAt: string;
    source: string | null;
}
export declare class AsyncMarketplaceListingRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertListing(listing: MarketplaceListingRecord): Promise<void>;
    updateListing(input: {
        listingId: string;
        status?: string;
        title?: string;
        description?: string | null;
        category?: string | null;
        version?: string;
        publishedAt?: string | null;
        deprecatedAt?: string | null;
        downloadCount?: number;
        ratingAvg?: number;
        ratingCount?: number;
        updatedAt: string;
    }): Promise<number>;
    getListing(listingId: string): Promise<MarketplaceListingRecord | null>;
    listListingsByStatus(status: string): Promise<MarketplaceListingRecord[]>;
    listListingsByCategory(category: string): Promise<MarketplaceListingRecord[]>;
    incrementDownloadCount(listingId: string): Promise<number>;
    updateRating(listingId: string, ratingAvg: number, ratingCount: number): Promise<number>;
    insertReview(review: PackReviewRecord): Promise<void>;
    updateReview(input: {
        reviewId: string;
        rating?: number;
        title?: string | null;
        body?: string | null;
        helpfulCount?: number;
        status?: string;
        updatedAt: string;
    }): Promise<number>;
    getReview(reviewId: string): Promise<PackReviewRecord | null>;
    listReviewsByListing(listingId: string): Promise<PackReviewRecord[]>;
    countReviewsByListing(listingId: string): Promise<number>;
    insertDownload(download: PackDownloadRecord): Promise<void>;
    listDownloadsByTenant(tenantId: string): Promise<PackDownloadRecord[]>;
    listDownloadsByListing(listingId: string, limit?: number): Promise<PackDownloadRecord[]>;
    countDownloadsByListing(listingId: string): Promise<number>;
}
