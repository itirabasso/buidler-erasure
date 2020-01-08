import "@nomiclabs/buidler/types";
import "@nomiclabs/buidler-ethers/src/type-extensions";
import { Contract, Signer } from "ethers";
import { BigNumber } from "ethers/utils";
import { TransactionReceipt } from "ethers/providers";
import { Erasure } from "./erasure";
import { Deployments, DeploySetup } from "./deployments";

declare module "@nomiclabs/buidler/types" {
  // export type NetworkConfig = BuidlerNetworkConfig | HttpNetworkConfig;

  export interface Networks {
    [networkName: string]: NetworkConfig & { erasureSetup?: DeploySetup };
    // [networkName: string]: NetworkConfig & any;
  }

  export interface BuidlerRuntimeEnvironment {
    deployments: Deployments;
    erasure: Erasure;
  }
}
