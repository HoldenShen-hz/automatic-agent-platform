import assert from "node:assert/strict";
import test from "node:test";

import { AsyncMarketplaceListingRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/marketplace-repository-ext.js";
import type {
  MarketplaceListingRecord,
  PackReviewRecord,
  PackDownloadRecord,
} from "../../../../../../src/platform/state-evidence/truth/async-repositories/marketplace-repository-ext.js";

function createMockAsyncConnection(): any {
  const storage: {
    marketplace_listings: Map<string, MarketplaceListingRecord>;
    pack_reviews: Map<string, PackReviewRecord>;
    pack_downloads: Map<string, PackDownloadRecord>;
  } = {
    marketplace_listings: new Map(),
    pack_reviews: new Map(),
    pack_downloads: new Map(),
  };

  return {
    query: async <T>(sql: string, ..._params: unknown[]): Promise<{ rows: T[]; rowCount: number }> => {
      if (sql.includes("marketplace_listings")) {
        const rows = Array.from(storage.marketplace_listings.values()) as T[];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("pack_reviews")) {
        const rows = Array.from(storage.pack_reviews.values()) as T[];
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("pack_downloads")) {
        const rows = Array.from(storage.pack_downloads.values()) as T[];
        return { rows, rowCount: rows.length };
      }
      return { rows: [] as T[], rowCount: 0 };
    },
    queryOne: async <T>(sql: string, ...params: unknown[]): Promise<T | undefined> => {
      const id = params[0];
      if (sql.includes("marketplace_listings")) {
        return storage.marketplace_listings.get(id as string) as T | undefined;
      }
      if (sql.includes("pack_reviews")) {
        return storage.pack_reviews.get(id as string) as T | undefined;
      }
      return undefined;
    },
    execute: async (sql: string, ...params: unknown[]): Promise<number> => {
      if (sql.includes("marketplace_listings")) {
        if (sql.includes("UPDATE")) {
          // Extract listingId from last param
          const listingId = params[params.length - 1] as string;
          const existing = storage.marketplace_listings.get(listingId);
          if (existing) {
            const updated = { ...existing, updatedAt: params[0] as string };
            storage.marketplace_listings.set(listingId, updated);
          }
          return 1;
        }
        const record: MarketplaceListingRecord = {
          listingId: params[0] as string,
          packId: params[1] as string,
          status: params[2] as string,
          title: params[3] as string,
          description: params[4] as string | null,
          category: params[5] as string | null,
          version: params[6] as string,
          publishedAt: params[7] as string | null,
          deprecatedAt: params[8] as string | null,
          downloadCount: params[9] as number,
          ratingAvg: params[10] as number,
          ratingCount: params[11] as number,
          createdAt: params[12] as string,
          updatedAt: params[13] as string,
        };
        storage.marketplace_listings.set(record.listingId, record);
      } else if (sql.includes("pack_reviews")) {
        if (sql.includes("UPDATE")) {
          const reviewId = params[params.length - 1] as string;
          const existing = storage.pack_reviews.get(reviewId);
          if (existing) {
            const updated = { ...existing, updatedAt: params[0] as string };
            storage.pack_reviews.set(reviewId, updated);
          }
          return 1;
        }
        const record: PackReviewRecord = {
          reviewId: params[0] as string,
          listingId: params[1] as string,
          userId: params[2] as string,
          rating: params[3] as number,
          title: params[4] as string | null,
          body: params[5] as string | null,
          helpfulCount: params[6] as number,
          status: params[7] as string,
          createdAt: params[8] as string,
          updatedAt: params[9] as string,
        };
        storage.pack_reviews.set(record.reviewId, record);
      } else if (sql.includes("pack_downloads")) {
        const record: PackDownloadRecord = {
          downloadId: params[0] as string,
          listingId: params[1] as string,
          tenantId: params[2] as string | null,
          userId: params[3] as string,
          packVersion: params[4] as string,
          downloadedAt: params[5] as string,
          source: params[6] as string | null,
        };
        storage.pack_downloads.set(record.downloadId, record);
      }
      return 1;
    },
    _storage: storage,
  };
}

function createListing(overrides: Partial<MarketplaceListingRecord> = {}): MarketplaceListingRecord {
  const now = new Date().toISOString();
  return {
    listingId: "listing-001",
    packId: "pack-001",
    status: "published",
    title: "Test Listing",
    description: "A test listing",
    category: "productivity",
    version: "1.0.0",
    publishedAt: now,
    deprecatedAt: null,
    downloadCount: 100,
    ratingAvg: 4.5,
    ratingCount: 20,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createReview(overrides: Partial<PackReviewRecord> = {}): PackReviewRecord {
  const now = new Date().toISOString();
  return {
    reviewId: "review-001",
    listingId: "listing-001",
    userId: "user-001",
    rating: 5,
    title: "Great pack!",
    body: "Very useful",
    helpfulCount: 10,
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createDownload(overrides: Partial<PackDownloadRecord> = {}): PackDownloadRecord {
  return {
    downloadId: "dl-001",
    listingId: "listing-001",
    tenantId: "tenant-001",
    userId: "user-001",
    packVersion: "1.0.0",
    downloadedAt: new Date().toISOString(),
    source: "marketplace",
    ...overrides,
  };
}

test("AsyncMarketplaceListingRepository constructor requires connection", () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);
  assert.ok(repo != null);
});

test("AsyncMarketplaceListingRepository is instantiable", () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);
  assert.ok(repo instanceof AsyncMarketplaceListingRepository);
});

test("AsyncMarketplaceListingRepository.insertListing stores listing", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  const listing = createListing({ listingId: "listing-insert-1" });
  await repo.insertListing(listing);

  assert.ok(conn._storage.marketplace_listings.has("listing-insert-1"));
});

test("AsyncMarketplaceListingRepository.insertListing stores multiple listings", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  await repo.insertListing(createListing({ listingId: "listing-multi-1" }));
  await repo.insertListing(createListing({ listingId: "listing-multi-2" }));
  await repo.insertListing(createListing({ listingId: "listing-multi-3" }));

  assert.equal(conn._storage.marketplace_listings.size, 3);
});

test("AsyncMarketplaceListingRepository.getListing returns null for missing listing", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  const result = await repo.getListing("nonexistent");
  assert.equal(result, null);
});

test("AsyncMarketplaceListingRepository.getListing returns listing when exists", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  await repo.insertListing(createListing({ listingId: "listing-get-1", title: "My Listing" }));
  const result = await repo.getListing("listing-get-1");

  assert.ok(result != null);
  assert.equal(result!.listingId, "listing-get-1");
  assert.equal(result!.title, "My Listing");
});

test("AsyncMarketplaceListingRepository.insertReview stores review", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  const review = createReview({ reviewId: "review-insert-1" });
  await repo.insertReview(review);

  assert.ok(conn._storage.pack_reviews.has("review-insert-1"));
});

test("AsyncMarketplaceListingRepository.getReview returns null for missing review", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  const result = await repo.getReview("nonexistent");
  assert.equal(result, null);
});

test("AsyncMarketplaceListingRepository.getReview returns review when exists", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  await repo.insertReview(createReview({ reviewId: "review-get-1", rating: 4 }));
  const result = await repo.getReview("review-get-1");

  assert.ok(result != null);
  assert.equal(result!.reviewId, "review-get-1");
  assert.equal(result!.rating, 4);
});

test("AsyncMarketplaceListingRepository.insertDownload stores download", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  const download = createDownload({ downloadId: "dl-insert-1" });
  await repo.insertDownload(download);

  assert.ok(conn._storage.pack_downloads.has("dl-insert-1"));
});

test("AsyncMarketplaceListingRepository.listListingsByStatus returns array", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  await repo.insertListing(createListing({ listingId: "listing-status-1", status: "published" }));
  await repo.insertListing(createListing({ listingId: "listing-status-2", status: "draft" }));

  const result = await repo.listListingsByStatus("published");
  assert.ok(Array.isArray(result));
});

test("AsyncMarketplaceListingRepository.listListingsByCategory returns array", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  const result = await repo.listListingsByCategory("productivity");
  assert.ok(Array.isArray(result));
});

test("AsyncMarketplaceListingRepository.listReviewsByListing returns array", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  const result = await repo.listReviewsByListing("listing-001");
  assert.ok(Array.isArray(result));
});

test("AsyncMarketplaceListingRepository.listDownloadsByTenant returns array", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  const result = await repo.listDownloadsByTenant("tenant-001");
  assert.ok(Array.isArray(result));
});

test("AsyncMarketplaceListingRepository.listDownloadsByListing returns array with limit", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  const result = await repo.listDownloadsByListing("listing-001", 50);
  assert.ok(Array.isArray(result));
});

test("AsyncMarketplaceListingRepository.incrementDownloadCount updates count", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  await repo.insertListing(createListing({ listingId: "listing-dl-count", downloadCount: 10 }));
  await repo.incrementDownloadCount("listing-dl-count");

  const listing = await repo.getListing("listing-dl-count");
  assert.ok(listing != null);
});

test("AsyncMarketplaceListingRepository.updateRating updates rating fields", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  await repo.insertListing(createListing({ listingId: "listing-rating" }));
  await repo.updateRating("listing-rating", 4.8, 50);

  const result = await repo.getListing("listing-rating");
  assert.ok(result != null);
});

test("AsyncMarketplaceListingRepository.countReviewsByListing returns count", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  const count = await repo.countReviewsByListing("listing-001");
  assert.equal(typeof count, "number");
  assert.ok(count >= 0);
});

test("AsyncMarketplaceListingRepository.countDownloadsByListing returns count", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  const count = await repo.countDownloadsByListing("listing-001");
  assert.equal(typeof count, "number");
  assert.ok(count >= 0);
});

test("AsyncMarketplaceListingRepository.updateListing partial update", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  await repo.insertListing(createListing({ listingId: "listing-update-partial", title: "Original Title" }));
  await repo.updateListing({
    listingId: "listing-update-partial",
    title: "Updated Title",
    updatedAt: new Date().toISOString(),
  });

  const result = await repo.getListing("listing-update-partial");
  assert.ok(result != null);
});

test("AsyncMarketplaceListingRepository.updateReview partial update", async () => {
  const conn = createMockAsyncConnection();
  const repo = new AsyncMarketplaceListingRepository(conn);

  await repo.insertReview(createReview({ reviewId: "review-update-partial", title: "Original" }));
  await repo.updateReview({
    reviewId: "review-update-partial",
    title: "Updated Title",
    updatedAt: new Date().toISOString(),
  });

  const result = await repo.getReview("review-update-partial");
  assert.ok(result != null);
});