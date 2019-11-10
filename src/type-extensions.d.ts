import "@nomiclabs/buidler/types";
import "@nomiclabs/buidler-ethers/src/type-extensions";
import { ErasureDeploySetup } from "./erasureSetup";
import { Contract, Signer } from "ethers";

declare module "@nomiclabs/buidler/types" {
  export interface BuidlerRuntimeEnvironment {
    deployments: {
      getDeployedAddresses(name: string): Promise<string[]>;
      getDeployedContracts(contractName: string): Promise<Contract[]>;
      saveDeployedContract(name: string, instance: any): void;
      deploySetup: ErasureDeploySetup;
    };
    erasure: {
      getContractInstance(
        name: string,
        address: string,
        account: string | Signer
      ): Contract;
    };
  }
}
