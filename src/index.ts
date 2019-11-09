import { TASK_COMPILE_GET_SOURCE_PATHS } from "@nomiclabs/buidler/builtin-tasks/task-names";
import { extendConfig, internalTask, task } from "@nomiclabs/buidler/config";
import { usePlugin } from "@nomiclabs/buidler/config";
import { glob } from "@nomiclabs/buidler/internal/util/glob";
import {
  ensurePluginLoadedWithUsePlugin,
  lazyObject,
  readArtifact
} from "@nomiclabs/buidler/plugins";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { readFileSync } from "fs";
import path from "path";

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
          factoryArtifact: "SimpleGriefing_Factory",
          templateArtifact: "SimpleGriefing",
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

  // internalTask(
  //   TASK_COMPILE_GET_SOURCE_PATHS,
  //   async (_, { config, run }, runSuper) => {
  //     const filePaths: string[] = await runSuper();
  //     // console.log(config.paths);
  //     const erasurePaths: string[] = await glob(path.join( "./contracts/**/*.sol"));
  //     console.log([...filePaths, ...erasurePaths], path.join(__dirname, "./contracts/**/*.sol"));
  //     return [...filePaths, ...erasurePaths];
  //   }
  // );

  task("numerai:compile", async (args, env) => {
    // env.config.paths.sources = "./src/contracts";
    await env.run("compile");
  });

  internalTask(
    "deploy:deploy",
    async (
      { name, params }: { name: string; params: any[] },
      { ethers }: any
    ) => {
      // update artifacts
      // await env.run("compile");

      console.log("deploy:deploy", name, params);
      const contractFactory = await ethers.getContract(name);
      const contract = await contractFactory.deploy(...params);
      // await env.deployments.saveDeployedContract(name, instance);

      const receipt = await ethers.provider.getTransactionReceipt(
        contract.deployTransaction.hash
      );
      console.log("Deploy", contract.address, name, receipt.gasUsed.toString());
      return [contract, receipt];
    }
  );

  task(
    "deploy-contract",
    async (
      { name, params, signer }: { name: string; params: any[]; signer: any },
      { run }: BuidlerRuntimeEnvironment
    ) => {
      // console.log("deploy:deploy-contract", name, params);
      const [contract, _] = await run("deploy:deploy", {
        name,
        params,
        signer
      });
      return contract;
    }
  );

  task(
    "create-instance",
    "Creates a new instance from a factory",
    async (args: any, { ethers }: any) => {
      const { factory, params, values, provider } = args;
      const tx = await factory.create(
        abiEncodeWithSelector("initialize", params, values)
      );
      // todo: missing name
      return ethers.provider.getTransactionReceipt(tx.hash);
    }
  );

  task(
    "deploy-factory",
    async (
      {
        factory,
        template,
        registry,
        signer
      }: { factory: string; template: string; registry: any; signer: any },
      { run }: BuidlerRuntimeEnvironment
    ) => {
      // const { templateArtifact, factoryArtifact } = artifacts;
      // console.log('Deploying Factory', factory, template, registry)

      console.log("deploying template");
      const [templateContract, _] = await run("deploy:deploy", {
        name: template,
        params: [],
        signer
      });
      console.log('Template deployed', templateContract.address);
      console.log("deploying factory", factory, registry);
      const [factoryContract, __] = await run("deploy:deploy", {
        name: factory,
        params: [registry.address, templateContract.address],
        signer
      });
      const tx = await registry.addFactory(factoryContract.address, "0x");
      // const receipt = await env.ethers.provider.getTransactionReceipt(tx.hash);
      // console.log("addFactory", /*contractName,*/ receipt.gasUsed.toString());

      return [templateContract, factoryContract];
    }
  );

  task(
    "deploy-factories",
    async (
      { deployer, factories }: { deployer: any; factories: any },
      { run }: BuidlerRuntimeEnvironment
    ) => {
      console.log("Deploy Factories", factories.config);

      const fs = Object.entries(factories).reduce(
        async (acc: any, [name, { config }]: any) => {
          console.log("Factory", name, config);
          return {
            ...acc,
            [name]: await run("deploy-factory", { ...config, signer: deployer })
          };
        },
        {}
      );

      console.log("fs", await fs);
      return fs;
      // return await Promise.all(fs);
    }
  )
    .addParam(
      "factories",
      "List of factories name to deploy (separated by comma)"
    )
    .addParam("deployer");

  task(
    "deploy-registries",
    async (
      { deployer, registries }: { deployer: any; registries: any },
      { run }: BuidlerRuntimeEnvironment
    ) => {
      console.log("Deploy Registries");

      const rs = await Promise.all(
        Object.entries(registries).map(([name, r]) =>
          run("deploy-contract", { name, params: [], signer: deployer })
        )
      );
    }
  )
    .addParam(
      "registries",
      "List of registries name to deploy (separated by comma)"
    )
    .addParam("deployer");

  // TODO : is the sending balance thing really necessary?
  task(
    "deploy-nmr",
    async (
      { deployer, nmr }: { deployer: any; nmr: string },
      { run, ethers }: any
    ) => {
      console.log("Deploy", nmr);

      // const from = (await ethers.signers())[2];
      // await run('send-balance', {from, to: deployer});
      // console.log("NMR Signer balance updated");

      // TODO : why is this needed?
      // needs to increment the nonce to 1 by
      // await deployer.sendTransaction({ to: deployer.address, value: 0 });

      return run("deploy-contract", {
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

  task(
    "deploy-full",
    "Deploy the full application",
    async (
      { setupFile }: { setupFile: string | undefined },
      { run, ethers }: any
    ) => {
      const signers = await ethers.signers();
      const deployer = signers[0];
      const nmrSigner = signers[1];

      const setup: any =
        setupFile === undefined ? defaultDeploySetup : setupFile;

      await run("deploy-nmr", { deployer: nmrSigner, nmr: setup.numerai });
      await run("deploy-registries", {
        deployer,
        registries: setup.registries
      });
      await run("deploy-factories", { deployer, factories: setup.factories });

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
  ).addOptionalParam("setupFile", "The file that defines the deploy setup");
}
