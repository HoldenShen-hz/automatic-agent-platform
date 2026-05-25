import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { FencingTokenService } from "../../../../src/scale-ecosystem/multi-region/fencing-token-service.js";

test("FencingTokenService persists epoch and released leadership across restart", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-fencing-token-service-"));
  const storagePath = join(workspace, "fencing-state.json");

  try {
    const first = new FencingTokenService({ storagePath });
    const token = first.acquireLeadership("us-east", "entity-1");
    assert.ok(token);
    assert.equal(token?.epoch, 1);
    assert.equal(first.releaseLeadership("us-east", "entity-1"), true);

    const restarted = new FencingTokenService({ storagePath });
    assert.equal(restarted.getCurrentEpoch(), 1);
    const validation = restarted.validateFencingToken("entity-1", token!);
    assert.equal(validation.valid, false);
    assert.equal(validation.reason, "leadership_released");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("FencingTokenService keeps epochs monotonic after restart and rejects stale tokens", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-fencing-token-epoch-"));
  const storagePath = join(workspace, "fencing-state.json");

  try {
    const initial = new FencingTokenService({ storagePath });
    const firstToken = initial.acquireLeadership("us-east", "entity-2");
    assert.ok(firstToken);
    assert.equal(initial.releaseLeadership("us-east", "entity-2"), true);

    const restarted = new FencingTokenService({ storagePath });
    const nextToken = restarted.acquireLeadership("us-east", "entity-2");
    assert.ok(nextToken);
    assert.equal(nextToken?.epoch, 2);

    const staleValidation = restarted.validateFencingToken("entity-2", firstToken!);
    assert.equal(staleValidation.valid, false);
    assert.equal(staleValidation.reason, "stale_token_epoch");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("FencingTokenService rejects stale token ids even when region and epoch match", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-fencing-token-id-"));
  const storagePath = join(workspace, "fencing-state.json");

  try {
    const service = new FencingTokenService({ storagePath });
    const token = service.acquireLeadership("us-east", "entity-3");
    assert.ok(token);

    const forgedToken = {
      ...token!,
      tokenId: "fence_forged",
    };
    const validation = service.validateFencingToken("entity-3", forgedToken);
    assert.equal(validation.valid, false);
    assert.equal(validation.reason, "token_id_mismatch");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("FencingTokenService refuses leadership mutation while persistence lock is held", () => {
  const workspace = mkdtempSync(join(tmpdir(), "aa-fencing-token-lock-"));
  const storagePath = join(workspace, "fencing-state.json");

  try {
    writeFileSync(`${storagePath}.lock`, "locked", "utf8");
    const service = new FencingTokenService({ storagePath });
    assert.throws(
      () => service.acquireLeadership("us-east", "entity-4"),
      /EEXIST/,
    );
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
