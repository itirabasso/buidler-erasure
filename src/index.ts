import {
  TASK_CLEAN,
  TASK_TEST_SETUP_TEST_ENVIRONMENT
} from "@nomiclabs/buidler/builtin-tasks/task-names";
import {
  extendConfig,
  extendEnvironment,
  internalTask,
  task,
  usePlugin
} from "@nomiclabs/buidler/config";
import { createChainIdGetter } from "@nomiclabs/buidler/internal/core/providers/provider-utils";
import { ensurePluginLoadedWithUsePlugin } from "@nomiclabs/buidler/plugins";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { Contract, utils } from "ethers";

import { defaultSetup } from "./defaultSetup";
import { Deployments } from "./deployments";
import { Erasure } from "./erasure";
import { ErasureSetup } from "./erasureSetup";
import { FakeSigner } from "./fakeSigner";
import { ensureStateFile, setInitialState } from "./utils";

usePlugin("@nomiclabs/buidler-ethers");
ensurePluginLoadedWithUsePlugin();

// if the state file doesn't exist, it's created.
ensureStateFile();

task(TASK_TEST_SETUP_TEST_ENVIRONMENT, async (_, env, runSuper) => {
  await env.run("erasure:erasure-setup");
  await runSuper();
});

task(TASK_CLEAN, async (_, __, runSuper) => {
  // await runSuper();
  setInitialState();
  console.log("Deploy clean");
});

task("deploy").setAction(
  async (_, { erasure, ethers, deployments }: BuidlerRuntimeEnvironment) => {

    const contracts = await deployments.deploySetup();

    console.log("Erasure deployed:", Object.keys(contracts));
    return contracts;
  }
);

extendConfig((config, userConfig) => {
  Object.keys(config.networks).forEach(name => {
    if ((config.networks[name] as any).erasureSetup === undefined) {
      (config.networks[name] as any).erasureSetup = defaultSetup;
    }
  });
  return config;
});

extendEnvironment((env: BuidlerRuntimeEnvironment) => {
  const chainIdGetter = createChainIdGetter(env.ethereum);
  env.erasure = new Erasure(env);
  env.deployments = new Deployments(env, chainIdGetter);
});
