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
  Signer,
  utils,
  getDefaultProvider
} from "ethers";
import { existsSync } from "fs";
import {
  ensureFileSync,
  readJsonSync,
  writeJSONSync,
  ensureDir,
  copy
} from "fs-extra";

import { defaultSetup } from "./defaultSetup";
import { ErasureDeploySetup, Factory, FactorySetup } from "./erasureSetup";
import { abiEncodeWithSelector } from "./utils";
import { BigNumber } from "ethers/utils";
import { join } from "path";
import { TransactionReceipt } from "ethers/providers";

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
      await contract.deployed();

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

    // Defines the property from(signer) on a contract instance and retrieves it
    const etherlimeWrapper = (contract: Contract): Contract => {
      Object.defineProperty(contract, "from", {
        value: (signer: any) => {
          // todo : why am i making this async?
          // const address =
          //   typeof signer === "string" ? signer : await signer.getAddress();
          // console.log("attaching to new signer", address);
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
      Object.defineProperty(contract, "contractAddress", {
        get: () => contract.address
      });
      return contract;
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
        getLastDeployedContract: async (name: string): Promise<Contract> => {
          return (await env.erasure.getDeployedContracts(name, 1))[0];
        },
        getDeployedContracts: async (
          name: string,
          amount: number = 1
        ): Promise<Contract[]> => {
          const factory = await env.ethers.getContract(name);
          const addresses = await env.erasure.getDeployedAddresses(
            name,
            amount
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
            etherlimeWrapper(factory.attach(addr))
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
        deploy: async (
          contractName: string,
          params: any[],
          signer: Signer | string
        ): Promise<[Contract, TransactionReceipt]> => {
          // FIXME : override getContract function to receive a signer.
          const contractFactory = await env.ethers.getContract(contractName);
          const contract = await contractFactory.deploy(...params);
          await contract.deployed();

          await env.erasure.saveDeployedContract(name, contract);
          const receipt = await env.ethers.provider.getTransactionReceipt(
            contract.deployTransaction.hash!
          );
          return [contract, receipt];
        },
        deployFactory: async (
          factorySetup: FactorySetup,
          signer: Signer | string
        ): Promise<[Contract, Contract]> => {
          // const { factory, template, registry } = setup.config;
          const registry = await env.erasure.getLastDeployedContract(
            factorySetup.config.registry
          );

          // console.log("deploying template", registryInstance.address);
          const [template] = await env.erasure.deploy(
            factorySetup.config.template,
            [],
            await getSigner(signer)
          );
          const [factory] = await env.erasure.deploy(
            factorySetup.config.factory,
            [registry.address, template.address],
            signer
          );
          await registry.addFactory(factory.address, "0x");
          return [template, factory];
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
          factory: Contract | string,
          template: Contract | string, // template/factory could be automatically resolved.
          params: any[],
          values: any[]
        ): Promise<Contract> => {
          // const process = (v: any) => (v instanceof Signer ? v._address : v);
          const processValues = async (dirtyValues: any[]) => {
            const ret = [];
            for (const v of dirtyValues) {
              ret.push(Signer.isSigner(v) ? await v.getAddress() : v);
            }
            console.log("clean values", ret);

            return ret;
          };
          // console.log("dirtyvalues", values);
          const factoryContract =
            typeof factory === "string"
              ? (await env.erasure.getDeployedContracts(factory))[0]
              : factory;
          const templateContract =
            typeof template === "string"
              ? (await env.erasure.getDeployedContracts(template))[0]
              : template;
          const tx = await factoryContract.create(
            abiEncodeWithSelector(
              "initialize",
              params,
              await processValues(values)
            )
          );
          const receipt = await env.ethers.provider.getTransactionReceipt(
            tx.hash
          );
          for (const log of receipt.logs!) {
            const event = factoryContract.interface.parseLog(log);
            if (event !== null && event.name === "InstanceCreated") {
              const c = new Contract(
                event.values.instance,
                templateContract.interface.abi,
                factoryContract.signer
              );
              // console.log("instance address", event.values.instance);
              return etherlimeWrapper(c);
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

          const params =
            countdown === undefined
              ? ["address", "address", "address", "uint256", "uint8", "bytes"]
              : [
                  "address",
                  "address",
                  "address",
                  "uint256",
                  "uint8",
                  "uint256",
                  "bytes"
                ];
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
          // console.log(tx);
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
          // console.log(tx);
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
          // console.log(tx);
          return tx;
        }
      };
    });
  });
}
