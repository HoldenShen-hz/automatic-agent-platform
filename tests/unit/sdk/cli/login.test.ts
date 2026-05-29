import assert from "node:assert/strict";
import test from "node:test";

import { clearLegacyLoginTokenEnv } from "../../../../src/sdk/cli/login.js";

test("clearLegacyLoginTokenEnv removes inherited AA_LOGIN_TOKEN values", () => {
  const env = {
    AA_LOGIN_TOKEN: "sensitive-token",
    AA_OAUTH_CLIENT_ID: "client",
  } as NodeJS.ProcessEnv;

  clearLegacyLoginTokenEnv(env);

  assert.equal("AA_LOGIN_TOKEN" in env, false);
  assert.equal(env.AA_OAUTH_CLIENT_ID, "client");
});
