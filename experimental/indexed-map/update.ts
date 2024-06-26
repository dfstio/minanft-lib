import {
  Field,
  SelfProof,
  ZkProgram,
  Struct,
  Unconstrained,
  Provable,
} from "o1js";
import { IndexedMerkleMap } from "./indexed-map";

class MetadataTransitionV2 extends Struct({
  oldRoot: Field,
  newRoot: Field,
}) {}

class MetadataUpdateV2 extends Struct({
  oldRoot: Field,
  newRoot: Field,
  key: Field,
  value: Field,
}) {}

/**
const MinaNFTMetadataUpdateV2 = ZkProgram({
  name: "MinaNFTMetadataUpdateV2",
  publicOutput: MetadataTransitionV2,

  methods: {
    insert: {
      //privateInputs: [MetadataUpdateV2, Unconstrained.provable],
      privateInputs: [MetadataUpdateV2, Unconstrained.provable],

      async method(
        update: MetadataUpdateV2,
        map: Unconstrained<IndexedMerkleMap>
      ) {
          const imap = map.get().proveInclusion(
          const oldRoot = imap.root;
          //imap.root.assertEquals(update.oldRoot);
          imap.insert(update.key, update.value);
          const newRoot = imap.root;
          //imap.root.assertEquals(update.newRoot);
        return new MetadataTransitionV2({
          oldRoot,
          newRoot,
        });
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      async method(
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

class MetadataTransition extends Struct({
  oldRoot: Field,
  newRoot: Metadata,
}) {
  static create(update: MetadataUpdate) {
    const [dataWitnessRootBefore, dataWitnessKey] =
      update.witness.data.computeRootAndKeyV2(update.oldValue.data);
    update.oldRoot.data.assertEquals(dataWitnessRootBefore);
    dataWitnessKey.assertEquals(update.key);
    const [kindWitnessRootBefore, kindWitnessKey] =
      update.witness.kind.computeRootAndKeyV2(update.oldValue.kind);
    update.oldRoot.kind.assertEquals(kindWitnessRootBefore);
    kindWitnessKey.assertEquals(update.key);

    const [dataWitnessRootAfter, _] = update.witness.data.computeRootAndKeyV2(
      update.newValue.data
    );
    update.newRoot.data.assertEquals(dataWitnessRootAfter);
    const [kindWitnessRootAfter, __] = update.witness.kind.computeRootAndKeyV2(
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
}

class MinaNFTMetadataUpdateProof extends ZkProgram.Proof(
  MinaNFTMetadataUpdate
) {}
*/
