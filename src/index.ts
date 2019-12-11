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
  usePlugin
} from "@nomiclabs/buidler/config";
import { createChainIdGetter } from "@nomiclabs/buidler/internal/core/providers/provider-utils";
import {
  ensurePluginLoadedWithUsePlugin,
  lazyObject,
  readArtifact,
  readArtifactSync
} from "@nomiclabs/buidler/plugins";
import {
  BuidlerRuntimeEnvironment,
  NetworkConfig
} from "@nomiclabs/buidler/types";
import { decode, encode } from "ethereumjs-abi";
import { Contract, ContractFactory, Signer, utils } from "ethers";
import { Provider } from "ethers/providers";
import { base64, BigNumber } from "ethers/utils";
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
import {
  ContractSetup,
  ErasureSetup,
  FactorySetup,
  isFactorySetup,
  TemplateNames,
  TemplateSetup
} from "./erasureSetup";
import { FakeSigner } from "./fakeSigner";
import { abiEncodeWithSelector } from "./utils";

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

export class Factory {
  constructor(
    public readonly factory: Contract,
    public readonly template: Contract
  ) {}
}

export class Template {}

export default function() {
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

  // task(TASK_RUN, async (_, env, runSuper) => {
  //   await env.run("erasure:erasure-setup");
  //   await runSuper();
  // });

  task(TASK_CLEAN, async (_, __, runSuper) => {
    // await runSuper();
    setInitialState();
    console.log("Deploy clean");
  });

  internalTask("erasure:erasure-setup").setAction(
    async (_, { ethers, erasure, network }: BuidlerRuntimeEnvironment) => {
      const signers = await ethers.signers();
      const deployer = signers[0];
      const erasureSetup: ErasureSetup = erasure.getErasureSetup();

      const contracts: { [key: string]: Contract } = {};

      for (const setup of Object.values(erasureSetup)) {
        if (setup.type === "token") {
          // FIXME : ugly hack to fake transaction into BuidlerEVM
          // await signers[9].sendTransaction({ to: nmrSigner, value: utils.parseEther("10") })
          // const fakeData: any = {
          //   from: nmrSigner,
          //   value: "0x0"
          // }
          // await (ethereum as any)._ethModule.processRequest('eth_sendFakeTransaction', [fakeData]);
          // const fakeDeployTx: any = {
          //   from: nmrSigner,
          //   gas: "0x5B8D80",
          //   gasPrice: "0x2500",
          //   data: readArtifactSync(config.paths.artifacts, 'MockNMR').bytecode
          // }
          // await (ethereum as any)._ethModule.processRequest('eth_sendFakeTransaction', [fakeDeployTx]);
          // const nmrAddress = getContractAddress({from: nmrSigner, nonce: 1})
          // const nmr = await ethers.getContract(setup.artifact)
          // contracts[setup.artifact] = nmr.attach(nmrAddress).connect(deployer);

          const { provider } = network;

          // await provider.send('buidler_impersonateAccount', [setup.signer]);

          const nmrSigner =
            setup.signer === undefined
              ? deployer
              : new FakeSigner(setup.signer, ethers.provider);
          await signers[9].sendTransaction({
            to: setup.signer,
            value: utils.parseEther("10")
          });
          await nmrSigner.sendTransaction({ to: setup.signer, value: 0 });
          const nmr = await erasure.deployContract(setup, nmrSigner);
          contracts[setup.artifact] = nmr.connect(deployer);
        }
      }

      for (const setup of Object.values(erasureSetup)) {
        if (setup.type === "factory" || setup.type === "token") {
          continue;
        }
        const c = await erasure.deployContract(setup, deployer);
        contracts[setup.artifact] = c;
      }

      for (const setup of Object.values(erasureSetup)) {
        if (setup.type !== "factory") {
          continue;
        }
        const c = await erasure.deployContract(setup, deployer);
        contracts[setup.artifact] = c;
      }

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
    const getSigner = async (account?: Signer | string) => {
      return account === undefined
        ? (await env.ethers.signers())[0]
        : typeof account === "string"
        ? env.ethers.provider.getSigner(account)
        : account;
    };
    /**
     * converts every element in the following way:
     *   any signer into an address
     *   any number into a big number
     */
    const processValues = async (dirtyValues: any[]) => {
      let v = await Promise.all(
        dirtyValues.map(val => (Signer.isSigner(val) ? val.getAddress() : val))
      );
      v = v.map(val => (typeof val === "number" ? new BigNumber(val) : val));
      return v;
    };

    const getContract = async (name: string, signer?: Signer | string) => {
      signer = await getSigner(signer);
      const artifact = await readArtifact(env.config.paths.artifacts, name);
      const bytecode = artifact.bytecode;
      return new ContractFactory(artifact.abi, bytecode, signer);
    };

    env.erasure = lazyObject(() => {
      const getChainId = createChainIdGetter(env.ethereum);
      return {
        setup: (env.network as any).erasureSetup,
        getDeployedAddresses: async (
          name: string,
          chainId?: number
        ): Promise<string[]> => {
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

        getLastDeployedContract: async (
          name: string,
          chainId?: number
        ): Promise<Contract> => {
          return (await env.erasure.getDeployedContracts(name, chainId))[0];
        },
        getDeployedContracts: async (
          name: string,
          chainId?: number
        ): Promise<Contract[]> => {
          const factory = await getContract(name);
          const addresses = await env.erasure.getDeployedAddresses(
            name,
            chainId
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
        getErasureSetup(): ErasureSetup {
          // return (env.config.networks[env.network.name] as any).erasureSetup;
          return (env.network.config as any).erasureSetup.contracts;
        },
        deploy: async (
          contractName: string,
          params: any[],
          signer?: Signer | string
        ): Promise<[Contract, any]> => {
          const contractFactory = await getContract(contractName, signer);
          contractFactory.connect(await getSigner(signer));

          const contract = await contractFactory.deploy(...params);
          await contract.deployed();

          console.log("Deployed", contractName, "at", contract.address);
          await env.erasure.saveDeployedContract(contractName, contract);
          const receipt = await env.ethers.provider.getTransactionReceipt(
            contract.deployTransaction.hash!
          );
          return [contract, receipt];
        },
        deployContract: async (
          setup: ContractSetup,
          deployer?: Signer | string
        ): Promise<Contract> => {
          let contract: Contract;
          if (setup.address === undefined) {
            if (isFactorySetup(setup)) {
              contract = await env.erasure.deployFactory(setup, deployer);
            } else {
              const ret = await env.erasure.deploy(
                setup.artifact,
                [],
                deployer
              );
              contract = ret[0];
            }
          } else {
            contract = await env.erasure.getContractInstance(
              setup.artifact,
              setup.address,
              deployer
            );
          }
          return contract;
        },
        deployFactory: async (
          setup: FactorySetup,
          signer: Signer | string
        ): Promise<Contract> => {
          signer = await getSigner(signer);
          const registry = await env.erasure.getContractInstance(
            setup.registry
          );
          const template = await env.erasure.getContractInstance(
            setup.template
          );

          const [factory] = await env.erasure.deploy(
            setup.artifact,
            [registry.address, template.address],
            signer
          );

          await registry.addFactory(factory.address, "0x");
          return factory;
        },

        getContractInstance: async (
          name: string,
          address?: string,
          account?: string | Signer
        ): Promise<Contract> => {
          const signer = await getSigner(account);

          const setup = env.erasure.getErasureSetup()[name];
          if (address === undefined) {
            if (setup.address === undefined) {
              address = (
                await env.erasure.getLastDeployedContract(setup.artifact)
              ).address;
            } else {
              address = setup.address;
            }
          }
          if (address === undefined) {
            throw new Error("unable to resolve" + name + "address");
          }

          const { abi, bytecode } = readArtifactSync(
            env.config.paths.artifacts,
            setup.artifact
          );

          const factory = new ContractFactory(abi, bytecode, signer);
          // console.log("Connect", name, "to", address);
          return factory.attach(address);
        },

        // params: any[],
        _createInstance: async (
          template: Contract,
          factory: Contract,
          values: any[]
        ): Promise<Contract> => {
          values = await processValues(values);
          const initializeFunc = template.interface.abi.find(
            e => e.type === "function" && e.name === "initialize"
          );
          const params = (initializeFunc as any).inputs.map((i: any) => i.type);

          const callData = abiEncodeWithSelector("initialize", params, values);
          const tx = await factory.create(callData);

          const receipt = await env.ethers.provider.getTransactionReceipt(
            tx.hash
          );
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
          throw new Error("unable to create an instance");
        },

        // Creates an instance from a Factory.
        createInstance: async (
          template: TemplateNames,
          values: any[]
        ): Promise<Contract> => {
          const getSetup = (name: string): ContractSetup => {
            const setup = env.erasure.getErasureSetup()[name];
            if (setup === undefined) {
              throw new Error("Setup not found for " + name);
            }
            return setup;
          };

          const getFactoryName = (
            name: TemplateNames,
            setup: TemplateSetup
          ) => {
            // TODO : the suffix can be configurable
            return setup.factory !== undefined
              ? setup.factory
              : name + "_Factory";
          };

          const templateSetup = getSetup(template) as TemplateSetup;
          const factorySetup = getSetup(
            getFactoryName(template, templateSetup)
          );

          const factoryInstance = await env.erasure.getContractInstance(
            factorySetup.artifact,
            factorySetup.address
          );
          const templateInstance = await env.erasure.getContractInstance(
            templateSetup.artifact,
            templateSetup.address
          );

          return env.erasure._createInstance(
            templateInstance,
            factoryInstance,
            values
          );
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
          // ratio = typeof (ratio) === 'number' ? new BigNumber(ratio) : ratio;
          const agreementTemplate: TemplateNames =
            countdown === undefined ? "SimpleGriefing" : "CountdownGriefing";

          // const params =
          //   countdown === undefined
          //     ? ["address", "address", "address", "uint256", "uint8", "bytes"]
          //     : ["address", "address", "address", "uint256", "uint8", "uint256", "bytes"];
          const values =
            countdown === undefined
              ? [operator, staker, counterparty, ratio, ratioType, metadata]
              : [
                  operator,
                  staker,
                  counterparty,
                  ratio,
                  ratioType,
                  countdown,
                  metadata
                ];

          const agreement = await env.erasure.createInstance(
            agreementTemplate,
            values
          );
          return agreement;
        }
      };
    });
  });
}
