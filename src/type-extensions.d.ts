import "@nomiclabs/buidler/types";
import "@nomiclabs/buidler-ethers/src/type-extensions";
import {
  ErasureSetup,
  FactorySetup,
  RegistrySetup,
  RegistryNames,
  FactoryNames
} from "./erasureSetup";
import { Contract, Signer } from "ethers";
import { BigNumber } from "ethers/utils";
import { TransactionReceipt } from "ethers/providers";
import { Factory } from "./index";

declare module "@nomiclabs/buidler/types" {

  export interface BuidlerConfig {
    erasure: {
      setup: ErasureSetup;
    },
  }
  export interface BuidlerRuntimeEnvironment {
    erasure: {
      getDeployedAddresses(name: string, amount?: number): Promise<string[]>;
      getLastDeployedContract(contractName: string): Promise<Contract>;
      getDeployedContracts(
        contractName: string,
        amount?: number
      ): Promise<Contract[]>;
      saveDeployedContract(name: string, instance: any): void;
      deploy(
        contractName: string,
        params: any[],
        signer?: Signer | string
      ): Promise<[Contract, TransactionReceipt]>;
      deployRegistry(registryName: string, signer?: Signer | string): Promise<Contract>;
      deployFactory(
        factoryName: string,
        factorySetup: FactorySetup,
        signer?: Signer | string
      ): Promise<Contract>;
      getFactory(
        factory: FactorySetup | string
      ): Promise<Contract>;
      // ): Promise<Factory>;
      getContractInstance(
        name: string,
        address?: string,
        account?: string | Signer
      ): Promise<Contract>;
      createInstance(
        factory: FactoryNames,
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
