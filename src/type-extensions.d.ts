import "@nomiclabs/buidler/types";
import "@nomiclabs/buidler-ethers/src/type-extensions";
import {
  ErasureSetup,
  FactorySetup,
  RegistrySetup,
  RegistryNames,
  TemplateNames,
  ContractSetup,
} from "./erasureSetup";
import { Contract, Signer } from "ethers";
import { BigNumber } from "ethers/utils";
import { TransactionReceipt } from "ethers/providers";
import { Factory } from "./index";

declare module "@nomiclabs/buidler/types" {

  export interface BuidlerConfig {
    erasure: {
      setup: { [networkName: string]: ErasureSetup };
    },
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
      deployContract(setup: ContractSetup, deployer?: Signer | string): Promise<Contract>;
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
        params: any[],
        values: any[]
      ): Promise<Contract>;
      createInstance(
        factory: TemplateNames,
        params: any[],
        values: any[]
      ): Promise<Contract>;
      createAgreement(
        operator: Signer | string,
        staker: Signer | string,
        counterparty: Signer | string,
        ratio: number | BigNumber,
        ratioType: 1 | 2 | 3, // TODO : define a type for this
        countdown?: number,
        metadata?: string
      ): Promise<Contract>;
    };
  }
}
