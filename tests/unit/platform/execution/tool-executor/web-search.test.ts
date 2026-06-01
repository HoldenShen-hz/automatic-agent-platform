import test from "node:test";
import assert from "node:assert/strict";
import {
  createWebSearchTool,
  isBlockedHostname,
  decodeHTMLEntities,
  extractSearchResults,
  type WebSearchRequest,
} from "../../../../../src/platform/five-plane-execution/tool-executor/web-search.js";

test("isBlockedHostname blocks private IP patterns [web-search]", () => {
  assert.ok(isBlockedHostname("127.0.0.1"));
  assert.ok(isBlockedHostname("10.0.0.1"));
  assert.ok(isBlockedHostname("172.16.0.1"));
  assert.ok(isBlockedHostname("192.168.0.1"));
  assert.ok(isBlockedHostname("::1"));
  assert.ok(isBlockedHostname("fe80::1"));
  assert.ok(isBlockedHostname("localhost"));
});

test("isBlockedHostname blocks internal domain suffixes [web-search]", () => {
  assert.ok(isBlockedHostname("server.local"));
  assert.ok(isBlockedHostname("host.internal"));
  assert.ok(isBlockedHostname("machine.private"));
});

test("isBlockedHostname allows public hostnames [web-search]", () => {
  assert.ok(!isBlockedHostname("duckduckgo.com"));
  assert.ok(!isBlockedHostname("google.com"));
  assert.ok(!isBlockedHostname("github.com"));
  assert.ok(!isBlockedHostname("8.8.8.8"));
  assert.ok(!isBlockedHostname("1.1.1.1"));
});

test("decodeHTMLEntities decodes common entities [web-search]", () => {
  assert.equal(decodeHTMLEntities("Hello &amp; World"), "Hello & World");
  assert.equal(decodeHTMLEntities("&lt;div&gt;"), "<div>");
  assert.equal(decodeHTMLEntities("&quot;quoted&quot;"), '"quoted"');
  assert.equal(decodeHTMLEntities("&#39;single&#39;"), "'single'");
  assert.equal(decodeHTMLEntities("&nbsp;spaces&nbsp;"), " spaces ");
  assert.equal(decodeHTMLEntities("&#x3C;script&#x3E;"), "<script>");
  assert.equal(decodeHTMLEntities("Tom &amp; Jerry"), "Tom & Jerry");
  assert.equal(decodeHTMLEntities("no entities"), "no entities");
});

test("extractSearchResults parses DuckDuckGo HTML results [web-search]", () => {
  const html = `
    <div class="result">
      <a class="result__a" href="https://example.com/article1">Example Article One</a>
      <a class="result__snippet" href="https://example.com/article1">This is the first snippet about the article.</a>
    </div>
    <div class="result">
      <a class="result__a" href="https://example.com/article2">Example Article Two</a>
      <a class="result__snippet" href="https://example.com/article2">This is the second snippet for another article.</a>
    </div>
    <div class="result">
      <a class="result__a" href="https://example.com/article3">Example Article Three</a>
      <a class="result__snippet" href="https://example.com/article3">Third snippet content.</a>
    </div>
  `;

  const results = extractSearchResults(html, 10);
  assert.equal(results.length, 3);
  assert.equal(results[0]!.title, "Example Article One");
  assert.equal(results[0]!.url, "https://example.com/article1");
  assert.equal(results[0]!.snippet, "This is the first snippet about the article.");
  assert.equal(results[1]!.title, "Example Article Two");
  assert.equal(results[2]!.title, "Example Article Three");
});

test("extractSearchResults respects limit [web-search]", () => {
  const html = `
    <a class="result__a" href="https://example.com/1">Result 1</a>
    <a class="result__snippet" href="https://example.com/1">Snippet 1</a>
    <a class="result__a" href="https://example.com/2">Result 2</a>
    <a class="result__snippet" href="https://example.com/2">Snippet 2</a>
    <a class="result__a" href="https://example.com/3">Result 3</a>
    <a class="result__snippet" href="https://example.com/3">Snippet 3</a>
  `;

  const limited = extractSearchResults(html, 2);
  assert.equal(limited.length, 2);
});

test("extractSearchResults skips non-http and blocked URLs [web-search]", () => {
  const html = `
    <a class="result__a" href="https://good.com/article">Good Article</a>
    <a class="result__snippet" href="https://good.com/article">Good snippet.</a>
    <a class="result__a" href="https://localhost/evil">Evil</a>
    <a class="result__snippet" href="https://localhost/evil">Evil snippet.</a>
    <a class="result__a" href="https://10.0.0.1/internal">Internal</a>
    <a class="result__snippet" href="https://10.0.0.1/internal">Internal snippet.</a>
    <a class="result__a" href="javascript:alert(1)">JS Link</a>
    <a class="result__snippet" href="javascript:alert(1)">JS snippet.</a>
  `;

  const results = extractSearchResults(html, 10);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.url, "https://good.com/article");
});

test("extractSearchResults handles missing snippets gracefully [web-search]", () => {
  const html = `
    <a class="result__a" href="https://example.com/no-snippet">Title Only</a>
  `;

  const results = extractSearchResults(html, 10);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.snippet, "");
});

test("createWebSearchTool returns a tool with correct name [web-search]", () => {
  const tool = createWebSearchTool();
  assert.equal(tool.name, "web_search");
});

test("createWebSearchTool rejects empty query [web-search]", async () => {
  const tool = createWebSearchTool();
  const result = await tool.execute({ query: "" });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "EMPTY_QUERY");
  assert.equal(result.results.length, 0);
  assert.equal(result.count, 0);
});

test("createWebSearchTool rejects whitespace-only query [web-search]", async () => {
  const tool = createWebSearchTool();
  const result = await tool.execute({ query: "   " });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "EMPTY_QUERY");
});

test("extractSearchResults respects the limit parameter and returns up to that many results [web-search]", () => {
  // Build mock HTML with 60 results
  // Note: snippet links use no href so result__a regex only matches result links
  const items: string[] = [];
  for (let i = 1; i <= 60; i++) {
    items.push(`<a class="result__a" href="https://example.com/${i}">Result ${i}</a>`);
    items.push(`<a class="result__snippet">Snippet ${i}</a>`);
  }
  const html = `<html>${items.join("")}</html>`;

  // limit=30 should return exactly 30 results
  const r30 = extractSearchResults(html, 30);
  assert.equal(r30.length, 30, "Should return exactly 30 results when limit=30");
  assert.equal(r30[0]!.title, "Result 1");
  assert.equal(r30[29]!.title, "Result 30");

  // limit=31 should return exactly 31 results (up to available)
  const r31 = extractSearchResults(html, 31);
  assert.equal(r31.length, 31, "Should return exactly 31 results when limit=31");
  assert.equal(r31[30]!.title, "Result 31");

  // limit=100 should return 60 results (all available when HTML has 60)
  const r100 = extractSearchResults(html, 100);
  assert.equal(r100.length, 60, `Should return 60 results when limit=100 and HTML has 60 results, got ${r100.length}`);
});

test("createWebSearchTool caps execute limit at MAX_LIMIT=30 [web-search]", async () => {
  const items: string[] = [];
  for (let i = 1; i <= 60; i++) {
    items.push(`<a class="result__a" href="https://example.com/${i}">Result ${i}</a>`);
    items.push(`<a class="result__snippet">Snippet ${i}</a>`);
  }
  const html = `<html><body>${items.join("")}</body></html>${"x".repeat(600)}`;
  const tool = createWebSearchTool({
    fetchImpl: async () =>
      new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
  });

  const result = await tool.execute({ query: "test", limit: 100 });
  assert.equal(result.success, true);
  assert.equal(result.count, 30);
  assert.equal(result.results.length, 30);
  assert.equal(result.results[0]!.title, "Result 1");
  assert.equal(result.results[29]!.title, "Result 30");
});

test("createWebSearchTool rejects oversized HTML responses [web-search]", async () => {
  const tool = createWebSearchTool({
    fetchImpl: async () =>
      new Response("x".repeat(600_000), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
  });

  const result = await tool.execute({ query: "oversized-response" });
  assert.equal(result.success, false);
  assert.equal(result.errorCode, "BODY_TOO_LARGE");
});
