export {
  RedactedMinaNFTMapCalculation,
  RedactedMinaNFTMapState,
  RedactedMinaNFTMapStateProof,
  MapElement,
};
import { Field, SelfProof, ZkProgram, Struct, Poseidon } from "o1js";
import { Metadata, MetadataWitness } from "../contract/metadata";

class MapElement extends Struct({
  originalRoot: Metadata,
  redactedRoot: Metadata,
  key: Field,
  value: Metadata,
}) {}

class RedactedMinaNFTMapState extends Struct({
  originalRoot: Metadata, // root of the original Map
  redactedRoot: Metadata, // root of the Redacted Map
  hash: Field, // hash of all the keys and values of the Redacted Map
  count: Field, // number of keys in the Redacted Map
}) {
  static create(
    element: MapElement,
    originalWitness: MetadataWitness,
    redactedWitness: MetadataWitness
  ) {
    // TODO: remove comments from key validation after https://github.com/o1-labs/o1js/issues/1552
    const [originalDataWitnessRoot, originalDataWitnessKey] =
      originalWitness.data.computeRootAndKey(element.value.data);
    element.originalRoot.data.assertEquals(originalDataWitnessRoot);
    //originalDataWitnessKey.assertEquals(element.key);

    const [originalKindWitnessRoot, originalKindWitnessKey] =
      originalWitness.kind.computeRootAndKey(element.value.kind);
    element.originalRoot.kind.assertEquals(originalKindWitnessRoot);
    //originalKindWitnessKey.assertEquals(element.key);

    const [redactedDataWitnessRoot, redactedDataWitnessKey] =
      redactedWitness.data.computeRootAndKey(element.value.data);
    element.redactedRoot.data.assertEquals(redactedDataWitnessRoot);
    //redactedDataWitnessKey.assertEquals(element.key);

    const [redactedKindWitnessRoot, redactedKindWitnessKey] =
      redactedWitness.kind.computeRootAndKey(element.value.kind);
    element.redactedRoot.kind.assertEquals(redactedKindWitnessRoot);
    //redactedKindWitnessKey.assertEquals(element.key);

    return new RedactedMinaNFTMapState({
      originalRoot: element.originalRoot,
      redactedRoot: element.redactedRoot,
      hash: Poseidon.hash([
        element.key,
        element.value.data,
        element.value.kind,
      ]),
      count: Field(1),
    });
  }

  static merge(
    state1: RedactedMinaNFTMapState,
    state2: RedactedMinaNFTMapState
  ) {
    Metadata.assertEquals(state1.originalRoot, state2.originalRoot);
    Metadata.assertEquals(state1.redactedRoot, state2.redactedRoot);

    return new RedactedMinaNFTMapState({
      originalRoot: state1.originalRoot,
      redactedRoot: state1.redactedRoot,
      hash: state1.hash.add(state2.hash),
      count: state1.count.add(state2.count),
    });
  }

  static assertEquals(
    state1: RedactedMinaNFTMapState,
    state2: RedactedMinaNFTMapState
  ) {
    Metadata.assertEquals(state1.originalRoot, state2.originalRoot);
    Metadata.assertEquals(state1.redactedRoot, state2.redactedRoot);
    state1.hash.assertEquals(state2.hash);
    state1.count.assertEquals(state2.count);
  }
}

const RedactedMinaNFTMapCalculation = ZkProgram({
  name: "RedactedMinaNFTMapCalculation",
  publicInput: RedactedMinaNFTMapState,

  methods: {
    create: {
      privateInputs: [MapElement, MetadataWitness, MetadataWitness],

      async method(
        state: RedactedMinaNFTMapState,
        element: MapElement,
        originalWitness: MetadataWitness,
        redactedWitness: MetadataWitness
      ) {
        const computedState = RedactedMinaNFTMapState.create(
          element,
          originalWitness,
          redactedWitness
        );
        RedactedMinaNFTMapState.assertEquals(computedState, state);
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      async method(
        newState: RedactedMinaNFTMapState,
        proof1: SelfProof<RedactedMinaNFTMapState, void>,
        proof2: SelfProof<RedactedMinaNFTMapState, void>
      ) {
        proof1.verify();
        proof2.verify();
        const computedState = RedactedMinaNFTMapState.merge(
          proof1.publicInput,
          proof2.publicInput
        );
        RedactedMinaNFTMapState.assertEquals(computedState, newState);
      },
    },
  },
});

class RedactedMinaNFTMapStateProof extends ZkProgram.Proof(
  RedactedMinaNFTMapCalculation
) {}
