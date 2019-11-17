// We load the plugin here.
// We recommend using loadPluginFile in tests, as using usePlugin from within
// a plugin can interfer with any build step you have (e.g. TypeScript).
const { loadPluginFile } = require("@nomiclabs/buidler/plugins-testing");

loadPluginFile(
  __dirname + "/../../node_modules/@nomiclabs/buidler-ethers/dist"
);
loadPluginFile(__dirname + "/../../src/index");

module.exports = {
  defaultNetwork: "buidlerevm",
  paths: {
    sources: __dirname + "../../contracts",
    artifacts: __dirname + "/artifacts"
  }
};
