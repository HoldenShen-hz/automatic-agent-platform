import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
test("[SYS-DEPLOY-6.1] terraform main.tf has remote backend configured", () => {
    const content = readFileSync("deploy/terraform/main.tf", "utf8");
    assert.ok(content.includes("backend "), "main.tf must contain a backend block for remote state");
    assert.ok(!content.includes('backend "local"'), "Backend must not be local");
});
//# sourceMappingURL=terraform-backend.test.js.map