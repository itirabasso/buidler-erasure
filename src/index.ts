import {
  TASK_CLEAN,
  TASK_RUN,
  TASK_TEST
} from "@nomiclabs/buidler/builtin-tasks/task-names";
import {
  extendEnvironment,
  internalTask,
  task,
  types,
  usePlugin,
  extendConfig
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
import {
  copy,
  ensureDir,
  ensureFileSync,
  readJsonSync,
  writeJSONSync
} from "fs-extra";
import { join } from "path";

import { defaultSetup } from "./defaultSetup";
import { ErasureDeploySetup } from "./erasureSetup";
import { abiEncodeWithSelector } from "./utils";
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
  task(
    "erasure:copy-contracts",
    "Temporal task. Copy the erasure protocol contracts into your project's sources folder.",
    async (_, { config }) => {
      await ensureDir(config.paths.sources);
      await copy(
        join(config.paths.root, "/node_modules/erasure-protocol/contracts"),
        config.paths.sources
      );
    }
  );
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
    console.log("deploy clean");
  });

  internalTask("erasure:deploy").setAction(
    async (
      { name, params }: { name: string; params: any[] },
      { ethers, erasure }: BuidlerRuntimeEnvironment
    ) => {
      // TODO : params' type check?
      const contractParams = params === undefined ? [] : params;

      // FIXME : override getContract function to receive a signer.
      const contractFactory = await ethers.getContract(name);
      const contract = await contractFactory.deploy(...contractParams);
      await erasure.saveDeployedContract(name, contract);

      const receipt = await ethers.provider.getTransactionReceipt(
        contract.deployTransaction.hash!
      );
      return [contract, receipt];
    }
  );

  // TODO : this task seems unnecessary
  internalTask("erasure:deploy-contract").setAction(
    async (
      { name, params, signer }: { name: string; params: any[]; signer: any },
      { run }: BuidlerRuntimeEnvironment
    ) => {
      // console.log("deploy:deploy-contract", name, params);
      const [contract, _] = await run("erasure:deploy", {
        name,
        params,
        signer
      });
      return contract;
    }
  );

  internalTask("erasure:deploy-factory").setAction(
    async (
      {
        factory,
        template,
        registry,
        signer
      }: { factory: string; template: string; registry: any; signer: any },
      { run, erasure }: BuidlerRuntimeEnvironment
    ) => {
      const registryInstance = (
        await erasure.getDeployedContracts(registry)
      )[0];

      // console.log("deploying template", registryInstance.address);
      const templateContract = await run("erasure:deploy-contract", {
        name: template,
        params: [],
        signer
      });
      // console.log("deploying factory", factory);
      const factoryContract = await run("erasure:deploy-contract", {
        name: factory,
        params: [registryInstance.address, templateContract.address],
        signer
      });
      await registryInstance.addFactory(factoryContract.address, "0x");
      return [templateContract, factoryContract];
    }
  );

  internalTask("erasure:deploy-factories")
    .addParam(
      "factories",
      "List of factories name to deploy (separated by comma)"
    )
    .addParam("deployer")
    .setAction(
      async (
        { deployer, factories }: { deployer: any; factories: any },
        { run }: BuidlerRuntimeEnvironment
      ) => {
        console.log("Deploying Factories");

        const fs = {};
        for (const [name, factory] of Object.entries(factories)) {
          const { config }: any = factory;
          Object.assign(fs, {
            [name]: await run("erasure:deploy-factory", {
              ...config,
              signer: deployer
            })
          });
        }

        return fs;
      }
    );

  internalTask("erasure:deploy-registries")
    .addParam(
      "registries",
      "List of registries name to deploy (separated by comma)"
    )
    .addParam("deployer")
    .setAction(
      async (
        { deployer, registries }: { deployer: any; registries: any },
        { run }: BuidlerRuntimeEnvironment
      ) => {
        console.log("Deploying Registries");

        const rs = {};

        for (const [name, _] of Object.entries(registries)) {
          Object.assign(rs, {
            [name]: await run("erasure:deploy-contract", {
              name,
              params: [],
              signer: deployer
            })
          });
        }

        return rs;
      }
    );

  internalTask(
    "erasure:deploy-numerai",
    "Deploys the Numerai main contract"
  ).setAction(
    async ({ deployer, nmr }: { deployer: any; nmr: string }, { run }: any) => {
      console.log("Deploying", nmr);
      return run("erasure:deploy-contract", {
        name: nmr,
        params: [],
        signer: deployer
      });
    }
  );

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

  // TODO : This can receive the _entity_ instead of the factory and template names.
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
      { ethers, erasure }: BuidlerRuntimeEnvironment
    ) => {
      const factory = (await erasure.getDeployedContracts(factoryName))[0];
      const template = (await erasure.getDeployedContracts(templateName))[0];

      const tx = await factory.create(
        abiEncodeWithSelector("initialize", params, values)
      );

      const receipt = await ethers.provider.getTransactionReceipt(tx.hash);

      for (const log of receipt.logs!) {
        const event = factory.interface.parseLog(log);
        if (event !== null && event.name === "InstanceCreated") {
          return new Contract(
            event.values.instance,
            template.interface.abi,
            factory.signer
          );
        }
      }
    }
  );

  task("erasure:create-agreement", "Creates an Simple Agreement")
    .addParam("operator", "Agreement's operator")
    .addParam("staker", "Agreement's staker")
    .addParam("counterparty", "Agreement's counterparty")
    .addParam("ratio", "Agreement's ratio value", "1") // throw if I don't specify param's type.
    .addParam("ratioType", "Agreement's ratio type", 2, types.int)
    .addParam("metadata", "Agreement's metadata", "0x0")
    .addOptionalParam("countdown", "Optional. Agreement's countdown")
    .setAction(async (args, { run }: any) => {
      const {
        operator,
        staker,
        counterparty,
        ratio,
        ratioType,
        metadata,
        countdown
      } = args;

      // TODO : use countdown to differentiate between Simple and Countdown Griefing

      const griefing = await run("erasure:create-instance", {
        factoryName: "SimpleGriefing_Factory",
        templateName: "SimpleGriefing",
        params: ["address", "address", "address", "uint256", "uint8", "bytes"],
        values: [
          operator._address,
          staker._address,
          counterparty._address,
          utils.parseEther(ratio),
          ratioType,
          metadata
        ]
      });

      return griefing;
    });

  task("erasure:stake", "Stake NMR in an Simple Griefing agreement")
    .addParam("address", "Agreement's address")
    .addParam("currentStake", "Current agreement's stake", 0, types.int)
    .addParam("amountToAdd", "Amount to add to the stake", 0, types.int)
    .addOptionalParam("account", "The staker. Optional, account 0 by default")
    .setAction(async (args, { ethers, erasure }: BuidlerRuntimeEnvironment) => {
      const { address, currentStake, amountToAdd, account } = args;

      const signer =
        account === undefined
          ? (await ethers.signers())[0]
          : ethers.provider.getSigner(account);

      const agreement = erasure.getContractInstance(
        // it's a little bit lengthy but you can autocomplete it.
        erasure.deploySetup.factories.SimpleGriefing.config.template,
        address,
        signer
      );

      const tx = await agreement.increaseStake(currentStake, amountToAdd);
      console.log(tx);
      return tx;
    });

  extendEnvironment((env: BuidlerRuntimeEnvironment) => {
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
        }
      };
    });
  });
}
