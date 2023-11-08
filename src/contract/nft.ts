export { MinaNFTContract };
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
import { Update, Metadata, Storage } from "./metadata";
import { MinaNFTMetadataUpdateProof } from "./update";
import { EscrowTransfer, EscrowApproval } from "./escrow";

/**
 * MinaNFTContract is a smart contract that implements the Mina NFT standard.
 * @property name The name of the NFT.
 * @property metadata The metadata of the NFT.
 * @property storage The storage of the NFT - IPFS (i:...) or Arweave (a:...) hash string
 * @property owner The owner of the NFT - Poseidon hash of owner's public key
 * @property escrow The escrow of the NFT - Poseidon hash of three escrow's public keys
 * @property version The version of the NFT, increases by one with the chaing of the metadata or owner
 */
class MinaNFTContract extends SmartContract {
  @state(Field) name = State<Field>();
  @state(Metadata) metadata = State<Metadata>();
  @state(Storage) storage = State<Storage>();
  @state(Field) owner = State<Field>();
  @state(Field) escrow = State<Field>();
  @state(UInt64) version = State<UInt64>();

  /**
   * @event mint NFT minted
   * @event update NFT metadata updated
   * @event transfer NFT transferred
   * @event approveEscrow NFT escrow approved
   */

  events = {
    mint: Field,
    update: Update,
    transfer: EscrowTransfer,
    approveEscrow: EscrowApproval,
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

  /**
   * Update metadata of the NFT
   * @param update {@link Update} - data for the update
   * @param signature signature of the owner
   * @param owner owner's public key
   * @param proof {@link MinaNFTMetadataUpdateProof} - proof of the update of the metadata to be correctly inserted into the Merkle Map
   */
  @method update(
    update: Update,
    signature: Signature,
    owner: PublicKey,
    proof: MinaNFTMetadataUpdateProof
    //uri: Types.ZkappUri
  ) {
    // Check that the metadata is correct
    const metadata = this.metadata.getAndAssertEquals();
    Metadata.assertEquals(metadata, update.oldRoot);
    Metadata.assertEquals(metadata, proof.publicInput.oldRoot);
    Metadata.assertEquals(proof.publicInput.newRoot, update.newRoot);

    // Check that the proof verifies
    proof.verify();

    signature.verify(owner, update.toFields());
    update.owner.assertEquals(Poseidon.hash(owner.toFields()));

    this.owner
      .getAndAssertEquals()
      .assertEquals(update.owner, "Owner mismatch");
    this.name.getAndAssertEquals().assertEquals(update.name, "Name mismatch");

    const version = this.version.getAndAssertEquals();
    const newVersion: UInt64 = version.add(UInt64.from(1));
    newVersion.assertEquals(update.version);

    this.metadata.set(update.newRoot);
    this.version.set(newVersion);
    this.storage.set(update.storage);
    //this.account.zkappUri.set(uri.data);

    this.emitEvent("update", update);
  }
  /**
   * Transfer the NFT to new owner
   * @param data {@link EscrowTransfer} - data for the transfer
   * @param signature1 signature of the first escrow
   * @param signature2 signature of the second escrow
   * @param signature3 signature of the third escrow
   * @param escrow1 public key of the first escrow
   * @param escrow2 public key of the second escrow
   * @param escrow3 public key of the third escrow
   */
  @method transfer(
    data: EscrowTransfer,
    signature1: Signature,
    signature2: Signature,
    signature3: Signature,
    escrow1: PublicKey,
    escrow2: PublicKey,
    escrow3: PublicKey
  ) {
    this.owner
      .getAndAssertEquals()
      .assertEquals(data.oldOwner, "Owner mismatch");
    this.escrow
      .getAndAssertEquals()
      .assertNotEquals(Field(0), "Escrow is not set");
    this.escrow.assertEquals(data.escrow);
    this.name.getAndAssertEquals().assertEquals(data.name, "Name mismatch");
    const version = this.version.getAndAssertEquals();
    const newVersion: UInt64 = version.add(UInt64.from(1));
    newVersion.assertEquals(data.version);
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
    this.version.set(newVersion);
    this.escrow.set(Field(0));

    this.emitEvent("transfer", data);
  }
  /**
   * Approve setting of the new escrow
   * @param data {@link EscrowApproval} - data for the approval
   * @param signature signature of the owner
   * @param owner owner's public key
   */
  @method approveEscrow(
    data: EscrowApproval,
    signature: Signature,
    owner: PublicKey
  ) {
    signature.verify(owner, data.toFields());
    data.owner.assertEquals(Poseidon.hash(owner.toFields()));

    this.owner.getAndAssertEquals().assertEquals(data.owner, "Owner mismatch");
    this.name.getAndAssertEquals().assertEquals(data.name, "Name mismatch");

    const version = this.version.getAndAssertEquals();
    const newVersion: UInt64 = version.add(UInt64.from(1));
    newVersion.assertEquals(data.version);

    this.version.set(newVersion);
    this.escrow.set(data.escrow);

    this.emitEvent("approveEscrow", data);
  }
}
