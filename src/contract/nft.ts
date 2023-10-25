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

class Metadata extends Struct({
  data: Field,
  kind: Field,
}) {
  static assertEquals(state1: Metadata, state2: Metadata) {
    state1.data.assertEquals(state2.data);
    state1.kind.assertEquals(state2.kind);
  }
}

class Sale extends Struct({
  tokenId: Field,
  price: UInt64,
  approvedHash: Field,
}) {
  static assertEquals(state1: Sale, state2: Sale) {
    state1.tokenId.assertEquals(state2.tokenId);
    state1.price.assertEquals(state2.price);
    state1.approvedHash.assertEquals(state2.approvedHash);
  }
}

class Storage extends Struct({
  hash: [Field, Field, Field], // IPFS or Arweave url
}) {}

class Update extends Struct({
  oldMetadata: Metadata,
  newMetadata: Metadata,
  storage: Storage,
  verifier: PublicKey,
  version: Field,
}) {}

/**
 * class MinaNFTContract
 *
 */
export class MinaNFTContract extends SmartContract {
  @state(Field) name = State<Field>();
  @state(Field) version = State<Field>();
  @state(Metadata) metadata = State<Metadata>();
  @state(Sale) sale = State<Sale>();
  @state(Field) pwdHash = State<Field>();

  events = {
    mint: Field,
    update: Update,
    changePassword: Field,
    transfer: Field,
    approve: Field,
    sale: Sale,
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
    this.pwdHash.assertEquals(this.pwdHash.get());
    this.pwdHash.assertEquals(Poseidon.hash([secret]));

    this.metadata.assertEquals(this.metadata.get());
    this.metadata.assertEquals(data.oldMetadata);

    const version = this.version.get();
    this.version.assertEquals(version);
    const newVersion = version.add(Field(1));
    newVersion.assertEquals(data.version);

    this.metadata.set(data.newMetadata);
    this.version.set(newVersion);

    this.emitEvent("update", data);
  }

  @method changePassword(secret: Field, newPwdHash: Field) {
    this.pwdHash.assertEquals(this.pwdHash.get());
    this.pwdHash.assertEquals(Poseidon.hash([secret]));

    this.pwdHash.set(newPwdHash);
    this.emitEvent("changePassword", newPwdHash);
  }
  /*
  @method transfer(approvedSecret: Field, newPwdHash: Field) {
    const approved = this.approved.get();
    this.approved.assertEquals(approved);
    approved.assertEquals(Poseidon.hash([approvedSecret]));
    approved.assertNotEquals(Field(0));

    this.pwdHash.set(newPwdHash);
    this.emitEvent("transfer", newPwdHash);
  }

  @method transfer(approvedSecret: Field, newPwdHash: Field) {
    this.sale.assertEquals(this.sale.get());
    this.sale.approvedHash.assertEquals(Sale.default());
    const token = new MinaNFTContract(this.address, this.sale.get().tokenId);
    
    const balance: UInt64 = token.account.balance;
    const price: UInt64 = this.sale.get().price;
    this.sale.assertEquals(this.sale.get());
    balance.assertGreaterThan(price);
    const approved = this.approved.get();
    this.approved.assertEquals(approved);
    approved.assertEquals(Poseidon.hash([approvedSecret]));
    approved.assertNotEquals(Field(0));

    this.pwdHash.set(newPwdHash);
    this.emitEvent("transfer", newPwdHash);
  }
  */

  @method sell(secret: Field, sale: Sale) {
    this.pwdHash.assertEquals(this.pwdHash.get());
    this.pwdHash.assertEquals(Poseidon.hash([secret]));

    this.sale.set(sale);
    this.emitEvent("sale", sale);
  }
}
