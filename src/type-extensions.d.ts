import "@nomiclabs/buidler/types";
import "@nomiclabs/buidler-ethers/src/type-extensions";
import { ErasureDeploySetup } from "./erasureSetup";
import { Contract, Signer } from "ethers";
import { BigNumber } from "ethers/utils";

declare module "@nomiclabs/buidler/types" {
  export interface BuidlerRuntimeEnvironment {
    erasure: {
      deploySetup: ErasureDeploySetup;
      getDeployedAddresses(name: string): Promise<string[]>;
      getDeployedContracts(contractName: string): Promise<Contract[]>;
      saveDeployedContract(name: string, instance: any): void;
      getContractInstance(
        name: string,
        address: string,
        account: string | Signer
      ): Contract;
      createInstance(
        factory: any,
        template: any,
        params: any[],
        values: any[]
      ): Promise<Contract>;
      createAgreement(
        operator: Signer | string,
        staker: Signer | string,
        counterparty: Signer | string,
        ratio: number | BigNumber,
        ratioType: 1 | 2 | 3, // TODO : define a type for this
        metadata: string,
        countdown?: number
      ): Promise<Contract>;
      stake(
        agreementAddress: Contract | string,
        currentStake: number,
        amountToAdd: number,
        account?: Signer | string
      ): Promise<any>;
      punish(
        agreementAddress: string,
        currentStake: number,
        punishment: number,
        message: string,
        account?: Signer | string
      ): Promise<number>;
      reward(
        agreementAddress: string,
        currentStake: number,
        amountToAdd: number,
        account?: Signer | string
      ): Promise<void>;
    };
  }
}
