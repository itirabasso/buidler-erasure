type Registries = "Erasure_Agreements" | "Erasure_Posts";
type Factories = "SimpleGriefing" | "CountdownGriefing" | "Post" | "Feed";

/* tslint:disable */
interface Registry {}
interface Factory {
  config: {
    factory: string;
    template: string;
    registry: string;
  };
}

// TODO : a quick refactor here could improve usability
export interface ErasureDeploySetup {
  nmrToken: string;
  registries: Record<Registries, Registry>;
  factories: Record<Factories, Factory>;
  // registries: { [key: Registries]: Registry };
  // factories: { [key: Factories]: Factory };
}
