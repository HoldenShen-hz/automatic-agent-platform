import { createGithubAdapterPlugin } from "./adapters/github-adapter.js";
import { createCrmAdapterPlugin } from "./adapters/crm-adapter.js";
import { createGameDevAdapterPlugin } from "./adapters/game-dev-adapter.js";
import { createAssetProductionAdapterPlugin } from "./adapters/asset-production-adapter.js";
import { createLivestreamAdapterPlugin } from "./adapters/livestream-adapter.js";
import { createBasicPlannerPlugin } from "./planners/basic-planner.js";
import { createCodingPresenterPlugin } from "./presenters/coding-presenter.js";
import { createCodingRetrieverPlugin } from "./retrievers/coding-retriever.js";
import { createGrowthPresenterPlugin } from "./presenters/growth-presenter.js";
import { createGrowthRetrieverPlugin } from "./retrievers/growth-retriever.js";
import { createOperationsPresenterPlugin } from "./presenters/operations-presenter.js";
import { createOperationsRetrieverPlugin } from "./retrievers/operations-retriever.js";
import { createGameDevRetrieverPlugin } from "./retrievers/game-dev-retriever.js";
import { createAssetProductionRetrieverPlugin } from "./retrievers/asset-production-retriever.js";
import { createLivestreamRetrieverPlugin } from "./retrievers/livestream-retriever.js";
import { createBasicEvaluatorPlugin } from "./validators/basic-evaluator.js";
const BUILTIN_PLUGIN_FACTORIES = new Map([
    ["plugin.coding.retriever", createCodingRetrieverPlugin],
    ["plugin.coding.presenter", createCodingPresenterPlugin],
    ["plugin.core.basic-evaluator", createBasicEvaluatorPlugin],
    ["plugin.core.basic-planner", createBasicPlannerPlugin],
    ["plugin.shared.github_adapter", createGithubAdapterPlugin],
    // §G8: Operations domain plugins
    ["plugin.operations.retriever", createOperationsRetrieverPlugin],
    ["plugin.operations.presenter", createOperationsPresenterPlugin],
    // §G8: Growth domain plugins (M2 Phase 2)
    ["plugin.growth.retriever", createGrowthRetrieverPlugin],
    ["plugin.growth.presenter", createGrowthPresenterPlugin],
    ["plugin.growth.crm_adapter", createCrmAdapterPlugin],
    // §G8: Game Dev domain plugins (M2 Phase 3)
    ["plugin.gamedev.retriever", createGameDevRetrieverPlugin],
    ["plugin.gamedev.unity_adapter", createGameDevAdapterPlugin],
    // §G8: Asset Production domain plugins (M2 Phase 4)
    ["plugin.assetproduction.retriever", createAssetProductionRetrieverPlugin],
    ["plugin.assetproduction.figma_adapter", createAssetProductionAdapterPlugin],
    // §G8: Livestream domain plugins (M2 Phase 5)
    ["plugin.livestream.retriever", createLivestreamRetrieverPlugin],
    ["plugin.livestream.obs_adapter", createLivestreamAdapterPlugin],
]);
export function createBuiltinPlugin(pluginId) {
    return BUILTIN_PLUGIN_FACTORIES.get(pluginId)?.() ?? null;
}
export function hasBuiltinPlugin(pluginId) {
    return BUILTIN_PLUGIN_FACTORIES.has(pluginId);
}
export function listBuiltinPluginIds() {
    return [...BUILTIN_PLUGIN_FACTORIES.keys()];
}
//# sourceMappingURL=builtin-plugin-registry.js.map