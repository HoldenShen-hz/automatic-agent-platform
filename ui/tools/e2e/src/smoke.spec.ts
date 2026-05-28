import testTarget from "../../../test-target.json";
import { registerSmokeSuite } from "./index";

const host = process.env.PLAYWRIGHT_HOST ?? testTarget.host;
const port = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? String(testTarget.port), 10);
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? process.env.AA_UI_BASE_URL ?? `http://${host}:${port}`;

registerSmokeSuite(baseUrl);
