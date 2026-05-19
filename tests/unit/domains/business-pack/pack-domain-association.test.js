import test from "node:test";
import assert from "node:assert/strict";
import { PackDomainAssociationService, } from "../../../../src/domains/business-pack/pack-domain-association.js";
function createAssociationService() {
    return new PackDomainAssociationService();
}
test("PackDomainAssociationService associatePackWithDomain creates association", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    assert.strictEqual(service.getDomainForPack("pack-001"), "domain-001");
    assert.deepStrictEqual(service.listPacksInDomain("domain-001"), ["pack-001"]);
});
test("PackDomainAssociationService associatePackWithDomain sets first pack as primary by default", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    assert.strictEqual(service.getPrimaryPackForDomain("domain-001"), "pack-001");
});
test("PackDomainAssociationService associatePackWithDomain with isPrimary=true sets primary pack", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    service.associatePackWithDomain("pack-002", "domain-001");
    service.associatePackWithDomain("pack-003", "domain-001", true);
    assert.strictEqual(service.getPrimaryPackForDomain("domain-001"), "pack-003");
});
test("PackDomainAssociationService associatePackWithDomain reassigns primary when isPrimary is true", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001", true);
    service.associatePackWithDomain("pack-002", "domain-001", true);
    assert.strictEqual(service.getPrimaryPackForDomain("domain-001"), "pack-002");
});
test("PackDomainAssociationService associatePackWithDomain removes existing association when domain changes", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    service.associatePackWithDomain("pack-001", "domain-002");
    assert.strictEqual(service.getDomainForPack("pack-001"), "domain-002");
    assert.deepStrictEqual(service.listPacksInDomain("domain-001"), []);
    assert.deepStrictEqual(service.listPacksInDomain("domain-002"), ["pack-001"]);
});
test("PackDomainAssociationService dissociatePackFromDomain removes association", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    service.dissociatePackFromDomain("pack-001");
    assert.strictEqual(service.getDomainForPack("pack-001"), null);
    assert.deepStrictEqual(service.listPacksInDomain("domain-001"), []);
});
test("PackDomainAssociationService dissociatePackFromDomain promotes next pack to primary", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001", true);
    service.associatePackWithDomain("pack-002", "domain-001");
    service.dissociatePackFromDomain("pack-001");
    assert.strictEqual(service.getPrimaryPackForDomain("domain-001"), "pack-002");
});
test("PackDomainAssociationService dissociatePackFromDomain clears primary when last pack removed", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001", true);
    service.dissociatePackFromDomain("pack-001");
    assert.strictEqual(service.getPrimaryPackForDomain("domain-001"), null);
});
test("PackDomainAssociationService dissociatePackFromDomain handles non-existent pack gracefully", () => {
    const service = createAssociationService();
    service.dissociatePackFromDomain("nonexistent");
    assert.strictEqual(service.getDomainForPack("nonexistent"), null);
});
test("PackDomainAssociationService getDomainForPack returns null for non-existent pack", () => {
    const service = createAssociationService();
    const result = service.getDomainForPack("nonexistent");
    assert.strictEqual(result, null);
});
test("PackDomainAssociationService listPacksInDomain returns all packs in domain", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    service.associatePackWithDomain("pack-002", "domain-001");
    service.associatePackWithDomain("pack-003", "domain-002");
    const domain1Packs = service.listPacksInDomain("domain-001");
    const domain2Packs = service.listPacksInDomain("domain-002");
    assert.strictEqual(domain1Packs.length, 2);
    assert.ok(domain1Packs.includes("pack-001"));
    assert.ok(domain1Packs.includes("pack-002"));
    assert.strictEqual(domain2Packs.length, 1);
    assert.ok(domain2Packs.includes("pack-003"));
});
test("PackDomainAssociationService listPacksInDomain returns empty array for unknown domain", () => {
    const service = createAssociationService();
    const result = service.listPacksInDomain("nonexistent");
    assert.deepStrictEqual(result, []);
});
test("PackDomainAssociationService getDomainPackInfo returns domain info with packs", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001", true);
    service.associatePackWithDomain("pack-002", "domain-001");
    const info = service.getDomainPackInfo("domain-001");
    assert.strictEqual(info.domainId, "domain-001");
    assert.strictEqual(info.packIds.length, 2);
    assert.ok(info.packIds.includes("pack-001"));
    assert.ok(info.packIds.includes("pack-002"));
    assert.strictEqual(info.primaryPackId, "pack-001");
});
test("PackDomainAssociationService getDomainPackInfo returns empty packs for unknown domain", () => {
    const service = createAssociationService();
    const info = service.getDomainPackInfo("nonexistent");
    assert.strictEqual(info.domainId, "nonexistent");
    assert.deepStrictEqual(info.packIds, []);
    assert.strictEqual(info.primaryPackId, null);
});
test("PackDomainAssociationService getPrimaryPackForDomain returns null when no primary set", () => {
    const service = createAssociationService();
    const result = service.getPrimaryPackForDomain("domain-001");
    assert.strictEqual(result, null);
});
test("PackDomainAssociationService setPrimaryPack sets primary pack", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    service.associatePackWithDomain("pack-002", "domain-001");
    service.setPrimaryPack("domain-001", "pack-002");
    assert.strictEqual(service.getPrimaryPackForDomain("domain-001"), "pack-002");
});
test("PackDomainAssociationService setPrimaryPack throws for pack not in domain", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    assert.throws(() => service.setPrimaryPack("domain-001", "pack-not-in-domain"), /not associated with domain/);
});
test("PackDomainAssociationService isPackAssociated returns true for associated pack", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    assert.strictEqual(service.isPackAssociated("pack-001"), true);
});
test("PackDomainAssociationService isPackAssociated returns false for non-associated pack", () => {
    const service = createAssociationService();
    assert.strictEqual(service.isPackAssociated("nonexistent"), false);
});
test("PackDomainAssociationService isPrimaryPack returns true for primary pack", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001", true);
    assert.strictEqual(service.isPrimaryPack("pack-001"), true);
});
test("PackDomainAssociationService isPrimaryPack returns false for non-primary pack", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    service.associatePackWithDomain("pack-002", "domain-001", true);
    assert.strictEqual(service.isPrimaryPack("pack-001"), false);
    assert.strictEqual(service.isPrimaryPack("pack-002"), true);
});
test("PackDomainAssociationService isPrimaryPack returns false for non-existent pack", () => {
    const service = createAssociationService();
    assert.strictEqual(service.isPrimaryPack("nonexistent"), false);
});
test("PackDomainAssociationService listAssociatedDomains returns all domains with packs", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    service.associatePackWithDomain("pack-002", "domain-002");
    service.associatePackWithDomain("pack-003", "domain-003");
    const domains = service.listAssociatedDomains();
    assert.strictEqual(domains.length, 3);
    assert.ok(domains.includes("domain-001"));
    assert.ok(domains.includes("domain-002"));
    assert.ok(domains.includes("domain-003"));
});
test("PackDomainAssociationService listAssociatedDomains returns empty when no packs associated", () => {
    const service = createAssociationService();
    const domains = service.listAssociatedDomains();
    assert.deepStrictEqual(domains, []);
});
test("PackDomainAssociationService getAllAssociations returns all pack-domain associations", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001", true);
    service.associatePackWithDomain("pack-002", "domain-001");
    service.associatePackWithDomain("pack-003", "domain-002");
    const associations = service.getAllAssociations();
    assert.strictEqual(associations.length, 3);
    const pack001Assoc = associations.find((a) => a.packId === "pack-001");
    assert.ok(pack001Assoc);
    assert.strictEqual(pack001Assoc.domainId, "domain-001");
    assert.strictEqual(pack001Assoc.isPrimary, true);
    const pack003Assoc = associations.find((a) => a.packId === "pack-003");
    assert.ok(pack003Assoc);
    assert.strictEqual(pack003Assoc.domainId, "domain-002");
    assert.strictEqual(pack003Assoc.isPrimary, true);
    const pack002Assoc = associations.find((a) => a.packId === "pack-002");
    assert.ok(pack002Assoc);
    assert.strictEqual(pack002Assoc.domainId, "domain-001");
    assert.strictEqual(pack002Assoc.isPrimary, false);
});
test("PackDomainAssociationService supports multiple packs per domain", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    service.associatePackWithDomain("pack-002", "domain-001");
    service.associatePackWithDomain("pack-003", "domain-001");
    const packs = service.listPacksInDomain("domain-001");
    assert.strictEqual(packs.length, 3);
    const info = service.getDomainPackInfo("domain-001");
    assert.strictEqual(info.packIds.length, 3);
});
test("PackDomainAssociationService supports multiple domains per pack", () => {
    const service = createAssociationService();
    service.associatePackWithDomain("pack-001", "domain-001");
    service.dissociatePackFromDomain("pack-001");
    service.associatePackWithDomain("pack-001", "domain-002");
    assert.strictEqual(service.getDomainForPack("pack-001"), "domain-002");
    assert.deepStrictEqual(service.listPacksInDomain("domain-001"), []);
    assert.deepStrictEqual(service.listPacksInDomain("domain-002"), ["pack-001"]);
});
//# sourceMappingURL=pack-domain-association.test.js.map