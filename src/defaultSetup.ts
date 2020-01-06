import { Contract } from "ethers";
import { TransactionReceipt } from "ethers/providers";

import { DeploySetup } from "./deployments";
import { ErasureSetup } from "./erasureSetup";

export const defaultNMR = "MockNMR";
export const defaultFactories: string[] = [
  "SimpleGriefing",
  "CountdownGriefing",
  "Post",
  "Feed"
];
export const defaultRegistries: string[] = [
  "Erasure_Agreements",
  "Erasure_Posts"
];

const nmrSigner = "0x9608010323ed882a38ede9211d7691102b4f0ba0";

// contract: Contract,
// receipt: TransactionReceipt,
const getFactoryParams = (context: any): any[] => {
  const registry = context[context.registry].address;
  const template = context[context.template].address;
  return [registry, template];
};

const afterFactoryDeploy = async (contract: Contract, recipt: TransactionReceipt, context: any) => {
  const registry = context[context.registry].address;
  await registry.addFactory(contract.address, "0x");
  // modify context?
}

export const defaultSetup: DeploySetup = {
  init: () => {},
  contracts: [
    {
      name: "MockNMR",
      artifact: "MockNMR",
      signer: nmrSigner
    },
    {
      name: "Erasure_Agreements"
    },
    {
      name: "Erasure_Posts"
    },
    {
      name: "Erasure_Users"
    },
    {
      name: "Erasure_Escrows"
    },
    {
      name: "Feed"
    },
    {
      name: "SimpleGriefing"
    },
    {
      name: "CountdownGriefing"
    },
    {
      name: "CountdownGriefingEscrow"
    },
    {
      name: "Feed_Factory",
      context: {
        template: "Feed",
        registry: "Erasure_Posts"
      },
      params: getFactoryParams
    },
    {
      name: "SimpleGriefing_Factory",
      context: {
        template: "SimpleGriefing",
        registry: "Erasure_Agreements"
      },
      params: getFactoryParams
    },
    {
      name: "CountdownGriefing_Factory",
      context: {
        template: "CountdownGriefing",
        registry: "Erasure_Agreements"
      },
      params: getFactoryParams
    },
    {
      name: "CountdownGriefingEscrow_Factory",
      context: {
        template: "CountdownGriefingEscrow",
        registry: "Erasure_Escrows"
      },
      params: getFactoryParams
    }
  ]
};
