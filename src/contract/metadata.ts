export { Update, Metadata, MetadataWitness };
import { PublicKey, Struct, Field, UInt64, MerkleMapWitness } from "o1js";

class Metadata extends Struct({
  data: Field,
  kind: Field,
}) {
  static assertEquals(state1: Metadata, state2: Metadata) {
    state1.data.assertEquals(state2.data);
    state1.kind.assertEquals(state2.kind);
  }
}

class MetadataWitness extends Struct({
  data: MerkleMapWitness,
  kind: MerkleMapWitness,
}) {
  static assertEquals(state1: Metadata, state2: Metadata) {
    state1.data.assertEquals(state2.data);
    state1.kind.assertEquals(state2.kind);
  }
}

class Update extends Struct({
  oldRoot: Metadata,
  newRoot: Metadata,
  storage: Field,
  escrow: Field,
  name: Field,
  owner: Field,
  version: UInt64,
  verifier: PublicKey,
}) {
  constructor(args: any) {
    super(args);
  }

  toFields(): Field[] {
    const verifier = this.verifier.toFields();
    return [
      this.oldRoot.data,
      this.oldRoot.kind,
      this.newRoot.data,
      this.newRoot.kind,
      this.storage,
      this.escrow,
      this.name,
      this.owner,
      this.version.toFields()[0],
      verifier[0],
      verifier[1],
    ];
  }
}
