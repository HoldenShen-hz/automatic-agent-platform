import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  ContentTypeValidation,
  validateContentType,
  readValidatedJsonBody,
  DEFAULT_CONTENT_TYPE_CONFIG,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/input-validation.js";

test("ContentTypeValidation.validate allows OPTIONS without body", () => {
  const validator = new ContentTypeValidation();
  assert.equal(validator.validate("OPTIONS", undefined, false), true);
});

test("ContentTypeValidation.validate allows GET without body", () => {
  const validator = new ContentTypeValidation();
  assert.equal(validator.validate("GET", undefined, false), true);
});

test("ContentTypeValidation.validate allows DELETE without body", () => {
  const validator = new ContentTypeValidation();
  assert.equal(validator.validate("DELETE", undefined, false), true);
});

test("ContentTypeValidation.validate rejects POST without content-type when required", () => {
  const validator = new ContentTypeValidation({ requireContentType: true });
  assert.equal(validator.validate("POST", undefined, true), false);
});

test("ContentTypeValidation.validate allows POST with application/json", () => {
  const validator = new ContentTypeValidation();
  assert.equal(validator.validate("POST", "application/json", true), true);
});

test("ContentTypeValidation.validate rejects POST with text/plain", () => {
  const validator = new ContentTypeValidation();
  assert.equal(validator.validate("POST", "text/plain", true), false);
});

test("ContentTypeValidation.validate strips charset parameter", () => {
  const validator = new ContentTypeValidation();
  assert.equal(validator.validate("POST", "application/json; charset=utf-8", true), true);
});

test("ContentTypeValidation.validate is case insensitive", () => {
  const validator = new ContentTypeValidation();
  assert.equal(validator.validate("POST", "APPLICATION/JSON", true), true);
});

test("ContentTypeValidation.validate allows multiple allowed content types", () => {
  const validator = new ContentTypeValidation({
    allowedContentTypes: ["application/json", "application/vnd.api+json"],
  });
  assert.equal(validator.validate("POST", "application/vnd.api+json", true), true);
});

test("ContentTypeValidation.getErrorResponse returns 415", () => {
  const validator = new ContentTypeValidation();
  const error = validator.getErrorResponse();
  assert.equal(error.statusCode, 415);
  assert.equal(error.code, "api.unsupported_media_type");
});

test("ContentTypeValidation constructor merges partial config", () => {
  const validator = new ContentTypeValidation({
    allowedContentTypes: ["application/xml"],
  });
  assert.equal(validator.validate("POST", "application/json", true), false);
  assert.equal(validator.validate("POST", "application/xml", true), true);
});

test("validateContentType function wraps global validator", () => {
  const result = validateContentType("POST", "application/json", true);
  assert.equal(result, null); // null means valid
});

test("validateContentType function returns error for invalid content type", () => {
  const result = validateContentType("POST", "text/plain", true);
  assert.ok(result !== null);
  assert.equal(result!.code, "api.unsupported_media_type");
});

test("readValidatedJsonBody parses and sanitizes JSON", () => {
  const parser = (value: unknown) => {
    if (typeof value !== "object" || value === null) {
      throw new Error("Expected object");
    }
    return value as { name: string };
  };

  const result = readValidatedJsonBody('{"name":"test"}', parser);
  assert.equal(result.name, "test");
});

test("readValidatedJsonBody handles empty/null body as empty object", () => {
  const parser = (value: unknown) => value;

  // readJsonBody returns {} for null/undefined
  assert.deepEqual(readValidatedJsonBody(null, parser), {});
  assert.deepEqual(readValidatedJsonBody(undefined, parser), {});
});

test("DEFAULT_CONTENT_TYPE_CONFIG has secure defaults", () => {
  assert.deepEqual(DEFAULT_CONTENT_TYPE_CONFIG.allowedContentTypes, ["application/json"]);
  assert.equal(DEFAULT_CONTENT_TYPE_CONFIG.requireContentType, true);
});