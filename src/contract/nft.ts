export { MinaNFTContract, Metadata, Update };

import {
  Field,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  SmartContract,
  UInt64,
  Signature,
  PublicKey,
  Poseidon,
} from "o1js";
import { Update, Metadata } from "./owner";
import { EscrowData } from "./escrow";

/**
 * class MinaNFTContract
 *
 */
class MinaNFTContract extends SmartContract {
  @state(Field) name = State<Field>();
  @state(Metadata) metadata = State<Metadata>();
  @state(Field) storage = State<Field>();
  @state(Field) owner = State<Field>();
  @state(Field) escrow = State<Field>();
  @state(UInt64) version = State<UInt64>();

  events = {
    mint: Field,
    update: Update,
    transfer: EscrowData,
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

  @method update(update: Update, signature: Signature, owner: PublicKey) {
    signature.verify(owner, update.toFields());
    update.owner.assertEquals(Poseidon.hash(owner.toFields()));

    this.owner.getAndAssertEquals().assertEquals(update.owner);
    this.name.getAndAssertEquals().assertEquals(update.name);

    const version = this.version.getAndAssertEquals();
    const newVersion: UInt64 = version.add(UInt64.from(1));
    newVersion.assertEquals(update.version);

    this.metadata.getAndAssertEquals();
    this.metadata.assertEquals(update.oldRoot);

    this.metadata.set(update.newRoot);
    this.version.set(newVersion);
    this.storage.set(update.storage);
    this.escrow.set(update.escrow);

    this.emitEvent("update", update);
  }

  @method transfer(
    data: EscrowData,
    signature1: Signature,
    signature2: Signature,
    signature3: Signature,
    escrow1: PublicKey,
    escrow2: PublicKey,
    escrow3: PublicKey
  ) {
    this.owner.getAndAssertEquals().assertEquals(data.oldOwner);
    this.escrow.getAndAssertEquals().assertNotEquals(Field(0));
    this.escrow.assertEquals(data.escrow);
    this.name.getAndAssertEquals().assertEquals(data.name);
    const dataFields = data.toFields();
    signature1.verify(escrow1, dataFields);
    signature2.verify(escrow2, dataFields);
    signature3.verify(escrow3, dataFields);
    data.escrow.assertEquals(
      Poseidon.hash([
        Poseidon.hash(escrow1.toFields()),
        Poseidon.hash(escrow2.toFields()),
        Poseidon.hash(escrow3.toFields()),
      ])
    );

    this.owner.set(data.newOwner);
    this.emitEvent("transfer", data);
  }
}
