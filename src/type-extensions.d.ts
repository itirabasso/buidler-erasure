import "@nomiclabs/buidler/types";
import { ExampleBuidlerRuntimeEnvironmentField } from "./ExampleBuidlerRuntimeEnvironmentField";
import { Contract } from "ethers";

// This file is used to extend Buidler's types. Most plugins contain a
// src/type-extensions.d.ts, so we recommend to keep this name.

declare module "@nomiclabs/buidler/types" {
  // This is an example of an extension to the Buidler Runtime Environment.
  // This new field will be available in tasks' actions, scripts, and tests.
  export interface BuidlerRuntimeEnvironment {
    deployments: {
      getDeployedContracts(contractName: string): Promise<Contract[]>;
      saveDeployedContract(name: string, instance: any): void;
    };
  }

  // This is an example of an extension to one of the Buidler config values.
  export interface ProjectPaths {
    newPath?: string;
  }
}
