import { extendEnvironment, task, usePlugin } from "@nomiclabs/buidler/config";
import {
  ensurePluginLoadedWithUsePlugin,
  lazyObject
} from "@nomiclabs/buidler/plugins";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
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
  await runSuper();
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
      console.log(name, params);
      // update artifacts
      // await env.run("compile");

      const contractFactory = await env.ethers.getContract(name);
      const contract = await contractFactory.deploy(...contractParams);
      await env.deployments.saveDeployedContract(name, contract);
      return contract;
    }
  );

extendEnvironment((env: BuidlerRuntimeEnvironment) => {
  env.deployments = lazyObject(() => {
    return {
      getDeployedAddresses: (name: string): string[] => {
        const state = readState();

        const network = env.network.config;
        const chainId = network.chainId === undefined ? 9999 : network.chainId;

        if (
          state[chainId] === undefined ||
          state[chainId][name] === undefined ||
          state[chainId][name].length === 0
        ) {
          return [];
        }
        // TODO : not sure about this
        return state[chainId][name];
      },

      getDeployedContracts: async (name: string): Promise<Contract[]> => {
        const addresses = env.deployments.getDeployedAddresses(name);
        console.log("Found these addresses for", name, addresses);

        const factory = await (env as any).ethers.getContract(name);

        return Promise.all(
          addresses.map((addr: string) => {
            return factory.attach(addr);
          })
        );
      },

      saveDeployedContract: (name: string, instance: any): void => {
        const state = readState();
        if (name === undefined) {
          throw new Error("saving contract with no name");
        }
        const network = env.network.config;
        const chainId = network.chainId === undefined ? 9999 : network.chainId;

        const isDeployed = () => {
          return (
            state[chainId] !== undefined &&
            state[chainId][name] !== undefined &&
            state[chainId][name].length > 0
          );
        };

        // is it already deployed?
        if (isDeployed()) {
          // add it to the state.
          const addresses = state[chainId][name];
          addresses.unshift(instance.address);
          state[chainId][name] = addresses;
        } else {
          const addresses = [instance.address];
          // check if the chain is defined.
          if (state[chainId] === undefined) {
            // place the first contract with this chainId
            state[chainId] = {
              name: addresses
            };
          } else {
            // just add the new contract to the state.
            state[chainId][name] = addresses;
          }
        }
        // update state
        writeState(state);
        console.log("contract saved");
      }
    };
  });
});
