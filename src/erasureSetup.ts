type Registries = "Erasure_Agreements" | "Erasure_Posts";
type Factories = "SimpleGriefing" | "CountdownGriefing" | "Post" | "Feed";

/* tslint:disable */
export interface Registry {}
export interface Factory {
  // TODO : config could be deleted
  config: {
    factory: string;
    template: string;
    registry: string;
  };
}
export interface FactorySetup extends Factory {}

// TODO : a quick refactor here could improve usability
export interface ErasureDeploySetup {
  nmrToken: string;
  registries: Record<Registries, Registry>;
  factories: Record<Factories, Factory>;
}
