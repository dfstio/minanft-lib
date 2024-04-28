export { Update, Metadata, MetadataWitness, Storage };
import {
  PublicKey,
  Struct,
  Field,
  UInt64,
  MerkleMapWitness,
  Provable,
  Encoding,
  Bool,
} from "o1js";
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
  hashString: Provable.Array(Field, 2),
}) {
  constructor(value: { hashString: [Field, Field] }) {
    super(value);
  }

  static empty(): Storage {
    return new Storage({ hashString: [Field(0), Field(0)] });
  }

  isEmpty(): Bool {
    return this.hashString[0]
      .equals(Field(0))
      .and(this.hashString[1].equals(Field(0)));
  }

  static assertEquals(a: Storage, b: Storage) {
    a.hashString[0].assertEquals(b.hashString[0]);
    a.hashString[1].assertEquals(b.hashString[1]);
  }

  static fromIpfsHash(hash: string): Storage {
    const fields = Encoding.stringToFields("i:" + hash);
    if (fields.length !== 2) throw new Error("Invalid IPFS hash");
    return new Storage({ hashString: [fields[0], fields[1]] });
  }

  toIpfsHash(): string {
    const hash = Encoding.stringFromFields(this.hashString);
    if (hash.startsWith("i:")) {
      return hash.substring(2);
    } else throw new Error("Invalid IPFS hash");
  }

  toString(): string {
    if (this.isEmpty().toBoolean()) return "";
    else return Encoding.stringFromFields(this.hashString);
  }

  static fromString(storage: string) {
    if (
      storage.startsWith("i:") === false &&
      storage.startsWith("a:") === false
    )
      throw new Error("Invalid storage string");
    const fields = Encoding.stringToFields(storage);
    if (fields.length !== 2) throw new Error("Invalid storage string");
    return new Storage({ hashString: [fields[0], fields[1]] });
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
}
