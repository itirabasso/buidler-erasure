export type RegistryNames =
  | "Erasure_Agreements"
  | "Erasure_Posts"
  | "Erasure_Users"
  | "Erasure_Escrows";

export type TemplateNames =
  | "SimpleGriefing"
  | "CountdownGriefing"
  | "CountdownGriefingEscrow"
  | "Feed";
export type ContractType = "token" | "registry" | "factory" | "template";

export interface ContractSetup {
  name: string;
  type: ContractType;
  artifact: string;
  address?: string;
  signer?: string;
}

export interface TemplateSetup extends ContractSetup {
  type: "template";
  factory: string;
}

export interface FactorySetup extends ContractSetup {
  type: "factory";
  template: string;
  registry: string;
}

export function isFactorySetup(setup: any): setup is FactorySetup {
  return setup.type === "factory";
}

// updateContractAddress: (name: string, address: string) => ContractSetup;
export interface ErasureSetup {
  contracts: { [name: string]: ContractSetup | FactorySetup };
  nmrDeployTx?: string;
}

// export interface DeploySetup {
//   contracts: ContractSetup[]
//   nmrDeployTx?: string;
// }
