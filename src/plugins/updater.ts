export { MinaNFTUpdater, MinaNFTUpdaterEvent };

import {
  Field,
  Permissions,
  PublicKey,
  SmartContract,
  Struct,
  method,
  DeployArgs,
} from "o1js";
import { MinaNFTContract, Update, Metadata } from "../contract/nft";
import { MinaNFTMetadataUpdateProof } from "../contract/metadata";
import { OwnerProof } from "../contract/owner";

class MinaNFTUpdaterEvent extends Struct({
  address: PublicKey,
  update: Update,
}) {}

class MinaNFTUpdater extends SmartContract {
  events = {
    deploy: Field,
    update: MinaNFTUpdaterEvent,
  };

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
    this.emitEvent("deploy", Field(0));
  }

  init() {
    super.init();
  }

  @method update(
    address: PublicKey,
    ownerProof: OwnerProof,
    proof: MinaNFTMetadataUpdateProof
  ) {
    const nft = new MinaNFTContract(address);

    // Check that the metadata is correct
    const metadata = nft.metadata.get();
    Metadata.assertEquals(metadata, ownerProof.publicInput.oldRoot);
    Metadata.assertEquals(metadata, proof.publicInput.oldRoot);
    Metadata.assertEquals(
      proof.publicInput.newRoot,
      ownerProof.publicInput.newRoot
    );
    this.address.assertEquals(ownerProof.publicInput.verifier);

    /*
    // Check that all versions are properly verified
    const version = nft.version.get();
    const account = Account(address, this.token.id);
    const tokenBalance = account.balance.get();
    account.balance.assertEquals(tokenBalance);
    tokenBalance.assertEquals(version.mul(UInt64.from(1_000_000_000n)));
    */

    // Check that the proof verifies
    proof.verify();

    // Update metadata
    nft.update(ownerProof);

    // Issue verification badge
    this.token.mint({ address, amount: 1_000_000_000n });

    // Emit event
    this.emitEvent(
      "update",
      new MinaNFTUpdaterEvent({ address, update: ownerProof.publicInput })
    );
  }
}
