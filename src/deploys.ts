import { extendEnvironment, task, usePlugin } from "@nomiclabs/buidler/config";
import {
  ensurePluginLoadedWithUsePlugin,
  lazyObject,
  readArtifact,
  readArtifactSync
} from "@nomiclabs/buidler/plugins";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { createChainIdGetter } from "@nomiclabs/buidler/internal/core/providers/provider-utils";

import { Contract } from "ethers";
import { existsSync } from "fs";
import { ensureFileSync, readJsonSync, writeJSONSync } from "fs-extra";

usePlugin("@nomiclabs/buidler-ethers");

ensurePluginLoadedWithUsePlugin();

// TODO : this can be placed into the buidler's config.
const stateFilename = "state.json";
const readState = (): any => readJsonSync(stateFilename);
const writeState = (state: any): any => writeJSONSync(stateFilename, state);
const setInitialState = () => writeState({});

// if the state file doesn't exist, it's created.
if (!existsSync(stateFilename)) {
  ensureFileSync(stateFilename);
  setInitialState();
}

// TODO : it should receive the contracts that we want to clean
task("clean", async (args: any, env: any, runSuper: any) => {
  // await runSuper();
  setInitialState();
  console.log("deploy clean");
});

task("deploy")
  .addParam("name")
  .setAction(
    async (
      { name, params }: { name: string; params: any[] },
      env: any,
      runSuper: any
    ) => {
      // TODO : params' type check?
      const contractParams = params === undefined ? [] : params;

      // FIXME : override getContract function to receive a signer.
      const contractFactory = await env.ethers.getContract(name);
      const contract = await contractFactory.deploy(...contractParams);
      await env.deployments.saveDeployedContract(name, contract);
      return contract;
    }
  );

extendEnvironment((env: BuidlerRuntimeEnvironment & any) => {
  env.deployments = lazyObject(() => {
    const getChainId = createChainIdGetter(env.ethers.provider);
    // const getChainId = () => 99999;
    return {
      getDeployedAddresses: async (name: string): Promise<string[]> => {
        const state = readState();
        const network = env.network.config;
        const chainId =
          network.chainId === undefined ? await getChainId() : network.chainId;

        if (
          state[chainId] === undefined ||
          state[chainId][name] === undefined ||
          state[chainId][name].length === 0
        ) {
          // chainId wasn't used before, contract wasn't deployed or the addresses were manually remove from state
          return [];
        }

        // TODO : not sure about this
        return state[chainId][name];
      },

      getDeployedContracts: async (name: string): Promise<Contract[]> => {
        const addresses = await env.deployments.getDeployedAddresses(name);
        // console.log("Found these addresses for", name, addresses);

        const factory = await env.ethers.getContract(name);
        const artifact = readArtifactSync(env.config.paths.artifacts, name);

        // TODO : should use deployedBytecode instead?
        if (artifact.bytecode !== factory.bytecode) {
          console.warn(
            "Deployed contract",
            name,
            " does not match compiled local contract"
          );
        }

        return addresses.map((addr: string) => factory.attach(addr));
      },

      saveDeployedContract: async (
        name: string,
        instance: any
      ): Promise<void> => {
        const state = readState();
        if (name === undefined) {
          throw new Error("saving contract with no name");
        }
        const network = env.network.config;

        const chainId =
          network.chainId === undefined ? await getChainId() : network.chainId;

        const isDeployed =
          state[chainId] !== undefined &&
          state[chainId][name] !== undefined &&
          state[chainId][name].length > 0;

        // is it already deployed?
        if (isDeployed) {
          const [last, ...previous] = state[chainId][name];

          if (last !== instance.address) {
            // place the new instance address first to the list
            state[chainId][name] = [instance.address, last, ...previous];
          } else {
            // If the last deployed instance has the same address as the new instance,
            // do not update the list of addresses
            console.warn(
              "The last deployed contract has the same address as the new one"
            );
          }
        } else {
          const addresses = [instance.address];
          // check if the chain is defined.
          if (state[chainId] === undefined) {
            // place the first contract with this chainId
            state[chainId] = {
              [name]: addresses
            };
          } else {
            // just add the new contract to the state.
            state[chainId][name] = addresses;
          }
        }
        // update state
        writeState(state);
      }
    };
  });
});
