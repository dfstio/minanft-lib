export { MinaNFTTreeVerifier };

import { method, DeployArgs, Permissions, SmartContract } from "o1js";
import { RedactedMinaNFTTreeStateProof } from "./redactedtree";

function MinaNFTTreeVerifier(height: number) {
  class RedactedTreeProof extends RedactedMinaNFTTreeStateProof(height) {}

  class MinaNFTTreeVerifier_ extends SmartContract {
    deploy(args: DeployArgs) {
      super.deploy(args);
      this.account.permissions.set({
        ...Permissions.default(),
        setDelegate: Permissions.proof(),
        incrementNonce: Permissions.proof(),
        setVotingFor: Permissions.proof(),
        setTiming: Permissions.proof(),
      });
    }

    @method verifyRedactedTree(proof: RedactedTreeProof) {
      proof.verify();
    }
  }
  return MinaNFTTreeVerifier_;
}
