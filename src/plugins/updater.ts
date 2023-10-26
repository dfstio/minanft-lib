export { MinaNFTUpdater, MinaNFTUpdaterEvent };

import {
  Account,
  Field,
  Permissions,
  PublicKey,
  SmartContract,
  Struct,
  UInt64,
  method,
  DeployArgs,
} from "o1js";
import { MinaNFTContract, Update, Metadata } from "../contract/nft";
import { MinaNFTMetadataUpdateProof } from "../contract/metadata";

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
    data: Update,
    address: PublicKey,
    secret: Field,
    proof: MinaNFTMetadataUpdateProof
  ) {
    const nft = new MinaNFTContract(address);

    // Check that the metadata is correct
    const metadata = nft.metadata.get();
    Metadata.assertEquals(metadata, data.oldRoot);
    Metadata.assertEquals(metadata, proof.publicInput.oldRoot);
    this.address.assertEquals(data.verifier);

    // Check that all versions are properly verified
    const version = nft.version.get();
    const account = Account(address, this.token.id);
    const tokenBalance = account.balance.get();
    account.balance.assertEquals(tokenBalance);
    tokenBalance.assertEquals(version.mul(UInt64.from(1_000_000_000n)));

    // Check that the proof verifies
    proof.verify();

    // Update metadata
    nft.update(data, secret);

    // Issue verification badge
    this.token.mint({ address, amount: 1_000_000_000n });

    // Emit event
    this.emitEvent(
      "update",
      new MinaNFTUpdaterEvent({ address, update: data })
    );
  }
}
