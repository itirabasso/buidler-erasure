// tslint:disable-next-line no-implicit-dependencies
import { assert } from "chai";
import { Contract } from "ethers";

import { useEnvironment } from "./helpers";

describe("Integration tests examples", function() {
  describe("Buidler Runtime Environment extension", function() {
    useEnvironment(__dirname + "/buidler-project");

    it.skip("erasure contracts should have been deployed", async function() {
      // console.log(this.env);
      // console.log((this.env as any)._extenders[0]);
      console.log(Object.keys(this.env));
      // console.log(Object.keys(this.env.deployments));
      const setup = this.env.erasure.deploySetup;
      // setup.nmrToken
      const nmr = (
        await this.env.erasure.getDeployedContracts(setup.nmrToken)
      )[0];
      assert.instanceOf(nmr, Contract);
    });

    it.skip("erasure contracts should have been deployed", async function() {
      const [nmr, registries, factories] = await this.env.run(
        "erasure:deploy-full"
      );
      // console.log(nmr, registries);
      // setup.nmrToken
      // const nmr = (await this.env.deployments.getDeployedContracts(
      //   setup.nmrToken
      // ))[0];
      // assert.instanceOf(nmr, Contract);
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
