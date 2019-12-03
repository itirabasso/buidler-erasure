import { ErasureSetup } from "./erasureSetup";

export const defaultNMR = "MockNMR";
export const defaultFactories: string[] = [
  "SimpleGriefing",
  "CountdownGriefing",
  "Post",
  "Feed"
];
export const defaultRegistries: string[] = [
  "Erasure_Agreements",
  "Erasure_Posts"
];

export const defaultSetup: ErasureSetup = {
  NMR: {
    type: "token",
    artifact: "MockNMR",
  },
  Erasure_Agreements: {
    type: "registry",
    artifact: "Erasure_Agreements",
  },
  Erasure_Posts: {
    type: "registry",
    artifact: "Erasure_Posts",
  },
  Erasure_Users: {
    type: "registry",
    artifact: "Erasure_Users",
  },
  Erasure_Escrows: {
    type: "registry",
    artifact: "Erasure_Escrows",
  },
  Feed: {
    type: "template",
    artifact: "Feed",
  },
  SimpleGriefing: {
    type: "template",
    artifact: "SimpleGriefing",
  },
  CountdownGriefing: {
    type: "template",
    artifact: "CountdownGriefing",
  },
  CountdownGriefingEscrow: {
    type: "template",
    artifact: "CountdownGriefingEscrow",
  },
  Feed_Factory: {
    type: "factory",
    artifact: "Feed_Factory",
    template: "Feed",
    registry: "Erasure_Posts"
  },
  SimpleGriefing_Factory: {
    type: "factory",
    artifact: "SimpleGriefing_Factory",
    template: "SimpleGriefing",
    registry: "Erasure_Agreements"
  },
  CountdownGriefing_Factory: {
    type: "factory",
    artifact: "CountdownGriefing_Factory",
    template: "CountdownGriefing",
    registry: "Erasure_Agreements"
  },
  CountdownGriefingEscrow_Factory: {
    type: "factory",
    artifact: "CountdownGriefingEscrow_Factory",
    template: "CountdownGriefingEscrow",
    registry: "Erasure_Escrows"
  }
};
