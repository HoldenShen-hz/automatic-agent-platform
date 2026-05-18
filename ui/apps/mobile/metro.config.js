const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

module.exports = {
  projectRoot,
  watchFolders: [workspaceRoot],
  resolver: {
    sourceExts: ["tsx", "ts", "jsx", "js", "json"],
    nodeModulesPaths: [
      path.join(projectRoot, "node_modules"),
      path.join(workspaceRoot, "node_modules"),
    ],
    unstable_enablePackageExports: true,
  },
  transformer: {},
};
