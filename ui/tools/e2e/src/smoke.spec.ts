import { registerSmokeSuite } from "./index";

registerSmokeSuite(process.env.AA_UI_BASE_URL ?? "http://127.0.0.1:4173");
