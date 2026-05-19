import assert from "node:assert/strict";
import test from "node:test";
import { ErasureRequestService, ErasureReportService, DataEncryptionKeyService, DataResidencyService, } from "../../../../../src/platform/control-plane/compliance/index.js";
test("compliance module exports ErasureRequestService constructor", () => {
    assert.ok(typeof ErasureRequestService === "function");
});
test("compliance module exports ErasureReportService constructor", () => {
    assert.ok(typeof ErasureReportService === "function");
});
test("compliance module exports DataEncryptionKeyService constructor", () => {
    assert.ok(typeof DataEncryptionKeyService === "function");
});
test("compliance module exports DataResidencyService constructor", () => {
    assert.ok(typeof DataResidencyService === "function");
});
//# sourceMappingURL=index.test.js.map