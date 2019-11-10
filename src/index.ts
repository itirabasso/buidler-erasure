import {
  internalTask,
  task,
  usePlugin,
  types,
  extendEnvironment
} from "@nomiclabs/buidler/config";
import {
  ensurePluginLoadedWithUsePlugin,
  readArtifact,
  readArtifactSync
} from "@nomiclabs/buidler/plugins";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { Contract, utils, Signer, ContractFactory } from "ethers";

import "./deploys";
import { abiEncodeWithSelector, createMultihashSha256, hexlify } from "./utils";

// @ts-ignore
usePlugin("@nomiclabs/buidler-ethers");
ensurePluginLoadedWithUsePlugin();

export default function() {
  function getDefaultSetup() {
    return {
      nmrToken: "MockNMR",
      registries: {
        Erasure_Agreements: {},
        Erasure_Posts: {}
      },
      factories: {
        SimpleGriefing: {
          config: {
            factory: "SimpleGriefing_Factory",
            template: "SimpleGriefing",
            registry: "Erasure_Agreements"
          }
        },
        CountdownGriefing: {
          config: {
            factory: "CountdownGriefing_Factory",
            template: "CountdownGriefing",
            registry: "Erasure_Agreements"
          }
        },
        Feed: {
          config: {
            factory: "Feed_Factory",
            template: "Feed",
            registry: "Erasure_Posts"
          }
        },
        Post: {
          config: {
            factory: "Post_Factory",
            template: "Post",
            registry: "Erasure_Posts"
          }
        }
      }
    };
  }

  internalTask("erasure:deploy").setAction(
    async (
      { name, params }: { name: string; params: any[] },
      { ethers, run }: BuidlerRuntimeEnvironment | any
    ) => {
      // update artifacts
      // await env.run("compile");

      const contract = await run("deploy", { name, params });
      const receipt = await ethers.provider.getTransactionReceipt(
        contract.deployTransaction.hash
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
      { run, deployments }: BuidlerRuntimeEnvironment
    ) => {
      const registryInstance = (await deployments.getDeployedContracts(
        registry
      ))[0];

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

  // TODO : is sending balance to the nmrSigner really necessary?
  internalTask(
    "erasure:deploy-numerai",
    "Deploys the Numerai main contract"
  ).setAction(
    async (
      { deployer, nmr }: { deployer: any; nmr: string },
      { run, ethers }: any
    ) => {
      console.log("Deploying", nmr);

      // const from = (await ethers.signers())[2];
      // await run('send-balance', {from, to: deployer});
      // console.log("NMR Signer balance updated");

      // TODO : why is this needed?
      // needs to increment the nonce to 1 by
      // await deployer.sendTransaction({ to: deployer.address, value: 0 });

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
        { run, ethers }: any
      ) => {
        const signers = await ethers.signers();
        const deployer = signers[0];

        const setup: any =
          setupFile === undefined ? getDefaultSetup() : setupFile;

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

  // TODO : This can receive the name of the _entity_ instead of the factory and template names.
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
      { ethers, deployments }: any
    ) => {
      const factory = (await deployments.getDeployedContracts(factoryName))[0];
      const template = (await deployments.getDeployedContracts(
        templateName
      ))[0];

      const tx = await factory.create(
        abiEncodeWithSelector("initialize", params, values)
      );

      const receipt = await ethers.provider.getTransactionReceipt(tx.hash);

      let contract;
      for (const log of receipt.logs) {
        const event = factory.interface.parseLog(log);
        if (event !== null && event.name === "InstanceCreated") {
          contract = new Contract(
            event.values.instance,
            template.interface.abi,
            factory.signer
          );
        }
      }
      return contract;
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
    .setAction(async (args, { run, ethers }: any) => {
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
    .setAction(async (args, { config, run, ethers, deployments }: any) => {
      const { address, currentStake, amountToAdd, account } = args;

      const signer =
        account === undefined
          ? (await ethers.signers())[0]
          : ethers.provider.getSigner(account);

      // TODO : this can be part of buidler-ethers
      const agreement = ethers.getContractInstance(
        "SimpleGriefing",
        address,
        signer
      );

      const tx = await agreement.increaseStake(currentStake, amountToAdd);
      console.log(tx);
      return tx;
    });

  task("erasure:test-task").setAction(
    async (
      args: any,
      { ethers, run, deployments }: BuidlerRuntimeEnvironment | any
    ) => {
      const [deployer, operator, staker, counterparty] = await ethers.signers();

      const [nmr, registries, factories] = await run("erasure:deploy-full");
      const minted = await nmr.mintMockTokens(
        staker._address,
        utils.parseEther("1000")
      );

      const multihash = createMultihashSha256("multihash");
      const hash = utils.keccak256(hexlify("multihash"));

      const post = await run("erasure:create-instance", {
        factoryName: "Post_Factory",
        templateName: "Post",
        params: ["address", "bytes", "bytes"],
        values: [operator._address, multihash, multihash]
      });
      const feed = await run("erasure:create-instance", {
        factoryName: "Feed_Factory",
        templateName: "Feed",
        params: ["address", "bytes", "bytes"],
        values: [operator._address, multihash, multihash]
      });

      const tx = await feed.submitHash(hash);
      const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
      console.log(hash, feed.interface.parseLog(receipt.logs[0]).values.hash);

      const agreement = await run("erasure:create-agreement", {
        operator,
        staker,
        counterparty,
        ratio: "1",
        ratioType: 2,
        metadata: "0x0"
      });

      const tx = await run("erasure:stake", {
        address: agreement.address,
        currentStake: 0,
        amountToAdd: 1,
        account: staker._address
      });
      console.log(tx);
    }
  );

  // TODO : should this go to buidler-ethers?
  extendEnvironment((env: BuidlerRuntimeEnvironment & any) => {
    env.ethers.getContractInstance = (
      name: string,
      address: string,
      signer: Signer
    ): Contract => {
      const { abi, bytecode } = readArtifactSync(
        env.config.paths.artifacts,
        name
      );

      const factory = new ContractFactory(abi, bytecode, signer);
      return factory.attach(address);
    };
  });
}
