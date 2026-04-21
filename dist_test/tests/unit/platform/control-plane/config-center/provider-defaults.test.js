import assert from "node:assert/strict";
import test from "node:test";
import { ANTHROPIC_API_URL, OPENAI_API_URL, MINIMAX_API_URL_GLOBAL, MINIMAX_API_URL_CHINA, STRIPE_API_URL, PADDLE_API_URL, TELEGRAM_API_URL, SLACK_API_URL, } from "../../../../../src/platform/control-plane/config-center/provider-defaults.js";
test("ANTHROPIC_API_URL is correct", () => {
    assert.equal(ANTHROPIC_API_URL, "https://api.anthropic.com");
});
test("OPENAI_API_URL is correct", () => {
    assert.equal(OPENAI_API_URL, "https://api.openai.com");
});
test("MINIMAX_API_URL_GLOBAL is correct", () => {
    assert.equal(MINIMAX_API_URL_GLOBAL, "https://api.minimaxi.chat");
});
test("MINIMAX_API_URL_CHINA is correct", () => {
    assert.equal(MINIMAX_API_URL_CHINA, "https://api.minimax.io");
});
test("STRIPE_API_URL is correct", () => {
    assert.equal(STRIPE_API_URL, "https://api.stripe.com/v1");
});
test("PADDLE_API_URL is correct", () => {
    assert.equal(PADDLE_API_URL, "https://api.paddle.com");
});
test("TELEGRAM_API_URL is correct", () => {
    assert.equal(TELEGRAM_API_URL, "https://api.telegram.org");
});
test("SLACK_API_URL is correct", () => {
    assert.equal(SLACK_API_URL, "https://slack.com/api");
});
test("All URLs use https protocol", () => {
    const urls = [
        ANTHROPIC_API_URL,
        OPENAI_API_URL,
        MINIMAX_API_URL_GLOBAL,
        MINIMAX_API_URL_CHINA,
        STRIPE_API_URL,
        PADDLE_API_URL,
        TELEGRAM_API_URL,
        SLACK_API_URL,
    ];
    for (const url of urls) {
        assert.ok(url.startsWith("https://"), `${url} should use https`);
    }
});
//# sourceMappingURL=provider-defaults.test.js.map