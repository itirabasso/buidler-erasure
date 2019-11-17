import {
  TASK_CLEAN,
  TASK_RUN,
  TASK_TEST_SETUP_TEST_ENVIRONMENT
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
import {
  Contract,
  ContractFactory,
  Signer
} from "ethers";
import { existsSync } from "fs";
import {
  ensureDir,
  copy,
  readJsonSync,
  writeJSONSync,
  ensureFileSync
} from "fs-extra";

import { ErasureSetup, FactorySetup, RegistryNames, FactoryNames, ContractSetup, isFactorySetup, TemplateNames, TemplateSetup } from "./erasureSetup";
import { join } from "path";
import { TransactionReceipt, Provider } from "ethers/providers";
import { abiEncodeWithSelector } from "./utils";
import { BigNumber } from "ethers/utils";
import { defaultSetup } from "./defaultSetup";
import { eventNames } from "cluster";

usePlugin("@nomiclabs/buidler-ethers");
ensurePluginLoadedWithUsePlugin();

// TODO : this can be placed into the buidler's config.
const stateFilename = "state.json";
const readState = (): any => readJsonSync(stateFilename);
const writeState = (state: any): any =>
  writeJSONSync(stateFilename, state);
const setInitialState = () => writeState({});

// if the state file doesn't exist, it's created.
if (!existsSync(stateFilename)) {
  ensureFileSync(stateFilename);
  setInitialState();
}

export class Factory {
  constructor(public readonly factory: Contract, public readonly template: Contract) { }
}

export class Template {

}

export default function () {
  internalTask(
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

  task(TASK_TEST_SETUP_TEST_ENVIRONMENT, async (_, env, runSuper) => {
    await env.run("erasure:erasure-setup");
    await runSuper();
  });

  task(TASK_RUN, async (_, env, runSuper) => {
    await env.run("erasure:erasure-setup");
    await runSuper();
  });

  task(TASK_CLEAN, async (_, __, runSuper) => {
    await runSuper();
    setInitialState();
    console.log("Deploy clean");
  });

  internalTask("erasure:deploy-setup")
    .setAction(
      async (
        { setupFile }: { setupFile: string | undefined },
        { ethers, erasure, config }: BuidlerRuntimeEnvironment
      ) => {
        const signers = await ethers.signers();
        const deployer = signers[0];
        const erasureSetup: ErasureSetup = config.erasure.setup;

        const deployContract = async (name: string, setup: ContractSetup) => {

          let contract: Contract;
          if (setup.address === undefined) {
            if (isFactorySetup(setup)) {
              contract = await erasure.deployFactory(name, setup, deployer)
            } else {
              [contract] = await erasure.deploy(setup.artifact, [], deployer)
            }
            // console.log(name, 'is now at', contract.address)
            // config.erasure.setup[name].address = contract.address;

          } else {
            contract = await erasure.getContractInstance(setup.artifact, setup.address, deployer);
          }
          return contract;
        }

        async function executeSequentially(promises: Array<Promise<any>>) {
          const ret = []
          for (const p of promises) {
            console.log('aaa');
            const a = await p
            ret.push(a)
            console.log('bbb')
          }
          return ret;
        }

        // const contracts = await Promise.all(
        //   Object.entries(erasureSetup).map(
        //     ([name, setup]) => deployContract(name, setup)
        //   )
        // );

        // const nmrSetup = Object.entries(erasureSetup).find(([_, setup]) => setup.type === 'token')
        // if (nmrSetup === undefined) throw new Error('no nmr token');
        // let [contract, setup] = nmrSetup
        // const nmr = await deployContract(contract, setup);

        for (const [contract, setup] of Object.entries(erasureSetup)) {
          if (setup.type === 'factory') continue;
          await deployContract(contract, setup);
        }
        for (const [contract, setup] of Object.entries(erasureSetup)) {
          if (setup.type !== 'factory') continue;
          await deployContract(contract, setup);
        }
        //  await executeSequentially(Object.entries(erasureSetup)
        //   .filter(([_, setup]) => setup.type === "registry")
        //   .map(([contract, setup]) => deployContract(contract, setup)))

        // const templates = await executeSequentially(Object.entries(erasureSetup)
        //   .filter(([_, setup]) => setup.type === "template")
        //   .map(([contract, setup]) => deployContract(contract, setup)))

        // const factories = await executeSequentially(Object.entries(erasureSetup)
        //   .filter(([_, setup]) => setup.type === "factory")
        //   .map(([contract, setup]) => deployContract(contract, setup)))

        // const registries = await executeSequentially(Object.entries(erasureSetup)
        //   .filter(([_, setup]) => setup.type === "registry")
        //   .map(([contract, setup]) => deployContract(contract, setup)))

        // const templates = await executeSequentially(Object.entries(erasureSetup)
        //   .filter(([_, setup]) => setup.type === "template")
        //   .map(([contract, setup]) => deployContract(contract, setup)))

        // const factories = await executeSequentially(Object.entries(erasureSetup)
        //   .filter(([_, setup]) => setup.type === "factory")
        //   .map(([contract, setup]) => deployContract(contract, setup)))

        // const nmrSigner = ethers.provider.getSigner("0x9608010323ed882a38ede9211d7691102b4f0ba0");
        // let nmr;
        // if (setup.nmrToken.address === undefined) {
        //   [nmr] = await erasure.deploy(setup.nmrToken.artifact, [], deployer);
        // } else {
        //   nmr = await erasure.getContractInstance(setup.nmrToken.artifact, setup.nmrToken.address, deployer);
        // }

        // const registries: { [key: string]: Contract } = {};
        // for (const [name, registry] of Object.entries(setup.registries)) {
        //   if (registry.address === undefined) {
        //     registries[name] = await erasure.deployRegistry(registry.artifact, deployer);
        //   } else {
        //     registries[name] = await erasure.getContractInstance(registry.artifact, registry.address, deployer);
        //   }

        // }
        // const templates: { [key: string]: Contract } = {};
        // for (const [name, template] of Object.entries(setup.templates)) {
        //   if (template.address === undefined) {
        //     templates[name] = await erasure.deployRegistry(template.artifact, deployer);
        //   } else {
        //     templates[name] = await erasure.getContractInstance(template.artifact, template.address, deployer);
        //   }
        // }
        // const factories: { [key: string]: Contract } = {};
        // for (const [name, factorySetup] of Object.entries(setup.factories)) {
        //   const { template, registry } = factorySetup.config;
        //   if (factorySetup.address === undefined) {
        //     factories[name] = await erasure.deployFactory(factorySetup.artifact, template, registry, deployer);
        //   } else {
        //     // factories[name] = await erasure.getFactory(factorySetup)
        //     factories[name] = await erasure.getContractInstance(factorySetup.artifact, factorySetup.address, deployer);

        //   }
        // }

        console.log("Erasure deployed");
        // return [nmr, registries, templates, factories];
      }
    );

  extendConfig((config, userConfig) => {
    config.erasure = {
      setup: defaultSetup
    }
    config.erasure = { ...config.erasure, ...userConfig.erasure }
  });
  extendEnvironment((env: BuidlerRuntimeEnvironment) => {
    const getSigner = async (account?: Signer | string) => {
      return account === undefined
        ? (await env.ethers.signers())[0]
        : typeof account === "string"
          ? env.ethers.provider.getSigner(account)
          : account;
    };
    const processValues = async (dirtyValues: any[]) => {
      let v = await Promise.all(dirtyValues.map(v => Signer.isSigner(v) ? v.getAddress() : v))
      v = await Promise.all(v.map(v => typeof (v) === 'number' ? new BigNumber(v) : v))
      return v
    };

    // etherlime wrapper to integrate buidler in the erasure-protocol tests
    const etherlimeWrapper = (contract: Contract): Contract => {
      Object.defineProperty(contract, "from", {
        value: (signer: Signer) => {
          return contract.connect(signer);
        }
      });
      Object.defineProperty(contract, "waitForReceipt", {
        value: async (tx: any) => {
          return env.ethers.provider.getTransactionReceipt(
            tx === "string" ? tx : tx.hash
          );
        }
      });
      Object.defineProperty(contract, "verboseWaitForTransaction", {
        value: async (tx: any) => contract.waitForReceipt(tx)
      });
      Object.defineProperty(contract, "contractAddress", {
        get: () => contract.address
      });
      return contract;
    };

    env.erasure = lazyObject(() => {
      const getChainId = createChainIdGetter(env.ethereum);
      return {
        getDeployedAddresses: async (name: string, chainId?: number): Promise<string[]> => {
          const state = readState();
          if (chainId === undefined) {
            chainId =
              env.network.config.chainId === undefined
                ? await getChainId()
                : env.network.config.chainId;
          }

          if (
            state[chainId] === undefined ||
            state[chainId][name] === undefined ||
            state[chainId][name].length === 0
          ) {
            // chainId wasn't used before or contract wasn't deployed
            return [];
          }

          // TODO : not sure about this
          return state[chainId][name];
        },

        getLastDeployedContract: async (name: string, chainId?: number): Promise<Contract> => {
          return (await env.erasure.getDeployedContracts(name, chainId))[0];
        },
        getDeployedContracts: async (
          name: string,
          chainId?: number
        ): Promise<Contract[]> => {
          const factory = await env.ethers.getContract(name);
          const addresses = await env.erasure.getDeployedAddresses(
            name, chainId
          );
          const artifact = readArtifactSync(env.config.paths.artifacts, name);

          // TODO : should use deployedBytecode instead?
          if (artifact.bytecode !== factory.bytecode) {
            console.warn(
              "Deployed contract",
              name,
              " does not match compiled local contract"
            );
          }

          return addresses.map((addr: string) =>
            factory.attach(addr)
          );
        },

        saveDeployedContract: async (
          name: string,
          instance: any
        ): Promise<void> => {
          const state = readState();
          if (name === undefined) {
            throw new Error("saving contract with no name");
          }


          const chainId =
            env.network.config.chainId === undefined
              ? await getChainId()
              : env.network.config.chainId;

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
        deploy: async (
          contractName: string,
          params: any[],
          signer?: Signer | string
        ): Promise<[Contract, TransactionReceipt]> => {
          const contractFactory = await env.ethers.getContract(contractName);
          contractFactory.connect(await getSigner(signer));
          const contract = await contractFactory.deploy(...params);
          await contract.deployed();

          await env.erasure.saveDeployedContract(contractName, contract);
          const receipt = await env.ethers.provider.getTransactionReceipt(
            contract.deployTransaction.hash!
          );
          console.log("Deployed", contractName, "at", contract.address);
          return [contract, receipt];
        },

        deployRegistry: async (registryName: RegistryNames, signer: Signer | string): Promise<Contract> => {
          const [registry] = await env.erasure.deploy(registryName, [], await getSigner(signer));
          // env.config.erasure.setup.registries[registryName].address = registry.address;
          return registry;
        },


        deployFactory: async (
          name: string,
          setup: FactorySetup,
          signer: Signer | string
        ): Promise<Contract> => {
          // ): Promise<Factory> => {
          signer = await getSigner(signer);
          const registry = await env.erasure.getContractInstance(setup.registry);
          const template = await env.erasure.getContractInstance(setup.template)

          const [factory] = await env.erasure.deploy(
            setup.artifact,
            [registry.address, template.address],
            signer
          );
          await registry.addFactory(factory.address, "0x");
          // env.config.erasure.setup.factories[factoryName].address = factory.address;
          // env.config.erasure.setup.templates[templateName].address = template.address;

          // return new Factory(factory, template);
          return factory;
        },

        getContractInstance: async (
          name: string,
          address?: string,
          account?: string | Signer
        ): Promise<Contract> => {
          const signer = await getSigner(account);

          const setup = env.config.erasure.setup[name];
          if (address === undefined) {
            if (setup.address === undefined) {
              address = (await env.erasure.getLastDeployedContract(setup.artifact)).address
            } else {
              address = setup.address;
            }
          }

          if (!Provider.isProvider(signer.provider)) {
            throw new Error("signer has no provider")
          }

          const { abi, bytecode } = readArtifactSync(
            env.config.paths.artifacts,
            name
          );
          const factory = new ContractFactory(abi, bytecode, signer);
          console.log('Connect', name, 'to', address);
          return factory.attach(address);
        },

        getFactory: async (
          factory: FactorySetup
        ): Promise<Contract> => {
          return env.erasure.getContractInstance(factory.template);
          // TODO : podría agregar el address en el setup cuando deployo y evitar esta logica
          // const factoryInstance = factory.address === undefined ? env.erasure.getLastDeployedContract(factory.artifact) :
          //   env.erasure.getContractInstance(factory.artifact, factory.address)
          // const tempalteInstance = factory.
          //   env.config.erasure.setup.templates
          // return env.erasure.getLastDeployedContract(typeof (factory) === 'string' ? factory : factory.artifact);
          // } else {
          // return env.erasure.getContractInstance(factory.artifact, factory.address);
          // }
        },

        // Creates an instance from a Factory.
        createInstance: async (
          template: TemplateNames,
          params: any[],
          values: any[]
        ): Promise<Contract> => {

          const getFactoryName = (name: TemplateNames, setup: TemplateSetup) => {
            // TODO : the suffix can be configurable
            return setup.factory !== undefined ? setup.factory : name + "_Factory"
          }

          const setup = env.config.erasure.setup;
          const templateSetup = setup[template] as TemplateSetup
          const factorySetup = setup[getFactoryName(template, templateSetup)];


          const factoryInstance = await env.erasure.getContractInstance(factorySetup.artifact, factorySetup.address);
          const templateInstance = await env.erasure.getContractInstance(templateSetup.artifact, templateSetup.address);
          values = await processValues(values);

          const callData = abiEncodeWithSelector("initialize", params, values);
          const tx = await factoryInstance.create(callData)
          const receipt = await env.ethers.provider.getTransactionReceipt(tx.hash);
          for (const log of receipt.logs!) {
            const event = factoryInstance.interface.parseLog(log);
            if (event !== null && event.name === "InstanceCreated") {
              const c = new Contract(
                event.values.instance,
                templateInstance.interface.abi,
                factoryInstance.signer
              );
              return c;
            }
          }
          throw new Error("unable to create an instance")
        },

        // Creates a agreement
        createAgreement: async (
          operator: Signer | string,
          staker: Signer | string,
          counterparty: Signer | string,
          ratio: number | BigNumber,
          ratioType: 1 | 2 | 3, // TODO : define a type for this
          countdown?: number,
          metadata: string = "0x0"
        ): Promise<Contract> => {
          const agreementTemplate: TemplateNames =
            countdown === undefined
              ? "SimpleGriefing"
              : "CountdownGriefing";

          const params =
            countdown === undefined
              ? ["address", "address", "address", "uint256", "uint8", "bytes"]
              : ["address", "address", "address", "uint256", "uint8", "uint256", "bytes"];
          const values =
            countdown === undefined
              ? [operator, staker, counterparty, ratio, ratioType, metadata]
              : [operator, staker, counterparty, ratio, ratioType, countdown, metadata];

          const agreement = await env.erasure.createInstance(
            agreementTemplate,
            params,
            values
          );
          return agreement;
        },
      };
    });
  });
}
