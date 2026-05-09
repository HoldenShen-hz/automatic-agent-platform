import assert from "node:assert/strict";
import test from "node:test";

import { MarketplaceCatalogEntrySchema } from "../../../../../src/scale-ecosystem/marketplace/catalog/index.js";

test("MarketplaceCatalogEntrySchema accepts reviewing, published, and suspended review statuses", () => {
  const reviewing = MarketplaceCatalogEntrySchema.parse({
    listingId: "listing-reviewing",
    packId: "pack-reviewing",
    title: "Reviewing Listing",
    reviewStatus: "reviewing",
  });
  const published = MarketplaceCatalogEntrySchema.parse({
    listingId: "listing-published",
    packId: "pack-published",
    title: "Published Listing",
    reviewStatus: "published",
  });
  const suspended = MarketplaceCatalogEntrySchema.parse({
    listingId: "listing-suspended",
    packId: "pack-suspended",
    title: "Suspended Listing",
    reviewStatus: "suspended",
  });

  assert.equal(reviewing.reviewStatus, "reviewing");
  assert.equal(published.reviewStatus, "published");
  assert.equal(suspended.reviewStatus, "suspended");
});
