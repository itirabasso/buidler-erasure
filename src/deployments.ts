import { readArtifact, readArtifactSync } from "@nomiclabs/buidler/plugins";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { Contract, ContractFactory, Signer, utils } from "ethers";
import { TransactionReceipt } from "ethers/providers";

import { FakeSigner } from "./fakeSigner";
import { readState, writeState } from "./utils";

export interface ContractConfig {
  name: string;
  // params: string[];
  signer?: string | Signer;
  context?: any;
  params?: any; // (context: any): any[] | any[]
  address?: string;
  artifact?: string;
  type?: any;
}

export interface DeploySetup {
  init?: () => any;
  contracts: ContractConfig[];
  nmrDeployTx?: string;
}

export class Deployments {
  private context: Record<string, any> = {};
  private setup: DeploySetup;
  constructor(
    public readonly env: BuidlerRuntimeEnvironment,
    public readonly chainIdGetter: () => Promise<number>
  ) {
    this.setup = (this.env.network.config as any).erasureSetup;
  }

  public async getDeployedAddresses(
    name: string,
    chainId?: number
  ): Promise<string[]> {
    const state = readState();
    chainId = await this.getChainId(chainId);

    if (!this.isDeployed(state, chainId, name)) {
      // chainId wasn't used before or contract wasn't deployed
      return [];
    }

    return state[chainId][name];
  }

  public async getLastDeployedContract(
    name: string,
    chainId?: number
  ): Promise<Contract> {
    return (await this.getDeployedContracts(name, chainId))[0];
  }
  public async getDeployedContracts(
    name: string,
    chainId?: number
  ): Promise<Contract[]> {
    const factory = await this.getContractFactory(name);
    const addresses = await this.getDeployedAddresses(name, chainId);
    const artifact = readArtifactSync(this.env.config.paths.artifacts, name);

    // TODO : should use deployedBytecode instead?
    if (artifact.bytecode !== factory.bytecode) {
      console.warn(
        "Deployed contract",
        name,
        " does not match compiled local contract"
      );
    }

    return addresses.map((addr: string) => factory.attach(addr));
  }

  public async saveDeployedContract(
    name: string,
    instance: any
  ): Promise<void> {
    const state = readState();
    if (name === undefined) {
      throw new Error("saving contract with no name");
    }

    const chainId = await this.getChainId();

    // is it already deployed?
    if (this.isDeployed(state, chainId, name)) {
      const [last, ...previous] = state[chainId][name];

      if (last !== instance.address) {
        // place the new instance address first to the list
        state[chainId][name] = [instance.address, last, ...previous];
      }
    } else {
      const addresses = [instance.address];
      // check if the chain is defined.
      if (state[chainId] === undefined) {
        // place the first contract with this chainId
        state[chainId] = {
          [name]: addresses
        };
      } else {
        // just add the new contract to the state.
        state[chainId][name] = addresses;
      }
    }

    // update state
    writeState(state);
  }

  public async deploySetup() {
    const contracts = {};
    for (const config of this.setup.contracts) {
      let { signer } = config

      if (typeof signer === "string") {
        const signers = await this.env.ethers.signers();
        const accounts = await this.env.ethereum.send('eth_accounts')

        const giver = await this.env.ethers.provider.getSigner(accounts[9]);

        await giver.sendTransaction({
          to: signer,
          value: utils.parseEther("1")
        });
        signer = new FakeSigner(signer, this.env.ethers.provider);
        // increment nmr signer nonce by 1
        await signer.sendTransaction({
          to: await signer.getAddress(),
          value: 0
        });
      }

      contracts[config.name] = await this.deployContract({ ...config, signer });
    }

    return contracts;
  }

  public async deployContract(config: ContractConfig): Promise<Contract> {
    const { name, params, signer, context, artifact } = config;
    // build local context
    const ctx = { ...this.context, ...context };
    const values = typeof params === "function" ? params(ctx) : params;
    const [contract, receipt] = await this.deploy(
      artifact === undefined ? name : artifact,
      values === undefined ? [] : values,
      signer
    );

    // TODO : store events in context
    this.context[name] = {
      // address: receipt.contractAddress,
      address: contract.address,
      contract,
      receipt
    };

    return contract;
  }

  public async deploy(
    contractName: string,
    params: any[],
    signer?: Signer | string
  ): Promise<[Contract, TransactionReceipt]> {
    const factory = await this.getContractFactory(contractName, signer);
    factory.connect(await this.getSigner(signer));

    const contract = await factory.deploy(...params);
    await contract.deployed();

    console.log("Deployed", contractName, "at", contract.address);
    await this.saveDeployedContract(contractName, contract);
    const receipt = await this.env.ethers.provider.getTransactionReceipt(
      contract.deployTransaction.hash!
    );
    return [contract, receipt];
  }

  public async getContractFactory(name: string, signer?: Signer | string) {
    signer = await this.getSigner(signer);
    const { abi, bytecode } = await readArtifact(
      this.env.config.paths.artifacts,
      name
    );
    return new ContractFactory(abi, bytecode, signer);
  }

  private async getChainId(chainId?: number): Promise<number> {
    if (chainId === undefined) {
      chainId =
        this.env.network.config.chainId === undefined
          ? await this.chainIdGetter()
          : this.env.network.config.chainId;
    }
    return chainId;
  }

  private async getSigner(account?: Signer | string) {
    return account === undefined
      ? (await this.env.ethers.signers())[0]
      : typeof account === "string"
        ? this.env.ethers.provider.getSigner(account)
        : account;
  }

  private isDeployed(state, chainId, name) {
    return (
      state[chainId] !== undefined &&
      state[chainId][name] !== undefined &&
      state[chainId][name].length > 0
    );
  }
}
