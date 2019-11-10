import "@nomiclabs/buidler/types";
import { ErasureDeploySetup } from "./erasureSetup";
import { Contract } from "ethers";

declare module "@nomiclabs/buidler/types" {

  export interface BuidlerRuntimeEnvironment {
    deployments: {
      getDeployedAddresses(name: string): Promise<string[]>;
      getDeployedContracts(contractName: string): Promise<Contract[]>;
      saveDeployedContract(name: string, instance: any): void;
      deploySetup: ErasureDeploySetup;
    };
  }
}
