export * from "./api/index.js";
export * from "./console/index.js";
export * from "./workers/index.js";

import { API_APP_MANIFEST } from "./api/index.js";
import { CONSOLE_APP_MANIFEST } from "./console/index.js";
import { WORKER_APP_MANIFEST } from "./workers/index.js";

export function listPlatformApps() {
  return [API_APP_MANIFEST, CONSOLE_APP_MANIFEST, WORKER_APP_MANIFEST];
}
