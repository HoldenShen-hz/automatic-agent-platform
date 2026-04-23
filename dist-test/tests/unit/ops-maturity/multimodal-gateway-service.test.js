import assert from "node:assert/strict";
import test from "node:test";
import { MultimodalGatewayService } from "../../../src/ops-maturity/multimodal/multimodal-gateway-service.js";
test("MultimodalGatewayService builds explicit route decisions for supported modalities", () => {
    const service = new MultimodalGatewayService();
    const result = service.handle({
        requestId: "mm_req_1",
        modalities: ["text", "image", "document"],
        inputParts: [
            { partId: "part_text", type: "text", contentRef: "inline", text: "hello" },
            { partId: "part_image", type: "image", contentRef: "img://1", imageMetadata: { width: 1920, height: 1080 } },
            { partId: "part_doc", type: "document", contentRef: "doc://1", documentChunks: ["a", "b"] },
        ],
        requestedOutputs: ["summary"],
        safetyPolicyRef: "policy_mm_safe",
        costBudget: { maxUsd: 1 },
        traceId: "trace_mm_1",
    }, "2026-04-20T00:00:00.000Z");
    assert.equal(result.routeDecisions.length, 3);
    assert.equal(result.blocked, false);
    assert.equal(result.traceId, "trace_mm_1");
});
test("MultimodalGatewayService blocks unsupported modalities and restricted inputs", () => {
    const service = new MultimodalGatewayService();
    assert.throws(() => {
        service.handle({
            requestId: "mm_req_bad",
            modalities: ["text"],
            inputParts: [{ partId: "part_bad", type: "video", contentRef: "vid://1" }],
            requestedOutputs: ["summary"],
            safetyPolicyRef: "policy_mm_safe",
            costBudget: { maxUsd: 1 },
        });
    }, /multimodal_gateway\.(unsupported_modality|modality_not_declared):video/);
    const blocked = service.handle({
        requestId: "mm_req_blocked",
        modalities: ["image"],
        inputParts: [{
                partId: "part_restricted",
                type: "image",
                contentRef: "img://restricted",
                imageMetadata: { width: 100, height: 100 },
                dataClassification: "restricted",
            }],
        requestedOutputs: ["summary"],
        safetyPolicyRef: "policy_mm_safe",
        costBudget: { maxUsd: 1 },
    });
    assert.equal(blocked.blocked, true);
    assert.ok(blocked.safetyFindings.some((item) => item.reasonCode === "multimodal_gateway.restricted_input_blocked"));
});
//# sourceMappingURL=multimodal-gateway-service.test.js.map