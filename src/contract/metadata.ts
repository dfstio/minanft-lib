export { Update, Metadata, MetadataWitness, Storage };
import { PublicKey, Struct, Field, UInt64, MerkleMapWitness } from "o1js";
/**
 * Metadata is the metadata of the NFT written to the Merkle Map
 * @property data The root of the Merkle Map of the data or data itself if it is a leaf
 * @property kind The root of the Merkle Map of the kind or kind itself if it is a leaf.
 * Kind can be one of the "string" or "text" or "map" or "image" or any string like "mykind"
 */
class Metadata extends Struct({
  data: Field,
  kind: Field,
}) {
  /**
   * Asserts that two Metadata objects are equal
   * @param state1 first Metadata object
   * @param state2 second Metadata object
   */
  static assertEquals(state1: Metadata, state2: Metadata) {
    state1.data.assertEquals(state2.data);
    state1.kind.assertEquals(state2.kind);
  }
}

/**
 * MetadataWitness is the witness of the metadata in the Merkle Map
 * @property data The witness of the data
 * @property kind The witness of the kind
 */
class MetadataWitness extends Struct({
  data: MerkleMapWitness,
  kind: MerkleMapWitness,
}) {
  /**
   * Asserts that two MetadataWitness objects are equal
   * @param state1 first MetadataWitness object
   * @param state2 second MetadataWitness object
   */
  static assertEquals(state1: Metadata, state2: Metadata) {
    state1.data.assertEquals(state2.data);
    state1.kind.assertEquals(state2.kind);
  }
}

/**
 * Storage is the hash of the IPFS or Arweave storage where the NFT metadata is written
 * format of the IPFS hash string: i:...
 * format of the Arweave hash string: a:...
 * @property hashString The hash string of the storage
 */
class Storage extends Struct({
  hashString: [Field, Field],
}) {
  constructor(value: { hashString: [Field, Field] }) {
    super(value);
  }
  toFields(): Field[] {
    return this.hashString;
  }
}

/**
 * Update is the data for the update of the metadata to be written to the NFT state
 * @property oldRoot The old root of the Merkle Map of the metadata
 * @property newRoot The new root of the Merkle Map of the metadata
 * @property storage The storage of the NFT - IPFS (i:...) or Arweave (a:...) hash string
 * @property name The name of the NFT
 * @property owner The owner of the NFT - Poseidon hash of owner's public key
 * @property version The new version of the NFT, increases by one with the changing of the metadata or owner
 * @property verifier The verifier of the NFT - the contract that sends this update
 */
class Update extends Struct({
  oldRoot: Metadata,
  newRoot: Metadata,
  storage: Storage,
  name: Field,
  owner: Field,
  version: UInt64,
  verifier: PublicKey,
}) {
  constructor(value: {
    oldRoot: Metadata;
    newRoot: Metadata;
    storage: Storage;
    name: Field;
    owner: Field;
    version: UInt64;
    verifier: PublicKey;
  }) {
    super(value);
  }

  toFields(): Field[] {
    const verifier = this.verifier.toFields();
    return [
      this.oldRoot.data,
      this.oldRoot.kind,
      this.newRoot.data,
      this.newRoot.kind,
      ...this.storage.toFields(),
      this.name,
      this.owner,
      this.version.toFields()[0],
      verifier[0],
      verifier[1],
    ];
  }
}
