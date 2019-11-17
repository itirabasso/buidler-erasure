export type RegistryNames = "Erasure_Agreements" | "Erasure_Posts";
export type TemplateNames = "SimpleGriefing" | "CountdownGriefing" | "Post" | "Feed";
export type FactoryNames = "SimpleGriefing" | "CountdownGriefing" | "Post" | "Feed";
export type ContractType = "token" | "registry" | "factory" | "template";

export interface ContractSetup {
  type: ContractType;
  artifact: string;
  address?: string;
}

export interface RegistrySetup extends ContractSetup { }

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
  return setup.type === 'factory'
}

// updateContractAddress: (name: string, address: string) => ContractSetup;
export interface ErasureSetup { 
  [name: string]: ContractSetup | FactorySetup;

// export interface ErasureSetup {
//   [name: string]: ContractSetup
// }

// export interface ErasureSetup {
//   nmrToken: ContractSetup;
//   templates: Record<FactoryNames, ContractSetup>;
//   registries: Record<RegistryNames, ContractSetup>;
//   factories: Record<FactoryNames, FactorySetup>;
// }