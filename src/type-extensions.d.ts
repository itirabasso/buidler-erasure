import "@nomiclabs/buidler/types";
import "@nomiclabs/buidler-ethers/src/type-extensions";
import {
  ErasureSetup,
  FactorySetup,
  RegistryNames,
  TemplateNames,
  ContractSetup
} from "./erasureSetup";
import { Contract, Signer } from "ethers";
import { BigNumber } from "ethers/utils";
import { TransactionReceipt } from "ethers/providers";
import { Erasure } from "./erasure";
import { Deployments } from "./deployments";

declare module "@nomiclabs/buidler/types" {
  // export type NetworkConfig = BuidlerNetworkConfig | HttpNetworkConfig;

  export interface Networks {
    [networkName: string]: NetworkConfig & { erasureSetup?: ErasureSetup };
    // [networkName: string]: NetworkConfig & any;
  }

  export interface BuidlerRuntimeEnvironment {
    deployments: Deployments;
    erasure: Erasure;
  }
}
