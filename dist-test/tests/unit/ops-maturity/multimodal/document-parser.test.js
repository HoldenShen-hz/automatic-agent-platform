import assert from "node:assert/strict";
import test from "node:test";
import { countDocumentPages, parseDocument } from "../../../../src/ops-maturity/multimodal/document-parser/index.js";
test("countDocumentPages returns chunk count", () => {
    assert.equal(countDocumentPages([]), 0);
    assert.equal(countDocumentPages(["page1"]), 1);
    assert.equal(countDocumentPages(["page1", "page2"]), 2);
    assert.equal(countDocumentPages(["a", "b", "c", "d"]), 4);
});
test("countDocumentPages handles readonly arrays", () => {
    const readonlyChunks = ["chunk1", "chunk2", "chunk3"];
    assert.equal(countDocumentPages(readonlyChunks), 3);
});
test("parseDocument calculates correct page count", () => {
    const result = parseDocument([]);
    assert.equal(result.pageCount, 0);
    const result2 = parseDocument(["page1"]);
    assert.equal(result2.pageCount, 1);
    const result3 = parseDocument(["page1", "page2", "page3"]);
    assert.equal(result3.pageCount, 3);
});
test("parseDocument extracts headings from first line of each chunk", () => {
    const chunks = [
        "Introduction",
        "Chapter One: Getting Started",
        "Chapter Two: Advanced Topics",
    ];
    const result = parseDocument(chunks);
    assert.deepEqual(result.headings, ["Introduction", "Chapter One: Getting Started", "Chapter Two: Advanced Topics"]);
});
test("parseDocument limits headings to 10", () => {
    const chunks = [
        "Heading1", "Heading2", "Heading3", "Heading4", "Heading5",
        "Heading6", "Heading7", "Heading8", "Heading9", "Heading10",
        "Heading11", "Heading12",
    ];
    const result = parseDocument(chunks);
    assert.equal(result.headings.length, 10);
    assert.deepEqual(result.headings[9], "Heading10");
});
test("parseDocument filters empty lines from headings", () => {
    const chunks = [
        "Valid Heading",
        "",
        "   ",
        "Another Heading",
        "",
    ];
    const result = parseDocument(chunks);
    assert.deepEqual(result.headings, ["Valid Heading", "Another Heading"]);
});
test("parseDocument handles empty first lines as no heading", () => {
    const chunks = [
        "",
        "First non-empty",
    ];
    const result = parseDocument(chunks);
    assert.deepEqual(result.headings, ["First non-empty"]);
});
test("parseDocument counts words correctly across chunks", () => {
    const chunks = ["hello world", "foo bar baz"];
    const result = parseDocument(chunks);
    assert.equal(result.wordCount, 5);
});
test("parseDocument handles single word chunks", () => {
    const result = parseDocument(["hello"]);
    assert.equal(result.wordCount, 1);
});
test("parseDocument handles empty chunks", () => {
    const result = parseDocument(["   ", "  \n  "]);
    assert.equal(result.wordCount, 0);
});
test("parseDocument handles whitespace-only text", () => {
    const result = parseDocument(["hello   world\t\tfoo"]);
    assert.equal(result.wordCount, 3);
});
test("parseDocument handles multiple spaces between words", () => {
    const result = parseDocument(["word1    word2"]);
    assert.equal(result.wordCount, 2);
});
test("parseDocument handles newline within chunk", () => {
    const chunks = ["line1\nline2\nline3"];
    const result = parseDocument(chunks);
    assert.equal(result.headings.length, 1);
    assert.equal(result.headings[0], "line1");
});
test("parseDocument counts words across chunk boundaries", () => {
    const chunks = ["hello", "world"];
    const result = parseDocument(chunks);
    assert.equal(result.wordCount, 2);
});
test("parseDocument handles mixed chunk types", () => {
    const chunks = [
        "Title",
        "Some paragraph text here",
        "",
        "Another Section",
    ];
    const result = parseDocument(chunks);
    assert.equal(result.pageCount, 4);
    assert.equal(result.wordCount, 7);
    assert.deepEqual(result.headings, ["Title", "Some paragraph text here", "Another Section"]);
});
test("parseDocument heading extraction uses first line only", () => {
    const chunks = ["First line\nSecond line\nThird line", "Only one line here"];
    const result = parseDocument(chunks);
    assert.deepEqual(result.headings, ["First line", "Only one line here"]);
});
test("parseDocument trims whitespace from headings", () => {
    const chunks = ["  Leading spaces", "Trailing spaces  ", "  Mixed both  "];
    const result = parseDocument(chunks);
    assert.deepEqual(result.headings, ["Leading spaces", "Trailing spaces", "Mixed both"]);
});
test("parseDocument handles real document structure", () => {
    const chunks = [
        "Table of Contents",
        "1. Introduction to the Platform",
        "2. Getting Started",
        "2.1 Installation",
        "2.2 Configuration",
        "3. Advanced Usage",
        "3.1 Customization",
        "3.2 Integration",
        "4. Troubleshooting",
        "5. Appendix",
        "6. Extra content",
    ];
    const result = parseDocument(chunks);
    assert.equal(result.pageCount, 11);
    assert.equal(result.headings.length, 10);
    assert.deepEqual(result.headings[0], "Table of Contents");
    assert.deepEqual(result.headings[9], "5. Appendix");
});
//# sourceMappingURL=document-parser.test.js.map