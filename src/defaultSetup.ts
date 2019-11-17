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
    artifact: "MockNMR"
  },
  Erasure_Agreements: {
    type: "registry",
    artifact: "Erasure_Agreements"
  },
  Erasure_Posts: {
    type: "registry",
    artifact: "Erasure_Posts"
  },
  SimpleGriefing: {
    type: "template",
    artifact: "SimpleGriefing"
  },
  CountdownGriefing: {
    type: "template",
    artifact: "CountdownGriefing"
  },
  Feed: {
    type: "template",
    artifact: "Feed"
  },
  Post: {
    type: "template",
    artifact: "Post"
  },
  SimpleGriefing_Factory: {
    type: "factory",
    artifact: "SimpleGriefing_Factory",
    template: "SimpleGriefing", // "SimpleGriefing",
    registry: "Erasure_Agreements"
  },
  CountdownGriefing_Factory: {
    type: "factory",
    artifact: "CountdownGriefing_Factory",
    template: "CountdownGriefing",
    registry: "Erasure_Agreements"
  },
  Feed_Factory: {
    type: "factory",
    artifact: "Feed_Factory",
    template: "Feed",
    registry: "Erasure_Posts"
  },
  Post_Factory: {
    type: "factory",
    artifact: "Post_Factory",
    template: "Post",
    registry: "Erasure_Posts"
  }
};


// export const defaultSetup = {
//   nmrToken: { artifact: "MockNMR" },
//   registries: {
//     Erasure_Agreements: {
//       artifact: "Erasure_Agreements"
//     },
//     Erasure_Posts: {
//       artifact: "Erasure_Posts"
//     },
//   },
//   templates: {
//     SimpleGriefing: {
//       artifact: "SimpleGriefing"
//     },
//     CountdownGriefing: {
//       artifact: "CountdownGriefing"
//     },
//     Feed: {
//       artifact: "Feed"
//     },
//     Post: {
//       artifact: "Post"
//     }
//   },
//   factories: {
//     SimpleGriefing: {
//       artifact: "SimpleGriefing_Factory",
//       config: {
//         template: "SimpleGriefing", // "SimpleGriefing",
//         registry: "Erasure_Agreements"
//       }
//     },
//     CountdownGriefing: {
//       artifact: "CountdownGriefing_Factory",
//       config: {
//         template: "CountdownGriefing",
//         registry: "Erasure_Agreements"
//       }
//     },
//     Feed: {
//       artifact: "Feed_Factory",
//       config: {
//         template: "Feed",
//         registry: "Erasure_Posts"
//       }
//     },
//     Post: {
//       artifact: "Post_Factory",
//       config: {
//         template: "Post",
//         registry: "Erasure_Posts"
//       }
//     }
//   }
// };
