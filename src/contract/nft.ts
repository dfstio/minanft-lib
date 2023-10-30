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
} from "o1js";
import { OwnerProof, Update, Metadata } from "./owner";
import { EscrowProof, EscrowData } from "./escrow";

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

  @method update(proof: OwnerProof) {
    this.owner.getAndAssertEquals();
    this.owner.assertEquals(proof.publicInput.owner);

    this.name.assertEquals(this.name.get());
    this.name.assertEquals(proof.publicInput.name);

    const version = this.version.get();
    this.version.assertEquals(version);
    const newVersion: UInt64 = version.add(UInt64.from(1));
    newVersion.assertEquals(proof.publicInput.version);

    this.metadata.getAndAssertEquals();
    this.metadata.assertEquals(proof.publicInput.oldRoot);

    proof.verify();

    this.metadata.set(proof.publicInput.newRoot);
    this.version.set(newVersion);
    this.storage.set(proof.publicInput.storage);
    this.escrow.set(proof.publicInput.escrow);

    this.emitEvent("update", proof.publicInput);
  }
  /*
  @method transfer(secret: Field, newOwner: Field) {
    this.owner.assertEquals(this.owner.get());
    this.owner.assertEquals(Poseidon.hash([secret]));

    this.owner.set(newOwner);
    this.emitEvent("transfer", newOwner);
  }
*/
  @method transfer(proof: EscrowProof) {
    this.owner.getAndAssertEquals();
    this.owner.assertEquals(proof.publicInput.oldOwner);
    this.escrow.getAndAssertEquals();
    this.escrow.assertEquals(proof.publicInput.escrow);
    // TODO: this.escrow.assertNotEquals(Field(0));
    this.name.getAndAssertEquals();
    this.name.assertEquals(proof.publicInput.name);

    proof.verify();

    this.owner.set(proof.publicInput.newOwner);

    this.emitEvent("transfer", proof.publicInput);
  }
}
