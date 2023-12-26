export {
  MetadataUpdate,
  MetadataTransition,
  MetadataMap,
  MinaNFTMetadataUpdate,
  MinaNFTMetadataUpdateProof,
};
import { Field, SelfProof, ZkProgram, Struct, MerkleMap } from "o1js";
import { Metadata, MetadataWitness } from "../contract/metadata";

/**
 * MetadataMap is a wrapper around MerkleMap that stores Metadata
 * @property data The MerkleMap of the data
 * @property kind The MerkleMap of the kind
 */
class MetadataMap {
  data: MerkleMap;
  kind: MerkleMap;

  constructor() {
    this.data = new MerkleMap();
    this.kind = new MerkleMap();
  }

  /**
   * Calculates the root of the MerkleMap
   * @returns {@link Metadata} root of the MerkleMap
   */
  getRoot(): Metadata {
    return new Metadata({
      data: this.data.getRoot(),
      kind: this.kind.getRoot(),
    });
  }

  /**
   * Get value at key
   * @param key key of the data and kind requested
   * @returns {@link Metadata} value of the data and kind at key
   */
  get(key: Field): Metadata {
    return new Metadata({
      data: this.data.get(key),
      kind: this.kind.get(key),
    });
  }

  /**
   * Sets the data and kind at key
   * @param key key of the data and kind to set
   * @param value {@link Metadata} data and kind to set
   */
  set(key: Field, value: Metadata): void {
    this.data.set(key, value.data);
    this.kind.set(key, value.kind);
  }

  /**
   * Calculates the witness of the data and kind at key
   * @param key key of the data and kind, for which witness is requested
   * @returns {@link MetadataWitness} witness of the data and kind at key
   */
  getWitness(key: Field): MetadataWitness {
    return new MetadataWitness({
      data: this.data.getWitness(key),
      kind: this.kind.getWitness(key),
    });
  }
}

class MetadataUpdate extends Struct({
  oldRoot: Metadata,
  newRoot: Metadata,
  key: Field,
  oldValue: Metadata,
  newValue: Metadata,
  witness: MetadataWitness,
}) {
  toFields(): Field[] {
    return [
      ...this.oldRoot.toFields(),
      ...this.newRoot.toFields(),
      this.key,
      ...this.oldValue.toFields(),
      ...this.newValue.toFields(),
      ...this.witness.toFields(),
    ];
  }

  static fromFields(fields: Field[]): MetadataUpdate {
    return new MetadataUpdate({
      oldRoot: Metadata.fromFields(fields.slice(0, 2)),
      newRoot: Metadata.fromFields(fields.slice(2, 4)),
      key: fields[4],
      oldValue: Metadata.fromFields(fields.slice(5, 7)),
      newValue: Metadata.fromFields(fields.slice(7, 9)),
      witness: MetadataWitness.fromFields(fields.slice(9)),
    });
  }
}

class MetadataTransition extends Struct({
  oldRoot: Metadata,
  newRoot: Metadata,
}) {
  static create(update: MetadataUpdate) {
    const [dataWitnessRootBefore, dataWitnessKey] =
      update.witness.data.computeRootAndKey(update.oldValue.data);
    update.oldRoot.data.assertEquals(dataWitnessRootBefore);
    dataWitnessKey.assertEquals(update.key);
    const [kindWitnessRootBefore, kindWitnessKey] =
      update.witness.kind.computeRootAndKey(update.oldValue.kind);
    update.oldRoot.kind.assertEquals(kindWitnessRootBefore);
    kindWitnessKey.assertEquals(update.key);

    const [dataWitnessRootAfter, _] = update.witness.data.computeRootAndKey(
      update.newValue.data
    );
    update.newRoot.data.assertEquals(dataWitnessRootAfter);
    const [kindWitnessRootAfter, __] = update.witness.kind.computeRootAndKey(
      update.newValue.kind
    );
    update.newRoot.kind.assertEquals(kindWitnessRootAfter);

    return new MetadataTransition({
      oldRoot: update.oldRoot,
      newRoot: update.newRoot,
    });
  }

  static merge(
    transition1: MetadataTransition,
    transition2: MetadataTransition
  ) {
    return new MetadataTransition({
      oldRoot: transition1.oldRoot,
      newRoot: transition2.newRoot,
    });
  }

  static assertEquals(
    transition1: MetadataTransition,
    transition2: MetadataTransition
  ) {
    Metadata.assertEquals(transition1.oldRoot, transition2.oldRoot);
    Metadata.assertEquals(transition1.newRoot, transition2.newRoot);
  }

  toFields(): Field[] {
    return [...this.oldRoot.toFields(), ...this.newRoot.toFields()];
  }

  static fromFields(fields: Field[]): MetadataTransition {
    return new MetadataTransition({
      oldRoot: Metadata.fromFields(fields.slice(0, fields.length / 2)),
      newRoot: Metadata.fromFields(fields.slice(fields.length / 2)),
    });
  }
}

const MinaNFTMetadataUpdate = ZkProgram({
  name: "MinaNFTMetadataUpdate",
  publicInput: MetadataTransition,

  methods: {
    update: {
      privateInputs: [MetadataUpdate],

      method(state: MetadataTransition, update: MetadataUpdate) {
        const computedState = MetadataTransition.create(update);
        MetadataTransition.assertEquals(computedState, state);
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      method(
        newState: MetadataTransition,
        proof1: SelfProof<MetadataTransition, void>,
        proof2: SelfProof<MetadataTransition, void>
      ) {
        proof1.verify();
        proof2.verify();

        Metadata.assertEquals(
          proof1.publicInput.newRoot,
          proof2.publicInput.oldRoot
        );
        Metadata.assertEquals(proof1.publicInput.oldRoot, newState.oldRoot);
        Metadata.assertEquals(proof2.publicInput.newRoot, newState.newRoot);
      },
    },
  },
});

class MinaNFTMetadataUpdateProof extends ZkProgram.Proof(
  MinaNFTMetadataUpdate
) {}
