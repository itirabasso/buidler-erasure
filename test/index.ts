// tslint:disable-next-line no-implicit-dependencies
import { assert } from "chai";

import { useEnvironment } from "./helpers";

describe("Integration tests examples", function() {
  describe("Buidler Runtime Environment extension", async function() {
    useEnvironment(__dirname + "/buidler-project");

    it("should define the erasure tasks", function() {
      assert.hasAnyKeys(this.env.tasks, [
        "erasure:deploy",
        "erasure:deploy-contract",
        "erasure:deploy-factory",
        "erasure:deploy-factories",
        "erasure:deploy-registries",
        "erasure:deploy-numerai",
        "erasure:deploy-full",
        "erasure:create-instance",
        "erasure:create-agreement",
        "erasure:stake"
      ]);
    });
  });
});
