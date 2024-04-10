export { MinaNFTVerifier };

import {
  method,
  DeployArgs,
  Permissions,
  SmartContract,
  PublicKey,
  Field,
} from "o1js";

import { RedactedMinaNFTMapStateProof } from "./redactedmap";
import { MinaNFTContract } from "../contract/nft";
import { Metadata } from "../contract/metadata";

class MinaNFTVerifier extends SmartContract {
  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
  }

  @method async verifyRedactedMetadata(
    nft: PublicKey,
    tokenId: Field,
    proof: RedactedMinaNFTMapStateProof
  ) {
    const minanft = new MinaNFTContract(nft, tokenId);
    const nftMetadata: Metadata = minanft.metadata.get();
    Metadata.assertEquals(nftMetadata, proof.publicInput.originalRoot);

    proof.verify();
  }
}
