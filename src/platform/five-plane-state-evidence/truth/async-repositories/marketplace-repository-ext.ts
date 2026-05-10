/**
 * AsyncMarketplaceListingRepository - Async data access for marketplace tables.
 *
 * Implements §26 storage layer - missing tables: marketplace_listings, pack_reviews, pack_downloads
 */

import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";

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

export class AsyncMarketplaceListingRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  // ================================
  // MARKETPLACE LISTINGS
  // ================================

  public async insertListing(listing: MarketplaceListingRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO marketplace_listings (
        listing_id, pack_id, status, title, description, category, version,
        published_at, deprecated_at, download_count, rating_avg, rating_count,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      listing.listingId,
      listing.packId,
      listing.status,
      listing.title,
      listing.description,
      listing.category,
      listing.version,
      listing.publishedAt,
      listing.deprecatedAt,
      listing.downloadCount,
      listing.ratingAvg,
      listing.ratingCount,
      listing.createdAt,
      listing.updatedAt,
    );
  }

  public async updateListing(input: {
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
  }): Promise<number> {
    const sets = ["updated_at = $1"];
    const values: unknown[] = [input.updatedAt];
    let idx = 2;

    if (input.status !== undefined) { sets.push(`status = $${idx++}`); values.push(input.status); }
    if (input.title !== undefined) { sets.push(`title = $${idx++}`); values.push(input.title); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); values.push(input.description); }
    if (input.category !== undefined) { sets.push(`category = $${idx++}`); values.push(input.category); }
    if (input.version !== undefined) { sets.push(`version = $${idx++}`); values.push(input.version); }
    if (input.publishedAt !== undefined) { sets.push(`published_at = $${idx++}`); values.push(input.publishedAt); }
    if (input.deprecatedAt !== undefined) { sets.push(`deprecated_at = $${idx++}`); values.push(input.deprecatedAt); }
    if (input.downloadCount !== undefined) { sets.push(`download_count = $${idx++}`); values.push(input.downloadCount); }
    if (input.ratingAvg !== undefined) { sets.push(`rating_avg = $${idx++}`); values.push(input.ratingAvg); }
    if (input.ratingCount !== undefined) { sets.push(`rating_count = $${idx++}`); values.push(input.ratingCount); }

    values.push(input.listingId);
    return asyncExecute(
      this.conn,
      `UPDATE marketplace_listings SET ${sets.join(", ")} WHERE listing_id = $${idx}`,
      ...values,
    );
  }

  public async getListing(listingId: string): Promise<MarketplaceListingRecord | null> {
    const result = await asyncQueryOne<MarketplaceListingRecord>(
      this.conn,
      `SELECT
        listing_id AS "listingId",
        pack_id AS "packId",
        status,
        title,
        description,
        category,
        version,
        published_at AS "publishedAt",
        deprecated_at AS "deprecatedAt",
        download_count AS "downloadCount",
        rating_avg AS "ratingAvg",
        rating_count AS "ratingCount",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM marketplace_listings WHERE listing_id = $1`,
      listingId,
    );
    return result ?? null;
  }

  public async listListingsByStatus(status: string): Promise<MarketplaceListingRecord[]> {
    return asyncQueryAll<MarketplaceListingRecord>(
      this.conn,
      `SELECT
        listing_id AS "listingId",
        pack_id AS "packId",
        status,
        title,
        description,
        category,
        version,
        published_at AS "publishedAt",
        deprecated_at AS "deprecatedAt",
        download_count AS "downloadCount",
        rating_avg AS "ratingAvg",
        rating_count AS "ratingCount",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM marketplace_listings WHERE status = $1 ORDER BY download_count DESC`,
      status,
    );
  }

  public async listListingsByCategory(category: string): Promise<MarketplaceListingRecord[]> {
    return asyncQueryAll<MarketplaceListingRecord>(
      this.conn,
      `SELECT
        listing_id AS "listingId",
        pack_id AS "packId",
        status,
        title,
        description,
        category,
        version,
        published_at AS "publishedAt",
        deprecated_at AS "deprecatedAt",
        download_count AS "downloadCount",
        rating_avg AS "ratingAvg",
        rating_count AS "ratingCount",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM marketplace_listings WHERE category = $1 ORDER BY rating_avg DESC`,
      category,
    );
  }

  public async incrementDownloadCount(listingId: string): Promise<number> {
    return asyncExecute(
      this.conn,
      `UPDATE marketplace_listings SET download_count = download_count + 1 WHERE listing_id = $1`,
      listingId,
    );
  }

  public async updateRating(listingId: string, ratingAvg: number, ratingCount: number): Promise<number> {
    return asyncExecute(
      this.conn,
      `UPDATE marketplace_listings SET rating_avg = $1, rating_count = $2 WHERE listing_id = $3`,
      ratingAvg,
      ratingCount,
      listingId,
    );
  }

  // ================================
  // PACK REVIEWS
  // ================================

  public async insertReview(review: PackReviewRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO pack_reviews (
        review_id, listing_id, user_id, rating, title, body,
        helpful_count, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      review.reviewId,
      review.listingId,
      review.userId,
      review.rating,
      review.title,
      review.body,
      review.helpfulCount,
      review.status,
      review.createdAt,
      review.updatedAt,
    );
  }

  public async updateReview(input: {
    reviewId: string;
    rating?: number;
    title?: string | null;
    body?: string | null;
    helpfulCount?: number;
    status?: string;
    updatedAt: string;
  }): Promise<number> {
    const sets = ["updated_at = $1"];
    const values: unknown[] = [input.updatedAt];
    let idx = 2;

    if (input.rating !== undefined) { sets.push(`rating = $${idx++}`); values.push(input.rating); }
    if (input.title !== undefined) { sets.push(`title = $${idx++}`); values.push(input.title); }
    if (input.body !== undefined) { sets.push(`body = $${idx++}`); values.push(input.body); }
    if (input.helpfulCount !== undefined) { sets.push(`helpful_count = $${idx++}`); values.push(input.helpfulCount); }
    if (input.status !== undefined) { sets.push(`status = $${idx++}`); values.push(input.status); }

    values.push(input.reviewId);
    return asyncExecute(
      this.conn,
      `UPDATE pack_reviews SET ${sets.join(", ")} WHERE review_id = $${idx}`,
      ...values,
    );
  }

  public async getReview(reviewId: string): Promise<PackReviewRecord | null> {
    const result = await asyncQueryOne<PackReviewRecord>(
      this.conn,
      `SELECT
        review_id AS "reviewId",
        listing_id AS "listingId",
        user_id AS "userId",
        rating,
        title,
        body,
        helpful_count AS "helpfulCount",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM pack_reviews WHERE review_id = $1`,
      reviewId,
    );
    return result ?? null;
  }

  public async listReviewsByListing(listingId: string): Promise<PackReviewRecord[]> {
    return asyncQueryAll<PackReviewRecord>(
      this.conn,
      `SELECT
        review_id AS "reviewId",
        listing_id AS "listingId",
        user_id AS "userId",
        rating,
        title,
        body,
        helpful_count AS "helpfulCount",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM pack_reviews
       WHERE listing_id = $1 AND status = 'active'
       ORDER BY helpful_count DESC, created_at DESC`,
      listingId,
    );
  }

  public async countReviewsByListing(listingId: string): Promise<number> {
    const result = await asyncQueryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) AS count FROM pack_reviews WHERE listing_id = $1 AND status = 'active'`,
      listingId,
    );
    return result?.count ?? 0;
  }

  // ================================
  // PACK DOWNLOADS
  // ================================

  public async insertDownload(download: PackDownloadRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO pack_downloads (
        download_id, listing_id, tenant_id, user_id, pack_version,
        downloaded_at, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      download.downloadId,
      download.listingId,
      download.tenantId,
      download.userId,
      download.packVersion,
      download.downloadedAt,
      download.source,
    );
  }

  public async listDownloadsByTenant(tenantId: string): Promise<PackDownloadRecord[]> {
    return asyncQueryAll<PackDownloadRecord>(
      this.conn,
      `SELECT
        download_id AS "downloadId",
        listing_id AS "listingId",
        tenant_id AS "tenantId",
        user_id AS "userId",
        pack_version AS "packVersion",
        downloaded_at AS "downloadedAt",
        source
       FROM pack_downloads
       WHERE tenant_id = $1
       ORDER BY downloaded_at DESC`,
      tenantId,
    );
  }

  public async listDownloadsByListing(listingId: string, limit = 100): Promise<PackDownloadRecord[]> {
    const sanitizedLimit = Math.max(1, Math.trunc(limit) || 100);
    return asyncQueryAll<PackDownloadRecord>(
      this.conn,
      `SELECT
        download_id AS "downloadId",
        listing_id AS "listingId",
        tenant_id AS "tenantId",
        user_id AS "userId",
        pack_version AS "packVersion",
        downloaded_at AS "downloadedAt",
        source
       FROM pack_downloads
       WHERE listing_id = $1
       ORDER BY downloaded_at DESC
       LIMIT $2`,
      listingId,
      limit,
    );
  }

  public async countDownloadsByListing(listingId: string): Promise<number> {
    const result = await asyncQueryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) AS count FROM pack_downloads WHERE listing_id = $1`,
      listingId,
    );
    return result?.count ?? 0;
  }
}
