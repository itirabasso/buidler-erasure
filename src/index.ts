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


const deployNMRToken = async (setup, nmrSigner, { erasure, ethers }) => {
  const signers = await ethers.signers();
  // if (await nmrSigner.impersonate()) {
  // send ether to the nmr signer
  const giver = signers[9];
  // console.log('pre balance giver', await ethers.provider.getBalance(await giver.getAddress()))
  // console.log('pre balance nmr signer', await ethers.provider.getBalance(await nmrSigner.getAddress()))

  await signers[9].sendTransaction({
    to: setup.signer,
    value: utils.parseEther("5")
  });
  // console.log('post balance giver', await ethers.provider.getBalance(await giver.getAddress()))
  // console.log('post balance nmr', await ethers.provider.getBalance(await nmrSigner.getAddress()))
  // console.log('sent moneys')
  // increment nmr signer nonce by 1

  await nmrSigner.sendTransaction({
    to: await nmrSigner.getAddress(),
    value: 0
  });

  return erasure.deployContract(setup, nmrSigner);
};

task("deploy").setAction(
  async (_, { erasure, ethers, deployments }: BuidlerRuntimeEnvironment) => {
    const signers = await ethers.signers();
    const deployer = signers[0];

    const contracts = await deployments.deploySetup();

    // for (const setup of sortedContracts) {
    //   if (setup.address === undefined) {
    //     switch (setup.type) {
    //       case "token":
    //         if (setup.signer === undefined) {
    //           setup.signer = "0x9608010323ed882a38ede9211d7691102b4f0ba0";
    //         }
    //         const p = ethers.provider;
    //         p.resolveName = async(addr) => addr;
    //         let nmrSigner = new FakeSigner(setup.signer, p);

    //         contracts[setup.artifact] = await deployNMRToken(setup, nmrSigner, {
    //           ethers,
    //           erasure
    //         });
    //         break;

    //       case "registry":
    //       case "template":
    //       case "factory":
    //         contracts[setup.artifact] = await erasure.deployContract(
    //           setup,
    //           deployer
    //         );
    //         break;
    //     }
    //   } else {
    //     contracts[setup.artifact] = await erasure.getContractInstance(
    //       setup.artifact,
    //       setup.address,
    //       deployer
    //     );
    //   }


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
