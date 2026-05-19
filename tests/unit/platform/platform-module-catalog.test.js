import assert from "node:assert/strict";
import test from "node:test";
import { listArchitectureReadinessRings, listPlatformSurfaceManifests, resolveArchitectureReadinessRing, resolvePlatformSurfaceManifest, registerPlatformSurfaceCatalog, ARCHITECTURE_READINESS_RINGS, PLATFORM_SURFACE_MANIFESTS, } from "../../../src/platform/platform-module-catalog.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
test("PLATFORM_SURFACE_MANIFESTS is frozen and has exactly 11 surfaces", () => {
    assert.ok(Object.isFrozen(PLATFORM_SURFACE_MANIFESTS), "PLATFORM_SURFACE_MANIFESTS should be frozen");
    assert.equal(PLATFORM_SURFACE_MANIFESTS.length, 11);
});
test("listPlatformSurfaceManifests returns frozen array of 11 surfaces", () => {
    const manifests = listPlatformSurfaceManifests();
    assert.ok(Object.isFrozen(manifests), "returned array should be frozen");
    assert.equal(manifests.length, 11);
});
test("all surface IDs are valid PlatformSurfaceId types", () => {
    const surfaceIds = [
        "contracts",
        "interface",
        "x1-fabric",
        "control-plane",
        "orchestration",
        "execution",
        "state-evidence",
        "model-gateway",
        "prompt-engine",
        "shared",
        "compliance",
    ];
    const manifests = listPlatformSurfaceManifests();
    const manifestIds = manifests.map((m) => m.surfaceId);
    assert.deepEqual(manifestIds, surfaceIds);
});
test("each surface manifest has required fields", () => {
    const manifests = listPlatformSurfaceManifests();
    for (const manifest of manifests) {
        assert.ok(typeof manifest.surfaceId === "string", `${manifest.surfaceId}: surfaceId should be string`);
        assert.ok(typeof manifest.entryModule === "string", `${manifest.surfaceId}: entryModule should be string`);
        assert.ok(typeof manifest.description === "string", `${manifest.surfaceId}: description should be string`);
        assert.ok(Array.isArray(manifest.architectureSections), `${manifest.surfaceId}: architectureSections should be array`);
        assert.ok(Array.isArray(manifest.canonicalSubdomains), `${manifest.surfaceId}: canonicalSubdomains should be array`);
        assert.ok(manifest.architectureSections.length > 0, `${manifest.surfaceId}: should have at least one architecture section`);
        assert.ok(manifest.canonicalSubdomains.length > 0, `${manifest.surfaceId}: should have at least one canonical subdomain`);
    }
});
test("each surface manifest entryModule starts with 'src/platform/'", () => {
    const manifests = listPlatformSurfaceManifests();
    for (const manifest of manifests) {
        assert.ok(manifest.entryModule.startsWith("src/platform/"), `${manifest.surfaceId}: entryModule should start with 'src/platform/', got ${manifest.entryModule}`);
    }
});
test("all architecture sections follow section reference format (§X or §X.Y)", () => {
    const manifests = listPlatformSurfaceManifests();
    const sectionPattern = /^§\d+(?:\.\d+)*$/;
    for (const manifest of manifests) {
        for (const section of manifest.architectureSections) {
            assert.ok(sectionPattern.test(section), `${manifest.surfaceId}: architecture section '${section}' should match section reference format`);
        }
    }
});
test("resolvePlatformSurfaceManifest returns correct manifest for each surfaceId", () => {
    const manifests = listPlatformSurfaceManifests();
    for (const manifest of manifests) {
        const resolved = resolvePlatformSurfaceManifest(manifest.surfaceId);
        assert.strictEqual(resolved.surfaceId, manifest.surfaceId);
        assert.strictEqual(resolved.entryModule, manifest.entryModule);
        assert.strictEqual(resolved.description, manifest.description);
    }
});
test("resolvePlatformSurfaceManifest throws Error for unknown surfaceId", () => {
    assert.throws(() => resolvePlatformSurfaceManifest("non-existent"), { message: /Unknown platform surface: non-existent/ });
});
test("contracts surface has correct canonical subdomains", () => {
    const manifest = resolvePlatformSurfaceManifest("contracts");
    assert.ok(manifest.canonicalSubdomains.includes("request-envelope"));
    assert.ok(manifest.canonicalSubdomains.includes("result-envelope"));
    assert.ok(manifest.canonicalSubdomains.includes("control-directive"));
    assert.ok(manifest.canonicalSubdomains.includes("execution-plan"));
    assert.ok(manifest.canonicalSubdomains.includes("execution-receipt"));
    assert.ok(manifest.canonicalSubdomains.includes("state-command"));
});
test("execution surface has correct canonical subdomains", () => {
    const manifest = resolvePlatformSurfaceManifest("execution");
    const expected = [
        "dispatcher",
        "distributed-lock",
        "execution-engine",
        "ha",
        "lease",
        "queue",
        "recovery",
        "resource",
        "state-transition",
        "tool-executor",
        "worker-pool",
    ];
    assert.deepEqual(manifest.canonicalSubdomains.sort(), expected.sort());
});
test("state-evidence surface has correct canonical subdomains", () => {
    const manifest = resolvePlatformSurfaceManifest("state-evidence");
    const expected = [
        "artifacts",
        "audit",
        "checkpoints",
        "dlq",
        "events",
        "incident",
        "knowledge",
        "memory",
        "projections",
        "truth",
    ];
    assert.deepEqual(manifest.canonicalSubdomains.sort(), expected.sort());
});
// Architecture Readiness Rings tests
test("ARCHITECTURE_READINESS_RINGS is frozen and has exactly 4 rings", () => {
    assert.ok(Object.isFrozen(ARCHITECTURE_READINESS_RINGS), "ARCHITECTURE_READINESS_RINGS should be frozen");
    assert.equal(ARCHITECTURE_READINESS_RINGS.length, 4);
});
test("listArchitectureReadinessRings returns frozen array of 4 rings", () => {
    const rings = listArchitectureReadinessRings();
    assert.ok(Object.isFrozen(rings), "returned array should be frozen");
    assert.equal(rings.length, 4);
});
test("all rings have required fields", () => {
    const rings = listArchitectureReadinessRings();
    for (const ring of rings) {
        assert.ok(typeof ring.ringId === "string", `${ring.ringId}: ringId should be string`);
        assert.ok(typeof ring.status === "string", `${ring.ringId}: status should be string`);
        assert.ok(typeof ring.gateMeaning === "string", `${ring.ringId}: gateMeaning should be string`);
        assert.ok(Array.isArray(ring.architectureSections), `${ring.ringId}: architectureSections should be array`);
        assert.ok(Array.isArray(ring.evidenceModules), `${ring.ringId}: evidenceModules should be array`);
        assert.ok(Array.isArray(ring.verificationTests), `${ring.ringId}: verificationTests should be array`);
    }
});
test("ring IDs follow naming convention", () => {
    const rings = listArchitectureReadinessRings();
    const ringIds = rings.map((r) => r.ringId);
    assert.deepEqual(ringIds, ["contract-freeze", "hardening", "usability", "expansion"]);
});
test("all ring statuses are valid ArchitectureReadinessStatus values", () => {
    const validStatuses = ["implemented", "evidence_registered", "production_verified"];
    const rings = listArchitectureReadinessRings();
    for (const ring of rings) {
        assert.ok(validStatuses.includes(ring.status), `${ring.ringId}: status '${ring.status}' should be one of ${validStatuses.join(", ")}`);
    }
});
test("contract-freeze ring has production_verified status", () => {
    const ring = resolveArchitectureReadinessRing("contract-freeze");
    assert.strictEqual(ring.status, "production_verified");
});
test("hardening, usability, and expansion rings have evidence_registered status", () => {
    const hardening = resolveArchitectureReadinessRing("hardening");
    const usability = resolveArchitectureReadinessRing("usability");
    const expansion = resolveArchitectureReadinessRing("expansion");
    assert.strictEqual(hardening.status, "evidence_registered");
    assert.strictEqual(usability.status, "evidence_registered");
    assert.strictEqual(expansion.status, "evidence_registered");
});
test("each ring has at least one evidence module and verification test", () => {
    const rings = listArchitectureReadinessRings();
    for (const ring of rings) {
        assert.ok(ring.evidenceModules.length > 0, `${ring.ringId}: should have at least one evidence module`);
        assert.ok(ring.verificationTests.length > 0, `${ring.ringId}: should have at least one verification test`);
    }
});
test("evidence module paths are valid source paths", () => {
    const rings = listArchitectureReadinessRings();
    for (const ring of rings) {
        for (const module of ring.evidenceModules) {
            assert.ok(module.startsWith("src/") || module.startsWith("tests/"), `${ring.ringId}: evidence module '${module}' should start with 'src/' or 'tests/'`);
            assert.ok(module.endsWith(".ts"), `${ring.ringId}: evidence module '${module}' should end with .ts`);
        }
    }
});
test("verification test paths are valid test paths", () => {
    const rings = listArchitectureReadinessRings();
    for (const ring of rings) {
        for (const test of ring.verificationTests) {
            assert.ok(test.startsWith("tests/"), `${ring.ringId}: verification test '${test}' should start with 'tests/'`);
            assert.ok(test.endsWith(".ts"), `${ring.ringId}: verification test '${test}' should end with .ts`);
        }
    }
});
test("resolveArchitectureReadinessRing returns correct ring for each ringId", () => {
    const rings = listArchitectureReadinessRings();
    for (const ring of rings) {
        const resolved = resolveArchitectureReadinessRing(ring.ringId);
        assert.strictEqual(resolved.ringId, ring.ringId);
        assert.strictEqual(resolved.status, ring.status);
        assert.deepEqual(resolved.architectureSections, ring.architectureSections);
    }
});
test("resolveArchitectureReadinessRing throws Error for unknown ringId", () => {
    assert.throws(() => resolveArchitectureReadinessRing("non-existent"), { message: /Unknown architecture readiness ring: non-existent/ });
});
test("gateMeaning fields are descriptive and non-empty", () => {
    const rings = listArchitectureReadinessRings();
    for (const ring of rings) {
        assert.ok(ring.gateMeaning.length > 20, `${ring.ringId}: gateMeaning should be descriptive (> 20 chars)`);
        assert.ok(/\b(evidence|verified|implemented|production|modules|tests)\b/i.test(ring.gateMeaning), `${ring.ringId}: gateMeaning should mention key concepts like evidence, verified, implemented`);
    }
});
test("each ring's architectureSections contain valid section references", () => {
    const rings = listArchitectureReadinessRings();
    const sectionPattern = /^§\d+(?:\.\d+)*$/;
    for (const ring of rings) {
        for (const section of ring.architectureSections) {
            assert.ok(sectionPattern.test(section), `${ring.ringId}: architecture section '${section}' should match section reference format`);
        }
    }
});
test("contract-freeze ring has evidence modules from key platform areas", () => {
    const ring = resolveArchitectureReadinessRing("contract-freeze");
    const modulePaths = ring.evidenceModules;
    assert.ok(modulePaths.some((m) => m.includes("executable-contracts")), "should include executable-contracts");
    assert.ok(modulePaths.some((m) => m.includes("intake-admission-service")), "should include intake-admission-service");
    assert.ok(modulePaths.some((m) => m.includes("plan-graph-harness-runtime")), "should include plan-graph-harness-runtime");
    assert.ok(modulePaths.some((m) => m.includes("runtime-state-machine")), "should include runtime-state-machine");
    assert.ok(modulePaths.some((m) => m.includes("runtime-truth-repository")), "should include runtime-truth-repository");
});
test("hardening ring includes event registry and DLQ service", () => {
    const ring = resolveArchitectureReadinessRing("hardening");
    const modulePaths = ring.evidenceModules;
    assert.ok(modulePaths.some((m) => m.includes("event-registry")), "should include event-registry");
    assert.ok(modulePaths.some((m) => m.includes("dlq-service")), "should include dlq-service");
});
test("usability ring includes interaction modules", () => {
    const ring = resolveArchitectureReadinessRing("usability");
    const modulePaths = ring.evidenceModules;
    assert.ok(modulePaths.some((m) => m.includes("nl-gateway")), "should include nl-gateway");
    assert.ok(modulePaths.some((m) => m.includes("goal-decomposer")), "should include goal-decomposer");
});
test("expansion ring includes org-governance and scale-ecosystem modules", () => {
    const ring = resolveArchitectureReadinessRing("expansion");
    const modulePaths = ring.evidenceModules;
    assert.ok(modulePaths.some((m) => m.includes("org-governance")), "should include org-governance");
    assert.ok(modulePaths.some((m) => m.includes("scale-ecosystem")), "should include scale-ecosystem");
    assert.ok(modulePaths.some((m) => m.includes("ops-maturity")), "should include ops-maturity");
});
// Surface manifest properties validation
test("interface surface has correct properties", () => {
    const manifest = resolvePlatformSurfaceManifest("interface");
    assert.strictEqual(manifest.entryModule, "src/platform/interface/index.ts");
    assert.ok(manifest.architectureSections.includes("§4"));
    assert.ok(manifest.architectureSections.includes("§6"));
    assert.ok(manifest.architectureSections.includes("§7"));
    assert.ok(manifest.canonicalSubdomains.includes("api"));
    assert.ok(manifest.canonicalSubdomains.includes("scheduler"));
    assert.ok(manifest.canonicalSubdomains.includes("webhook"));
});
test("control-plane surface has correct properties", () => {
    const manifest = resolvePlatformSurfaceManifest("control-plane");
    assert.strictEqual(manifest.entryModule, "src/platform/control-plane/index.ts");
    assert.ok(manifest.architectureSections.includes("§10"));
    assert.ok(manifest.canonicalSubdomains.includes("iam"));
    assert.ok(manifest.canonicalSubdomains.includes("approval-center"));
    assert.ok(manifest.canonicalSubdomains.includes("config-center"));
});
test("orchestration surface has correct properties", () => {
    const manifest = resolvePlatformSurfaceManifest("orchestration");
    assert.strictEqual(manifest.entryModule, "src/platform/orchestration/index.ts");
    assert.ok(manifest.architectureSections.includes("§13"));
    assert.ok(manifest.canonicalSubdomains.includes("oapeflir"));
    assert.ok(manifest.canonicalSubdomains.includes("planner"));
    assert.ok(manifest.canonicalSubdomains.includes("hitl"));
    assert.ok(manifest.canonicalSubdomains.includes("routing"));
});
test("model-gateway surface has correct properties", () => {
    const manifest = resolvePlatformSurfaceManifest("model-gateway");
    assert.strictEqual(manifest.entryModule, "src/platform/model-gateway/index.ts");
    assert.ok(manifest.architectureSections.includes("§15"));
    assert.ok(manifest.architectureSections.includes("§18"));
    assert.ok(manifest.canonicalSubdomains.includes("provider-registry"));
    assert.ok(manifest.canonicalSubdomains.includes("router"));
    assert.ok(manifest.canonicalSubdomains.includes("fallback"));
    assert.ok(manifest.canonicalSubdomains.includes("degradation"));
    assert.ok(manifest.canonicalSubdomains.includes("cost-tracker"));
});
test("prompt-engine surface has correct properties", () => {
    const manifest = resolvePlatformSurfaceManifest("prompt-engine");
    assert.strictEqual(manifest.entryModule, "src/platform/prompt-engine/index.ts");
    assert.ok(manifest.architectureSections.includes("§16"));
    assert.ok(manifest.architectureSections.includes("§17"));
    assert.ok(manifest.canonicalSubdomains.includes("registry"));
    assert.ok(manifest.canonicalSubdomains.includes("renderer"));
    assert.ok(manifest.canonicalSubdomains.includes("rollout"));
    assert.ok(manifest.canonicalSubdomains.includes("eval"));
});
test("shared surface has correct properties", () => {
    const manifest = resolvePlatformSurfaceManifest("shared");
    assert.strictEqual(manifest.entryModule, "src/platform/shared/index.ts");
    assert.ok(manifest.architectureSections.includes("§9"));
    assert.ok(manifest.architectureSections.includes("§27"));
    assert.ok(manifest.architectureSections.includes("§58"));
    assert.ok(manifest.canonicalSubdomains.includes("cache"));
    assert.ok(manifest.canonicalSubdomains.includes("lifecycle"));
    assert.ok(manifest.canonicalSubdomains.includes("observability"));
    assert.ok(manifest.canonicalSubdomains.includes("outbox"));
});
test("compliance surface has correct properties", () => {
    const manifest = resolvePlatformSurfaceManifest("compliance");
    assert.strictEqual(manifest.entryModule, "src/platform/compliance/index.ts");
    assert.ok(manifest.architectureSections.includes("§23"));
    assert.ok(manifest.canonicalSubdomains.includes("crypto-shredding"));
    assert.ok(manifest.canonicalSubdomains.includes("data-residency"));
    assert.ok(manifest.canonicalSubdomains.includes("erasure"));
    assert.ok(manifest.canonicalSubdomains.includes("lineage"));
});
test("no duplicate surfaceIds across manifests", () => {
    const manifests = listPlatformSurfaceManifests();
    const ids = manifests.map((m) => m.surfaceId);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, "surfaceIds should be unique");
});
test("no duplicate ringIds across rings", () => {
    const rings = listArchitectureReadinessRings();
    const ids = rings.map((r) => r.ringId);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, "ringIds should be unique");
});
test("listPlatformSurfaceManifests returns same frozen array reference", () => {
    const manifests1 = listPlatformSurfaceManifests();
    const manifests2 = listPlatformSurfaceManifests();
    // Should return the exact same array reference
    assert.strictEqual(manifests1, manifests2);
});
test("listArchitectureReadinessRings returns same frozen array reference", () => {
    const rings1 = listArchitectureReadinessRings();
    const rings2 = listArchitectureReadinessRings();
    // Should return the exact same array reference
    assert.strictEqual(rings1, rings2);
});
// registerPlatformSurfaceCatalog tests
test("registerPlatformSurfaceCatalog registers service in registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const manifests = registerPlatformSurfaceCatalog(registry);
        assert.ok(registry.isInitialized("platform.surface-catalog"));
        assert.equal(manifests.length, 11);
    }
    finally {
        await registry.reset();
    }
});
test("registerPlatformSurfaceCatalog returns same service on subsequent calls", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const catalogs1 = registerPlatformSurfaceCatalog(registry);
        const catalogs2 = registerPlatformSurfaceCatalog(registry);
        assert.strictEqual(catalogs1, catalogs2);
    }
    finally {
        await registry.reset();
    }
});
test("registerPlatformSurfaceCatalog works with default registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const manifests = registerPlatformSurfaceCatalog();
        assert.ok(manifests.length > 0);
        assert.equal(manifests.length, 11);
    }
    finally {
        await registry.reset();
    }
});
test("registerPlatformSurfaceCatalog returns frozen array", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const manifests = registerPlatformSurfaceCatalog(registry);
        assert.ok(Object.isFrozen(manifests));
    }
    finally {
        await registry.reset();
    }
});
test("registerPlatformSurfaceCatalog manifests match PLATFORM_SURFACE_MANIFESTS", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const manifests = registerPlatformSurfaceCatalog(registry);
        assert.equal(manifests.length, PLATFORM_SURFACE_MANIFESTS.length);
        for (let i = 0; i < manifests.length; i++) {
            assert.equal(manifests[i].surfaceId, PLATFORM_SURFACE_MANIFESTS[i].surfaceId);
            assert.equal(manifests[i].entryModule, PLATFORM_SURFACE_MANIFESTS[i].entryModule);
        }
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=platform-module-catalog.test.js.map