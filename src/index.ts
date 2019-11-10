import { internalTask, task, usePlugin } from "@nomiclabs/buidler/config";
import { ensurePluginLoadedWithUsePlugin } from "@nomiclabs/buidler/plugins";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";

import "./deploys";
import { abiEncodeWithSelector, createMultihashSha256, hexlify } from "./utils";
import { utils, ContractFactory, Contract } from "ethers";

// @ts-ignore

usePlugin("@nomiclabs/buidler-ethers");
ensurePluginLoadedWithUsePlugin();

export default function() {
  function getDefaultSetup() {
    return {
      numerai: "MockNMR",
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
        const nmrSigner = signers[1];

        const setup: any =
          setupFile === undefined ? getDefaultSetup() : setupFile;

        await run("erasure:deploy-numerai", {
          deployer,
          nmr: setup.numerai
        });
        await run("erasure:deploy-registries", {
          deployer,
          registries: setup.registries
        });
        await run("erasure:deploy-factories", {
          deployer,
          factories: setup.factories
        });
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

      for (const log of receipt.logs) {
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
  task("erasure:bleep").setAction(
    async (
      args: any,
      { ethers, run }: BuidlerRuntimeEnvironment | any
    ) => {
      await run("erasure:deploy-full");
      const signers = await ethers.signers();
      const deployer = signers[0];
      const userAddress = deployer._address;
      const multihash = createMultihashSha256("multihash");
      const hash = utils.keccak256(hexlify("multihash"));

      // console.log("userAddress:", userAddress);
      // console.log("multihash:", multihash);
      // console.log("hash:", hash);

      const post = await run("erasure:create-instance", {
        factoryName: "Post_Factory",
        templateName: "Post",
        params: ["address", "bytes", "bytes"],
        values: [userAddress, multihash, multihash]
      });
      const feed = await run("erasure:create-instance", {
        factoryName: "Feed_Factory",
        templateName: "Feed",
        params: ["address", "bytes", "bytes"],
        values: [userAddress, multihash, multihash]
      });
      console.log('beeeeep', hash)
      const tx = feed.submitHash(hash);
      const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
      const event = receipt.logs[0]
      console.log(event);
      // const submitHash = async (entity: any, hash: any) => {
      //   const tx = await entity.wrap.submitHash(hash);
      //   const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
      //   const interface: any = new ethers.utils.Interface(
      //     entity.templateArtifact.abi
      //   );
      //   for (log of receipt.logs) {
      //     const event = interface.parseLog(log);
      //     if (event !== null && event.name === "HashSubmitted") {
      //       console.log("Hashes:", event.values.hash, hash);
      //       // assert.equal(event.values.hash, hash);
      //     }
      //     console.log(`submitHash() | ${receipt.gasUsed} gas | Feed`);
      //   }
      // };
      // await submitHash(c.Feed, hash);
      // await run("create-instance", {
      //   factory: c.SimpleGriefing.factory,
      //   params: ["address", "address", "address", "uint256", "uint8", "bytes"],
      //   values: [
      //     userAddress,
      //     userAddress,
      //     userAddress,
      //     ethers.utils.parseEther("1"),
      //     2,
      //     "0x0"
      //   ]
      // });
      // await run("create-instance", {
      //   factory: c.CountdownGriefing.factory,
      //   params: [
      //     "address",
      //     "address",
      //     "address",
      //     "uint256",
      //     "uint8",
      //     "uint256",
      //     "bytes"
      //   ],
      //   values: [
      //     userAddress,
      //     userAddress,
      //     userAddress,
      //     ethers.utils.parseEther("1"),
      //     2,
      //     100000000,
      //     "0x0"
      //   ]
      // });
      //       }
      //     );
      // }
    }
  );
}
// TODO: move this somewhere else
// console.log("Create Test Instances");
