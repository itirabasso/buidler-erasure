import {
  TASK_CLEAN,
  TASK_RUN,
  TASK_TEST
} from "@nomiclabs/buidler/builtin-tasks/task-names";
import {
  extendConfig,
  extendEnvironment,
  internalTask,
  task,
  types,
  usePlugin
} from "@nomiclabs/buidler/config";
import { createChainIdGetter } from "@nomiclabs/buidler/internal/core/providers/provider-utils";
import {
  ensurePluginLoadedWithUsePlugin,
  lazyObject,
  readArtifactSync
} from "@nomiclabs/buidler/plugins";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { Contract, ContractFactory, Signer, utils } from "ethers";
import { existsSync } from "fs";
import { ensureFileSync, readJsonSync, writeJSONSync } from "fs-extra";

import { defaultSetup } from "./defaultSetup";
import { ErasureDeploySetup } from "./erasureSetup";
import { abiEncodeWithSelector } from "./utils";
import { BigNumber } from "ethers/utils";

usePlugin("@nomiclabs/buidler-ethers");
ensurePluginLoadedWithUsePlugin();

// TODO : this can be placed into the buidler's config.
const stateFilename = "state.json";
export const readState = (): any => readJsonSync(stateFilename);
export const writeState = (state: any): any =>
  writeJSONSync(stateFilename, state);
export const setInitialState = () => writeState({});

// if the state file doesn't exist, it's created.
if (!existsSync(stateFilename)) {
  ensureFileSync(stateFilename);
  setInitialState();
}

export default function() {
  task(TASK_TEST, async (_, env, runSuper) => {
    await env.run("erasure:deploy-full");
    await runSuper();
  });

  task(TASK_RUN, async (_, env, runSuper) => {
    await env.run("erasure:deploy-full");
    await runSuper();
  });

  task(TASK_CLEAN, async (_, __, runSuper) => {
    await runSuper();
    setInitialState();
    console.log("Deploy clean");
  });

  task("erasure:deploy-full", "Deploy the full platform")
    .addOptionalParam("setupFile", "The file that defines the deploy setup")
    .setAction(
      async (
        { setupFile }: { setupFile: string | undefined },
        { run, ethers, erasure }: BuidlerRuntimeEnvironment
      ) => {
        const signers = await ethers.signers();
        const deployer = signers[0];

        // TODO : use setupFile if defined
        const setup: ErasureDeploySetup = erasure.deploySetup;

        const nmr = await run("erasure:deploy-numerai", {
          deployer,
          nmr: setup.nmrToken
        });
        const registries = await run("erasure:deploy-registries", {
          deployer,
          registries: setup.registries
        });
        const factories = await run("erasure:deploy-factories", {
          deployer,
          factories: setup.factories
        });

        return [nmr, registries, factories];
      }
    );

  task(
    "erasure:create-instance",
    "Creates a new instance from a factory"
  ).setAction(
    async (
      {
        factoryName,
        templateName,
        params,
        values
      }: {
        factoryName: string;
        templateName: string;
        params: any[];
        values: any[];
      },
      { erasure }: BuidlerRuntimeEnvironment
    ) => {
      return erasure.createInstance(factoryName, templateName, params, values);
    }
  );

  task("erasure:create-agreement", "Creates an Simple Agreement")
    .addParam("operator", "Agreement's operator address")
    .addParam("staker", "Agreement's staker address")
    .addParam("counterparty", "Agreement's counterparty address")
    .addParam("ratio", "Agreement's ratio value", "1") // it throws if I don't specify param's type.
    .addParam("ratioType", "Agreement's ratio type", 2, types.int)
    .addParam("metadata", "Agreement's metadata", "0x0")
    .addOptionalParam("countdown", "Optional. Agreement's countdown")
    .setAction(async (args, { erasure }: BuidlerRuntimeEnvironment) => {
      const {
        operator,
        staker,
        counterparty,
        ratio,
        ratioType,
        metadata,
        countdown
      } = args;
      const griefing = await erasure.createAgreement(
        operator,
        staker,
        counterparty,
        utils.parseEther(ratio),
        ratioType,
        metadata,
        countdown
      );
      return griefing;
    });

  task("erasure:stake", "Stake NMR in an Simple Griefing agreement")
    .addParam("address", "Agreement's address")
    .addParam("currentStake", "Current agreement's stake", 0, types.int)
    .addParam("amountToAdd", "Amount to add to the stake", 0, types.int)
    .addOptionalParam("account", "Optional. The staker. Account 0 by default")
    .setAction(async (args, { ethers, erasure }: BuidlerRuntimeEnvironment) => {
      const { address, currentStake, amountToAdd, account } = args;

      const tx = await erasure.stake(
        address,
        currentStake,
        amountToAdd,
        account
      );
      return tx;
    });

  extendEnvironment((env: BuidlerRuntimeEnvironment) => {
    const getSigner = async (account?: Signer | string) => {
      return account === undefined
        ? (await env.ethers.signers())[0]
        : typeof account === "string"
        ? env.ethers.provider.getSigner(account)
        : account;
    };

    env.erasure = lazyObject(() => {
      const getChainId = createChainIdGetter(env.ethereum);
      const setup: ErasureDeploySetup = defaultSetup;
      return {
        deploySetup: setup,
        getDeployedAddresses: async (name: string): Promise<string[]> => {
          const state = readState();
          const network = env.network.config;
          const chainId =
            network.chainId === undefined
              ? await getChainId()
              : network.chainId;

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
          const addresses = await env.erasure.getDeployedAddresses(name);

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
            network.chainId === undefined
              ? await getChainId()
              : network.chainId;

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
              // console.warn(
              //   "The last deployed contract has the same address as the new one"
              // );
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
        },

        getContractInstance: (
          name: string,
          address: string,
          account: string | Signer
        ): Contract => {
          const signer =
            typeof account === "string"
              ? env.ethers.provider.getSigner(account)
              : account;
          const { abi, bytecode } = readArtifactSync(
            env.config.paths.artifacts,
            name
          );
          const factory = new ContractFactory(abi, bytecode, signer);
          return factory.attach(address);
        },

        // Creates an instance from a Factory.
        createInstance: async (
          factory: any, // Contract | string.
          template: any, // template/factory could be automatically resolved.
          params: any[],
          values: any[]
        ): Promise<Contract> => {
          const factoryContract = (
            await env.erasure.getDeployedContracts(factory)
          )[0];
          const templateContract = (
            await env.erasure.getDeployedContracts(template)
          )[0];

          const tx = await factoryContract.create(
            abiEncodeWithSelector("initialize", params, values)
          );

          const receipt = await env.ethers.provider.getTransactionReceipt(
            tx.hash
          );
          for (const log of receipt.logs!) {
            const event = factory.interface.parseLog(log);
            if (event !== null && event.name === "InstanceCreated") {
              return new Contract(
                event.values.instance,
                templateContract.interface.abi,
                factoryContract.signer
              );
            }
          }

          throw new Error("Fail to create instance");
        },

        // Creates a agreement
        createAgreement: async (
          operator: Signer | string,
          staker: Signer | string,
          counterparty: Signer | string,
          ratio: number | BigNumber,
          ratioType: 1 | 2 | 3, // TODO : define a type for this
          metadata: string,
          countdown?: number
        ): Promise<Contract> => {
          const { factories } = env.erasure.deploySetup;

          const agreementType =
            countdown === undefined
              ? factories.SimpleGriefing
              : factories.CountdownGriefing;

          const factory = agreementType.config.factory;
          const template = agreementType.config.template;

          const params = [
            "address",
            "address",
            "address",
            "uint256",
            "uint8",
            "bytes"
          ];
          const values = [
            operator,
            staker,
            counterparty,
            ratio,
            ratioType,
            metadata
          ];
          const agreement = env.erasure.createInstance(
            factory,
            template,
            params,
            values
          );
          return agreement;
        },

        // Stake NMR in an agreement
        stake: async (
          agreement: Contract | string,
          currentStake: number,
          amountToAdd: number,
          account?: Signer | string
        ): Promise<any> => {
          const signer = await getSigner(account);

          let contract;
          if (typeof agreement === "string") {
            contract = env.erasure.getContractInstance(
              // it's a little bit lengthy but you can autocomplete it.
              env.erasure.deploySetup.factories.SimpleGriefing.config.template,
              agreement,
              signer
            );
          } else {
            contract = agreement;
          }
          const tx = await contract.increaseStake(currentStake, amountToAdd);
          console.log(tx);
          return tx;
        },

        punish: async (
          agreementAddress: string,
          currentStake: number,
          punishment: number,
          message: string = "0x0",
          account?: Signer | string
        ): Promise<number> => {
          const signer = await getSigner(account);
          const agreement = env.erasure.getContractInstance(
            // it's a little bit lengthy but you can autocomplete it.
            env.erasure.deploySetup.factories.SimpleGriefing.config.template,
            agreementAddress,
            signer
          );
          const tx = await agreement.punish(currentStake, punishment, message);
          console.log(tx);
          return tx;
        },
        reward: async (
          agreementAddress: string,
          currentStake: number,
          amountToAdd: number,
          account?: Signer | string
        ): Promise<void> => {
          const signer = await getSigner(account);
          const agreement = env.erasure.getContractInstance(
            // it's a little bit lengthy but you can autocomplete it.
            env.erasure.deploySetup.factories.SimpleGriefing.config.template,
            agreementAddress,
            signer
          );
          const tx = await agreement.reward(currentStake, amountToAdd);
          console.log(tx);
          return tx;
        }
      };
    });
  });
}
