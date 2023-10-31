export { MinaNFTUpdater, MinaNFTUpdaterEvent };

import {
  Field,
  Permissions,
  PublicKey,
  SmartContract,
  Struct,
  method,
  DeployArgs,
  Signature,
  Account,
  UInt64,
} from "o1js";
import { MinaNFTContract } from "../contract/nft";
import { MinaNFTMetadataUpdateProof } from "./update";
import { Update, Metadata } from "../contract/metadata";

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
    update: Update,
    signature: Signature,
    owner: PublicKey,
    proof: MinaNFTMetadataUpdateProof
  ) {
    const nft = new MinaNFTContract(address);

    // Check that the metadata is correct
    const metadata = nft.metadata.get();
    Metadata.assertEquals(metadata, update.oldRoot);
    Metadata.assertEquals(metadata, proof.publicInput.oldRoot);
    Metadata.assertEquals(proof.publicInput.newRoot, update.newRoot);
    this.address.assertEquals(update.verifier);

    // Check that all versions are properly verified
    const version = nft.version.getAndAssertEquals();
    const account = Account(address, this.token.id);
    const tokenBalance = account.balance.getAndAssertEquals();
    tokenBalance.assertEquals(version.mul(UInt64.from(1_000_000_000n)));

    // Check that the proof verifies
    proof.verify();

    // Update metadata
    nft.update(update, signature, owner);

    // Issue verification badge
    this.token.mint({ address, amount: 1_000_000_000n });

    // Emit event
    this.emitEvent("update", new MinaNFTUpdaterEvent({ address, update }));
  }
}
