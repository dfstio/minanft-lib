import {
  Field,
  method,
  DeployArgs,
  Permissions,
  SmartContract,
  PublicKey,
} from "o1js";

import { RedactedMinaNFTMapStateProof } from "./redactedmap";
import { MinaNFTContract } from "./minanft";

export class MinaNFTVerifier extends SmartContract {
  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      setPermissions: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
      setZkappUri: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
  }

  @method verifyPublicAttributes(
    nft: PublicKey,
    proof: RedactedMinaNFTMapStateProof
  ) {
    const minanft = new MinaNFTContract(nft);
    const nftPublicAttributesRoot: Field = minanft.publicAttributesRoot.get();
    proof.publicInput.originalRoot.assertEquals(nftPublicAttributesRoot);

    proof.verify();
  }

  @method verifyPrivateAttributes(
    nft: PublicKey,
    privateAttributesRoot: Field,
    proof: RedactedMinaNFTMapStateProof
  ) {
    const minanft = new MinaNFTContract(nft);
    const nftPrivateAttributesRoot: Field = minanft.privateAttributesRoot.get();
    nftPrivateAttributesRoot.assertEquals(privateAttributesRoot);

    proof.publicInput.originalRoot.assertEquals(privateAttributesRoot);

    proof.verify();
  }
}
