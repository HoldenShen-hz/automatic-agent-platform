import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(projectRoot, "../..");
const packageRoot = path.resolve(workspaceRoot, "packages");

export default {
  projectRoot,
  watchFolders: [workspaceRoot],
  resolver: {
    sourceExts: ["tsx", "ts", "jsx", "js", "json"],
    nodeModulesPaths: [
      path.resolve(projectRoot, "node_modules"),
      path.resolve(workspaceRoot, "node_modules"),
    ],
    extraNodeModules: new Proxy(
      {},
      {
        get: (_target, packageName) => path.join(packageRoot, String(packageName)),
      },
    ),
    unstable_enablePackageExports: true,
  },
  transformer: {},
};
