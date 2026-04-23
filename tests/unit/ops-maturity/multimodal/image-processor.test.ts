import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeImageAspectRatio,
  analyzeImage,
  type ImageMetadata,
} from "../../../../src/ops-maturity/multimodal/image-processor/index.js";

test("normalizeImageAspectRatio returns 0 when height is 0", () => {
  const metadata: ImageMetadata = { width: 1920, height: 0 };
  assert.equal(normalizeImageAspectRatio(metadata), 0);
});

test("normalizeImageAspectRatio calculates correct ratio for landscape", () => {
  const metadata: ImageMetadata = { width: 1920, height: 1080 };
  assert.equal(normalizeImageAspectRatio(metadata), 1.7778);
});

test("normalizeImageAspectRatio calculates correct ratio for portrait", () => {
  const metadata: ImageMetadata = { width: 1080, height: 1920 };
  assert.equal(normalizeImageAspectRatio(metadata), 0.5625);
});

test("normalizeImageAspectRatio returns 1 for square images", () => {
  const metadata: ImageMetadata = { width: 1000, height: 1000 };
  assert.equal(normalizeImageAspectRatio(metadata), 1);
});

test("normalizeImageAspectRatio rounds to 4 decimal places", () => {
  const metadata: ImageMetadata = { width: 100, height: 300 };
  assert.equal(normalizeImageAspectRatio(metadata), 0.3333);
});

test("normalizeImageAspectRatio handles very small ratios", () => {
  const metadata: ImageMetadata = { width: 1, height: 10000 };
  assert.equal(normalizeImageAspectRatio(metadata), 0.0001);
});

test("normalizeImageAspectRatio handles very large ratios", () => {
  const metadata: ImageMetadata = { width: 10000, height: 1 };
  assert.equal(normalizeImageAspectRatio(metadata), 10000);
});

test("normalizeImageAspectRatio uses toFixed which rounds", () => {
  const metadata: ImageMetadata = { width: 1, height: 3 };
  assert.equal(normalizeImageAspectRatio(metadata), 0.3333);
});

test("analyzeImage returns correct aspect ratio", () => {
  const metadata: ImageMetadata = { width: 1920, height: 1080 };
  const result = analyzeImage(metadata);
  assert.equal(result.aspectRatio, 1.7778);
});

test("analyzeImage returns landscape orientation for wide images", () => {
  const metadata: ImageMetadata = { width: 1920, height: 1080 };
  const result = analyzeImage(metadata);
  assert.equal(result.orientation, "landscape");
});

test("analyzeImage returns portrait orientation for tall images", () => {
  const metadata: ImageMetadata = { width: 1080, height: 1920 };
  const result = analyzeImage(metadata);
  assert.equal(result.orientation, "portrait");
});

test("analyzeImage returns square orientation for equal dimensions", () => {
  const metadata: ImageMetadata = { width: 1000, height: 1000 };
  const result = analyzeImage(metadata);
  assert.equal(result.orientation, "square");
});

test("analyzeImage returns containsText false when not specified", () => {
  const metadata: ImageMetadata = { width: 1920, height: 1080 };
  const result = analyzeImage(metadata);
  assert.equal(result.containsText, false);
});

test("analyzeImage returns containsText true when specified", () => {
  const metadata: ImageMetadata = { width: 1920, height: 1080, containsText: true };
  const result = analyzeImage(metadata);
  assert.equal(result.containsText, true);
});

test("analyzeImage returns containsText false when explicitly set", () => {
  const metadata: ImageMetadata = { width: 1920, height: 1080, containsText: false };
  const result = analyzeImage(metadata);
  assert.equal(result.containsText, false);
});

test("analyzeImage with format metadata is preserved", () => {
  const metadata: ImageMetadata = { width: 1920, height: 1080, format: "png" };
  const result = analyzeImage(metadata);
  assert.equal(result.aspectRatio, 1.7778);
  assert.equal(result.orientation, "landscape");
});

test("analyzeImage edge case zero width", () => {
  const metadata: ImageMetadata = { width: 0, height: 100 };
  const result = analyzeImage(metadata);
  assert.equal(result.aspectRatio, 0);
  assert.equal(result.orientation, "portrait");
});

test("analyzeImage edge case zero height", () => {
  const metadata: ImageMetadata = { width: 100, height: 0 };
  const result = analyzeImage(metadata);
  assert.equal(result.aspectRatio, 0);
  // height 0 means no division by zero error but orientation logic: 100 === 0 is false, 100 > 0 is true (landscape)
  // actually normalize returns 0 for height 0
  assert.equal(result.orientation, "landscape");
});
