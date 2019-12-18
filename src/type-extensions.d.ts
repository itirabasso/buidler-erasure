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
import { Factory } from "./index";

declare module "@nomiclabs/buidler/types" {
  export interface Networks {
    [networkName: string]: NetworkConfig & { erasureSetup?: ErasureSetup };
  }

  export interface BuidlerConfig {
    erasure: {
      setup: { [networkName: string]: ErasureSetup };
    };
  }
  export interface BuidlerRuntimeEnvironment {
    erasure: {
      setup: ErasureSetup;
      getDeployedAddresses(name: string, amount?: number): Promise<string[]>;
      getLastDeployedContract(contractName: string): Promise<Contract>;
      getDeployedContracts(
        contractName: string,
        amount?: number
      ): Promise<Contract[]>;
      saveDeployedContract(name: string, instance: any): void;
      getErasureSetup(): ErasureSetup;
      deploy(
        contractName: string,
        params: any[],
        signer?: Signer | string
      ): Promise<[Contract, any]>;
      deployContract(
        setup: ContractSetup,
        deployer?: Signer | string
      ): Promise<Contract>;
      deployFactory(
        factorySetup: FactorySetup,
        signer?: Signer | string
      ): Promise<Contract>;
      getContractInstance(
        name: string,
        address?: string,
        account?: string | Signer
      ): Promise<Contract>;
      _createInstance(
        template: Contract,
        factory: Contract,
        values: any[]
      ): Promise<Contract>;
      createInstance(factory: TemplateNames, values: any[]): Promise<Contract>;
    };
  }
}
