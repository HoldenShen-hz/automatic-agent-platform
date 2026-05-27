import testTarget from "../../../test-target.json";
import { registerSmokeSuite } from "./index";

registerSmokeSuite(process.env.AA_UI_BASE_URL ?? testTarget.baseUrl);
