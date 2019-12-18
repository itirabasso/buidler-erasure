const { loadPluginFile } = require("@nomiclabs/buidler/plugins-testing");
loadPluginFile(__dirname + "/../../src/index");

module.exports = {
  defaultNetwork: "buidlerevm",
  paths: {
    sources: __dirname + "./contracts",
    artifacts: __dirname + "./artifacts"
  }
};
