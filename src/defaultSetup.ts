export const defaultSetup = {
  nmrToken: "MockNMR",
  registries: {
    Erasure_Agreements: {},
    Erasure_Posts: {}
  },
  factories: {
    SimpleGriefing: {
      config: {
        factory: "SimpleGriefing_Factory",
        template: "SimpleGriefing",
        registry: "Erasure_Agreements"
      }
    },
    CountdownGriefing: {
      config: {
        factory: "CountdownGriefing_Factory",
        template: "CountdownGriefing",
        registry: "Erasure_Agreements"
      }
    },
    Feed: {
      config: {
        factory: "Feed_Factory",
        template: "Feed",
        registry: "Erasure_Posts"
      }
    },
    Post: {
      config: {
        factory: "Post_Factory",
        template: "Post",
        registry: "Erasure_Posts"
      }
    }
  }
};
