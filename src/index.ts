import {
  internalTask,
  task,
  usePlugin
} from "@nomiclabs/buidler/config";
import { ensurePluginLoadedWithUsePlugin } from "@nomiclabs/buidler/plugins";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";

import "./deploys";
import { abiEncodeWithSelector, createMultihashSha256, hexlify } from "./utils";

// @ts-ignore

usePlugin("@nomiclabs/buidler-ethers");
ensurePluginLoadedWithUsePlugin();

export default function() {
  const defaultDeploySetup = {
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

  const setup = {};

  // TODO : why is this necessary? easier to mock?
  // const c = {
  //   NMR: {
  //     artifact: require("./artifacts/MockNMR.json")
  //   },
  //   Erasure_Agreements: {
  //     artifact: require("./artifacts/Erasure_Agreements.json")
  //   },
  //   Erasure_Posts: {
  //     artifact: require("./artifacts/Erasure_Posts.json")
  //   },
  //   SimpleGriefing: {
  //     factoryArtifact: require("./artifacts/SimpleGriefing_Factory.json"),
  //     templateArtifact: require("./artifacts/SimpleGriefing.json")
  //   },
  //   CountdownGriefing: {
  //     factoryArtifact: require("./artifacts/CountdownGriefing_Factory.json"),
  //     templateArtifact: require("./artifacts/CountdownGriefing.json")
  //   },
  //   Feed: {
  //     factoryArtifact: require("./artifacts/Feed_Factory.json"),
  //     templateArtifact: require("./artifacts/Feed.json")
  //   },
  //   Post: {
  //     factoryArtifact: require("./artifacts/Post_Factory.json"),
  //     templateArtifact: require("./artifacts/Post.json")
  //   }
  // };

  const nmrDeployAddress = "0x9608010323ed882a38ede9211d7691102b4f0ba0";

  task("send-balance", async ({ from, to }, { ethers }: any) => {
    // const defaultSigner = (await env.ethers.signers())[9];
    // console.log(from, to)
    // const defaultSigner = (await env.ethers.signers())[0];
    const balance = await from.getBalance(from.address);
    const gasPrice = await ethers.provider.getGasPrice();
    // TODO : why doesn't work with 21000?
    const gasLimit = 21001;
    // console.log(balance.toString(), balance, gasPrice.toNumber(), balance.sub(gasPrice.mul(gasLimit)));
    const value = balance.sub(gasPrice.mul(gasLimit));

    await from.sendTransaction({
      to,
      value
    });
  });

  task("erasure:compile", async (args, env) => {
    await env.run("compile");
  });

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
      { run, deployments }: BuidlerRuntimeEnvironment & any
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

  task(
    "erasure:create-instance",
    "Creates a new instance from a factory"
  ).setAction(async (args: any, { ethers }: any) => {
    const { factory, params, values, provider } = args;
    const tx = await factory.create(
      abiEncodeWithSelector("initialize", params, values)
    );
    // todo: missing name
    return ethers.provider.getTransactionReceipt(tx.hash);
  });

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

      // console.log("deploying template");
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

        const fs = Object.entries(factories).reduce(
          async (acc: any, [name, { config }]: any) => ({
            ...acc,
            [name]: await run("erasure:deploy-factory", {
              ...config,
              signer: deployer
            })
          }),
          {}
        );
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

        const rs = await Promise.all(
          Object.keys(registries).map(name =>
            run("erasure:deploy-contract", {
              name,
              params: [],
              signer: deployer
            })
          )
        );

        return rs;
      }
    );

  // TODO : is sending balance to the nmrSigner really necessary?
  task("erasure:deploy-numerai", "Deploys the Numerai main contract").setAction(
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

  // const getWrapFromTx = (receipt, entity, signer) => {
  //   // TODO : does the instance contains the ABI?
  //   const interface = new ethers.utils.Interface(entity.factoryArtifact.abi);
  //   for (log of receipt.logs) {
  //     const event = interface.parseLog(log);
  //     if (event !== null && event.name === "InstanceCreated") {
  //       return new ethers.Contract(
  //         event.values.instance,
  //         entity.templateArtifact.abi,
  //         signer
  //       );
  //     }
  //   }
  // };

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
          setupFile === undefined ? defaultDeploySetup : setupFile;

        await run("erasure:deploy-numerai", {
          deployer: nmrSigner,
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

        // TODO: move this somewhere else
        console.log("Create Test Instances");

        // const userAddress = deployer._address;
        // const multihash = createMultihashSha256("multihash");
        // const hash = ethers.utils.keccak256(hexlify("multihash"));

        // console.log("userAddress:", userAddress);
        // console.log("multihash:", multihash);
        // console.log("hash:", hash);

        // await run("create-instance", {
        //   factory: c.Post.factory,
        //   params: ["address", "bytes", "bytes"],
        //   values: [userAddress, multihash, multihash]
        // });

        // const receipt = await run("create-instance", {
        //   factory: c.Feed.factory,
        //   params: ["address", "bytes", "bytes"],
        //   values: [userAddress, multihash, multihash]
        // });

        // c.Feed.wrap = await getWrapFromTx(receipt, c.Feed, deployer);

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
      }
    );
}
