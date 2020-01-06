import { readArtifactSync } from "@nomiclabs/buidler/plugins";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { Contract, Signer } from "ethers";
import { BigNumber } from "ethers/utils";

import {
  ContractSetup,
  ErasureSetup,
  FactorySetup,
  isFactorySetup,
  TemplateNames,
  TemplateSetup
} from "./erasureSetup";
import { abiEncodeWithSelector } from "./utils";
import { ContractConfig } from "./deployments";

export class Factory {
  constructor(
    public readonly factory: Contract,
    public readonly template: Contract
  ) { }
}

export class Template { }

export class Erasure {
  constructor(public readonly env: BuidlerRuntimeEnvironment) { }

  public getErasureSetup(): ErasureSetup {
    // return (env.config.networks[env.network.name] as any).erasureSetup;
    return (this.env.network.config as any).erasureSetup;
  }

  public async deployContract(
    setup: ContractConfig,
    deployer?: Signer | string
  ): Promise<Contract> {
    let contract: Contract;
    // if (setup.address === undefined) {
    // if (isFactorySetup(setup)) {
    //   contract = await this.deployFactory(setup, deployer);
    // } else {
    //   const ret = await this.env.deployments.deploy(
    //     setup.artifact,
    //     [],
    //     deployer
    //   );
    //   contract = ret[0];
    // }
    contract = await this.env.deployments.deployContract(setup);
    // } else {
    //   contract = await this.getContractInstance(
    //     setup.artifact,
    //     setup.address,
    //     deployer
    //   );
    // }
    return contract;
  }
  public async deployFactory(
    setup: FactorySetup,
    signer?: Signer | string
  ): Promise<Contract> {
    const registry = await this.getContractInstance(setup.registry);
    const template = await this.getContractInstance(setup.template);

    const [factory] = await this.env.deployments.deploy(
      setup.artifact,
      [registry.address, template.address],
      signer
    );

    await registry.addFactory(factory.address, "0x");
    return factory;
  }

  // this go to deployments
  public async getContractInstance(
    name: string,
    address?: string,
    signer?: string | Signer
  ): Promise<Contract> {
    const setup = this.getErasureSetup().contracts[name];
    if (address === undefined) {
      if (setup.address === undefined) {
        address = (
          await this.env.deployments.getLastDeployedContract(setup.artifact)
        ).address;
      } else {
        address = setup.address;
      }
    }
    if (address === undefined) {
      throw new Error("unable to resolve" + name + "address");
    }

    const factory = await this.env.deployments.getContractFactory(name, signer);

    return factory.attach(address);
  }

  // Creates an instance from a Factory.
  public async createInstance(
    template: TemplateNames,
    values: any[]
  ): Promise<Contract> {
    const getSetup = (name: string): ContractSetup => {
      const setup = this.getErasureSetup().contracts[name];
      if (setup === undefined) {
        throw new Error("Setup not found for " + name);
      }
      return setup;
    };

    const getFactoryName = (name: TemplateNames, setup: TemplateSetup) => {
      // TODO : the suffix can be configurable
      return setup.factory !== undefined ? setup.factory : name + "_Factory";
    };

    const templateSetup = getSetup(template) as TemplateSetup;
    const factorySetup = getSetup(getFactoryName(template, templateSetup));

    const factoryInstance = await this.getContractInstance(
      factorySetup.artifact,
      factorySetup.address
    );
    const templateInstance = await this.getContractInstance(
      templateSetup.artifact,
      templateSetup.address
    );

    return this._createInstance(templateInstance, factoryInstance, values);
  }

  // params: any[],
  private async _createInstance(
    template: Contract,
    factory: Contract,
    values: any[]
  ): Promise<Contract> {
    values = await this.processValues(values);
    const initializeFunc = template.interface.abi.find(
      e => e.type === "function" && e.name === "initialize"
    );
    const params = (initializeFunc as any).inputs.map((i: any) => i.type);

    const callData = abiEncodeWithSelector("initialize", params, values);
    const tx = await factory.create(callData);

    await tx.wait();

    const receipt = await this.env.ethers.provider.getTransactionReceipt(
      tx.hash
    );

    for (const log of receipt.logs!) {
      const event = factory.interface.parseLog(log);
      if (event !== null && event.name === "InstanceCreated") {
        return new Contract(
          event.values.instance,
          template.interface.abi,
          factory.signer
        );
      }
    }
    throw new Error("unable to create an instance");
  }

  /**
   * converts every element in the following way:
   *   any signer into an address
   *   any number into a big number
   */
  private async processValues(dirtyValues: any[]) {
    let v = await Promise.all(
      dirtyValues.map(val => (Signer.isSigner(val) ? val.getAddress() : val))
    );
    v = v.map(val => (typeof val === "number" ? new BigNumber(val) : val));
    return v;
  }
}
