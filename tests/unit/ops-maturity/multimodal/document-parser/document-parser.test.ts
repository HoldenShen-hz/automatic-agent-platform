import assert from "node:assert/strict";
import test from "node:test";

import {
  countDocumentPages,
  parseDocument,
} from "../../../../../src/ops-maturity/multimodal/document-parser/index.js";

test("countDocumentPages returns chunk count", () => {
  assert.equal(countDocumentPages([]), 0);
  assert.equal(countDocumentPages(["chunk1"]), 1);
  assert.equal(countDocumentPages(["c1", "c2", "c3"]), 3);
});

test("parseDocument empty chunks", () => {
  const result = parseDocument([]);
  assert.equal(result.pageCount, 0);
  assert.equal(result.wordCount, 0);
  assert.deepEqual(result.headings, []);
});

test("parseDocument extracts first line of each chunk as heading", () => {
  const chunks = [
    "Introduction\nSome content here",
    "Getting Started\nInstallation guide",
    "Configuration\nSettings and options",
  ];
  const result = parseDocument(chunks);
  assert.equal(result.pageCount, 3);
  // all words in all chunks: Introduction, Some, content, here, Getting, Started, Installation, guide, Configuration, Settings, and, options
  assert.equal(result.wordCount, 12);
  assert.deepEqual(result.headings, ["Introduction", "Getting Started", "Configuration"]);
});

test("parseDocument limits headings to 10", () => {
  const chunks = Array.from({ length: 20 }, (_, i) => `Heading ${i}\ncontent`);
  const result = parseDocument(chunks);
  assert.equal(result.headings.length, 10);
});

test("parseDocument handles chunk with no newlines", () => {
  const chunks = ["single line chunk"];
  const result = parseDocument(chunks);
  assert.equal(result.pageCount, 1);
  assert.equal(result.wordCount, 3);
  assert.deepEqual(result.headings, ["single line chunk"]);
});

test("parseDocument trims empty first lines", () => {
  const chunks = ["\ncontent", "   \nmore", "Heading\ncontent"];
  const result = parseDocument(chunks);
  // empty first lines ("", "   ") are filtered out, so only "Heading" remains
  assert.equal(result.headings.length, 1);
  assert.equal(result.headings[0], "Heading");
});

test("parseDocument word count includes all chunks", () => {
  const chunks = ["hello world", "foo bar baz"];
  // total words: hello, world, foo, bar, baz = 5
  const result = parseDocument(chunks);
  assert.equal(result.wordCount, 5);
});
