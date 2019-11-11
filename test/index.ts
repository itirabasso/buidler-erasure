// tslint:disable-next-line no-implicit-dependencies
import { assert } from "chai";
import { Contract } from "ethers";

import { useEnvironment } from "./helpers";

describe("Integration tests examples", function() {
  describe("Buidler Runtime Environment extension", function() {
    useEnvironment(__dirname + "/buidler-project");

    it.skip("erasure contracts should have been deployed", async function() {
      // contracts are already deployed because we overwrite the task test.
      const setup = this.env.erasure.deploySetup;
      const nmr = (
        await this.env.erasure.getDeployedContracts(setup.nmrToken)
      )[0];
      assert.instanceOf(nmr, Contract);
    });

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
