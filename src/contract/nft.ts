export { MinaNFTContract };
import {
  Field,
  state,
  State,
  method,
  SmartContract,
  UInt64,
  Signature,
  PublicKey,
  Poseidon,
  Bool,
} from "o1js";
import { Update, Metadata, Storage } from "./metadata";
import { MinaNFTMetadataUpdateProof } from "./update";
import { EscrowTransfer, EscrowApproval } from "./escrow";
import { EscrowTransferProof } from "./transfer";

/**
 * MinaNFTContract is a smart contract that implements the Mina NFT standard.
 * @property name The name of the NFT.
 * @property metadata The metadata of the NFT.
 * @property storage The storage of the NFT - IPFS (i:...) or Arweave (a:...) hash string
 * @property owner The owner of the NFT - Poseidon hash of owner's public key
 * @property escrow The escrow of the NFT - Poseidon hash of three escrow's public keys
 * @property version The version of the NFT, increases by one with the changing of the metadata or the owner
 */
class MinaNFTContract extends SmartContract {
  @state(Field) name = State<Field>();
  @state(Metadata) metadata = State<Metadata>();
  @state(Storage) storage = State<Storage>();
  @state(Field) owner = State<Field>();
  @state(Field) escrow = State<Field>();
  @state(UInt64) version = State<UInt64>();

  /**
   * Update metadata of the NFT
   * @param update {@link Update} - data for the update
   * @param signature signature of the owner
   * @param owner owner's public key
   * @param proof {@link MinaNFTMetadataUpdateProof} - proof of the update of the metadata to be correctly inserted into the Merkle Map
   */

  @method async update(
    update: Update,
    signature: Signature,
    owner: PublicKey,
    proof: MinaNFTMetadataUpdateProof
  ) {
    // Check that the metadata is correct
    const metadata = this.metadata.getAndRequireEquals();
    Metadata.assertEquals(metadata, update.oldRoot);
    Metadata.assertEquals(metadata, proof.publicInput.oldRoot);
    Metadata.assertEquals(proof.publicInput.newRoot, update.newRoot);

    // Check that the proof verifies
    proof.verify();

    signature.verify(owner, Update.toFields(update)).assertEquals(Bool(true));
    //signature.verify(owner, [Field(30)]).assertEquals(Bool(true));
    update.owner.assertEquals(Poseidon.hash(owner.toFields()));

    this.owner
      .getAndRequireEquals()
      .assertEquals(update.owner, "Owner mismatch");
    this.name.getAndRequireEquals().assertEquals(update.name, "Name mismatch");

    const version = this.version.getAndRequireEquals();
    const newVersion: UInt64 = version.add(UInt64.from(1));
    newVersion.assertEquals(update.version);

    this.metadata.set(update.newRoot);
    this.version.set(update.version);
    this.storage.set(update.storage);
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
  @method async escrowTransfer(
    data: EscrowTransfer,
    signature1: Signature,
    signature2: Signature,
    signature3: Signature,
    escrow1: PublicKey,
    escrow2: PublicKey,
    escrow3: PublicKey
  ) {
    this.owner
      .getAndRequireEquals()
      .assertEquals(data.oldOwner, "Owner mismatch");
    const escrow = this.escrow.getAndRequireEquals();
    escrow.assertNotEquals(Field(0), "Escrow is not set");
    escrow.assertEquals(data.escrow);
    this.name.getAndRequireEquals().assertEquals(data.name, "Name mismatch");
    const version = this.version.getAndRequireEquals();
    const newVersion: UInt64 = version.add(UInt64.from(1));
    newVersion.assertEquals(data.version);
    const dataFields = EscrowTransfer.toFields(data);
    signature1.verify(escrow1, dataFields).assertEquals(true);
    signature2.verify(escrow2, dataFields).assertEquals(true);
    signature3.verify(escrow3, dataFields).assertEquals(true);
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
  }

  /**
   * Approve setting of the new escrow
   * @param proof {@link EscrowTransferProof} - escrow proof
   */
  @method async approveEscrow(proof: EscrowTransferProof) {
    proof.verify();
    this.owner
      .getAndRequireEquals()
      .assertEquals(proof.publicInput.owner, "Owner mismatch");
    this.name
      .getAndRequireEquals()
      .assertEquals(proof.publicInput.approval.name, "Name mismatch");

    const version = this.version.getAndRequireEquals();
    const newVersion: UInt64 = version.add(UInt64.from(1));
    newVersion.assertEquals(proof.publicInput.approval.version);

    this.version.set(proof.publicInput.approval.version);
    this.escrow.set(proof.publicInput.approval.escrow);
  }
}
