import {
  Field,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  Poseidon,
  SmartContract,
  PublicKey,
  Struct,
  UInt64,
} from "o1js";

export { MinaNFTContract, Metadata, Storage, Update };

class Metadata extends Struct({
  data: Field,
  kind: Field,
}) {
  static assertEquals(state1: Metadata, state2: Metadata) {
    state1.data.assertEquals(state2.data);
    state1.kind.assertEquals(state2.kind);
  }
}

class Storage extends Struct({
  url: [Field, Field, Field], // IPFS or Arweave url
}) {}

class Update extends Struct({
  oldMetadata: Metadata,
  newMetadata: Metadata,
  storage: Storage,
  verifier: PublicKey,
  version: UInt64,
}) {}

/**
 * class MinaNFTContract
 *
 */
class MinaNFTContract extends SmartContract {
  @state(Field) name = State<Field>();
  @state(Metadata) metadata = State<Metadata>();
  @state(Storage) storage = State<Storage>();
  @state(Field) owner = State<Field>();
  @state(UInt64) version = State<UInt64>();

  events = {
    mint: Field,
    update: Update,
    transfer: Field,
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
    this.emitEvent("mint", Field(0));
  }

  @method update(data: Update, secret: Field) {
    this.owner.assertEquals(this.owner.get());
    this.owner.assertEquals(Poseidon.hash([secret]));

    this.metadata.assertEquals(this.metadata.get());
    this.metadata.assertEquals(data.oldMetadata);

    const version = this.version.get();
    this.version.assertEquals(version);
    const newVersion: UInt64 = version.add(UInt64.from(1));
    newVersion.assertEquals(data.version);

    this.metadata.set(data.newMetadata);
    this.version.set(newVersion);
    this.storage.set(data.storage);

    this.emitEvent("update", data);
  }

  @method transfer(secret: Field, newOwner: Field) {
    this.owner.assertEquals(this.owner.get());
    this.owner.assertEquals(Poseidon.hash([secret]));

    this.owner.set(newOwner);
    this.emitEvent("transfer", newOwner);
  }
}
