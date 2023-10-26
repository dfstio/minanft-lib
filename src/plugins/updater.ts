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

export { MinaNFTUpdater, MinaNFTUpdaterEvent };

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

  @method update(data: Update, address: PublicKey, secret: Field) {
    const nft = new MinaNFTContract(address);
    const metadata = nft.metadata.get();
    Metadata.assertEquals(metadata, data.oldMetadata);
    this.address.assertEquals(data.verifier);

    // Check that all versions are properly verified
    const version = nft.version.get();
    const account = Account(address, this.token.id);
    const tokenBalance = account.balance.get();
    account.balance.assertEquals(tokenBalance);
    //Provable.log("tokenBalance", tokenBalance);
    //Provable.log("version", version);
    tokenBalance.assertEquals(version.mul(UInt64.from(1_000_000_000n)));

    nft.update(data, secret);
    this.token.mint({ address, amount: 1_000_000_000n });

    this.emitEvent(
      "update",
      new MinaNFTUpdaterEvent({ address, update: data })
    );
  }
}
