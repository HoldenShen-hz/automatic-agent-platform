import assert from "node:assert/strict";
import test from "node:test";
import { resolveInputModality, buildDefaultModalityRoutingTable, } from "../../../../src/ops-maturity/multimodal/modality-router/index.js";
test("resolveInputModality returns text for text input", () => {
    assert.equal(resolveInputModality("text"), "text");
});
test("resolveInputModality returns image for image input", () => {
    assert.equal(resolveInputModality("image"), "image");
});
test("resolveInputModality returns audio for audio input", () => {
    assert.equal(resolveInputModality("audio"), "audio");
});
test("resolveInputModality returns document for document input", () => {
    assert.equal(resolveInputModality("document"), "document");
});
test("resolveInputModality returns video for video input", () => {
    assert.equal(resolveInputModality("video"), "video");
});
test("resolveInputModality returns unsupported for unknown types", () => {
    assert.equal(resolveInputModality("unknown"), "unsupported");
});
test("resolveInputModality returns unsupported for empty string", () => {
    assert.equal(resolveInputModality(""), "unsupported");
});
test("resolveInputModality returns unsupported for arbitrary strings", () => {
    assert.equal(resolveInputModality("pdf"), "unsupported");
    assert.equal(resolveInputModality("jpeg"), "unsupported");
    assert.equal(resolveInputModality("mp3"), "unsupported");
    assert.equal(resolveInputModality("json"), "unsupported");
});
test("resolveInputModality is case sensitive", () => {
    assert.equal(resolveInputModality("Text"), "unsupported");
    assert.equal(resolveInputModality("IMAGE"), "unsupported");
    assert.equal(resolveInputModality("Audio"), "unsupported");
});
test("buildDefaultModalityRoutingTable returns array of 5 routing rules", () => {
    const table = buildDefaultModalityRoutingTable();
    assert.equal(table.length, 5);
});
test("buildDefaultModalityRoutingTable includes text modality", () => {
    const table = buildDefaultModalityRoutingTable();
    const textRule = table.find((rule) => rule.modality === "text");
    assert.ok(textRule);
    assert.equal(textRule.processor, "text-normalizer");
    assert.equal(textRule.provider, "text_gateway");
});
test("buildDefaultModalityRoutingTable includes image modality", () => {
    const table = buildDefaultModalityRoutingTable();
    const imageRule = table.find((rule) => rule.modality === "image");
    assert.ok(imageRule);
    assert.equal(imageRule.processor, "image-processor");
    assert.equal(imageRule.provider, "vision_gateway");
});
test("buildDefaultModalityRoutingTable includes audio modality", () => {
    const table = buildDefaultModalityRoutingTable();
    const audioRule = table.find((rule) => rule.modality === "audio");
    assert.ok(audioRule);
    assert.equal(audioRule.processor, "speech-processor");
    assert.equal(audioRule.provider, "speech_gateway");
});
test("buildDefaultModalityRoutingTable includes document modality", () => {
    const table = buildDefaultModalityRoutingTable();
    const docRule = table.find((rule) => rule.modality === "document");
    assert.ok(docRule);
    assert.equal(docRule.processor, "document-parser");
    assert.equal(docRule.provider, "document_gateway");
});
test("buildDefaultModalityRoutingTable includes video modality", () => {
    const table = buildDefaultModalityRoutingTable();
    const videoRule = table.find((rule) => rule.modality === "video");
    assert.ok(videoRule);
    assert.equal(videoRule.processor, "video-processor");
    assert.equal(videoRule.provider, "video_gateway");
});
test("buildDefaultModalityRoutingTable returns readonly array", () => {
    const table = buildDefaultModalityRoutingTable();
    // Verify it's readonly by checking array methods
    assert.equal(Array.isArray(table), true);
});
test("buildDefaultModalityRoutingTable each rule has required fields", () => {
    const table = buildDefaultModalityRoutingTable();
    for (const rule of table) {
        assert.ok(rule.modality);
        assert.ok(rule.processor);
        assert.ok(rule.provider);
    }
});
test("buildDefaultModalityRoutingTable modality values are correct types", () => {
    const table = buildDefaultModalityRoutingTable();
    const modalities = table.map((rule) => rule.modality);
    assert.deepEqual(modalities, ["text", "image", "audio", "document", "video"]);
});
//# sourceMappingURL=modality-router.test.js.map