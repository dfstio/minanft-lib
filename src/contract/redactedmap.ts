import {
  Field,
  SelfProof,
  Experimental,
  Struct,
  MerkleMapWitness,
  Poseidon,
} from "o1js";

class MapElement extends Struct({
  originalRoot: Field,
  redactedRoot: Field,
  key: Field,
  value: Field,
  originalWitness: MerkleMapWitness,
  redactedWitness: MerkleMapWitness,
}) {}

class RedactedMinaNFTMapState extends Struct({
  originalRoot: Field, // root of the original Map
  redactedRoot: Field, // root of the Redacted Map
  hash: Field, // hash of all the keys and values of the Redacted Map
  count: Field, // number of keys in the Redacted Map
}) {
  static create(element: MapElement) {
    const [originalWitnessRoot, originalWitnessKey] =
      element.originalWitness.computeRootAndKey(element.value);
    element.originalRoot.assertEquals(originalWitnessRoot);
    originalWitnessKey.assertEquals(element.key);

    const [redactedWitnessRoot, redactedWitnessKey] =
      element.redactedWitness.computeRootAndKey(element.value);
    element.redactedRoot.assertEquals(redactedWitnessRoot);
    redactedWitnessKey.assertEquals(element.key);

    return new RedactedMinaNFTMapState({
      originalRoot: element.originalRoot,
      redactedRoot: element.redactedRoot,
      hash: Poseidon.hash([element.key, element.value]),
      count: Field(0),
    });
  }

  static createEmpty(originalRoot: Field) {
    return new RedactedMinaNFTMapState({
      originalRoot: originalRoot,
      redactedRoot: Field(0),
      hash: Field(0),
      count: Field(0),
    });
  }

  static merge(
    state1: RedactedMinaNFTMapState,
    state2: RedactedMinaNFTMapState
  ) {
    state1.originalRoot.assertEquals(state2.originalRoot);
    state1.redactedRoot.assertEquals(state2.redactedRoot);

    return new RedactedMinaNFTMapState({
      originalRoot: state1.originalRoot,
      redactedRoot: state1.redactedRoot,
      hash: Poseidon.hash([state1.hash, state2.hash]),
      count: state1.count.add(state2.count),
    });
  }

  static assertEquals(
    state1: RedactedMinaNFTMapState,
    state2: RedactedMinaNFTMapState
  ) {
    state1.originalRoot.assertEquals(state2.originalRoot);
    state1.redactedRoot.assertEquals(state2.redactedRoot);
    state1.hash.assertEquals(state2.hash);
    state1.count.assertEquals(state2.count);
  }
}

class RedactedMinaNFTState extends Struct({
  publicAttributes: RedactedMinaNFTMapState,
  publicObjects: RedactedMinaNFTMapState,
  privateAttributes: RedactedMinaNFTMapState,
  privateObjects: RedactedMinaNFTMapState,
}) {
  static create(
    publicAttributes: RedactedMinaNFTMapState,
    publicObjects: RedactedMinaNFTMapState,
    privateAttributes: RedactedMinaNFTMapState,
    privateObjects: RedactedMinaNFTMapState
  ) {
    return new RedactedMinaNFTState({
      publicAttributes,
      publicObjects,
      privateAttributes,
      privateObjects,
    });
  }

  static assertEquals(
    state1: RedactedMinaNFTState,
    state2: RedactedMinaNFTState
  ) {
    RedactedMinaNFTMapState.assertEquals(
      state1.publicAttributes,
      state2.publicAttributes
    );
    RedactedMinaNFTMapState.assertEquals(
      state1.publicObjects,
      state2.publicObjects
    );
    RedactedMinaNFTMapState.assertEquals(
      state1.privateAttributes,
      state2.privateAttributes
    );
    RedactedMinaNFTMapState.assertEquals(
      state1.privateObjects,
      state2.privateObjects
    );
  }
}

const RedactedMinaNFTMapCalculation = Experimental.ZkProgram({
  publicInput: RedactedMinaNFTMapState,

  methods: {
    create: {
      privateInputs: [MapElement],

      method(state: RedactedMinaNFTMapState, element: MapElement) {
        const computedState = RedactedMinaNFTMapState.create(element);
        RedactedMinaNFTMapState.assertEquals(computedState, state);
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      method(
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

const RedactedMinaNFTMapStateProofClass = Experimental.ZkProgram.Proof(
  RedactedMinaNFTMapCalculation
);
class RedactedMinaNFTMapStateProof extends RedactedMinaNFTMapStateProofClass {}

const RedactedMinaNFTCalculation = Experimental.ZkProgram({
  publicInput: RedactedMinaNFTState,

  methods: {
    create: {
      privateInputs: [
        RedactedMinaNFTMapStateProof,
        RedactedMinaNFTMapStateProof,
        RedactedMinaNFTMapStateProof,
        RedactedMinaNFTMapStateProof,
      ],

      method(
        state: RedactedMinaNFTState,
        publicAttributesProof: RedactedMinaNFTMapStateProof,
        publicObjectsProof: RedactedMinaNFTMapStateProof,
        privateAttributesProof: RedactedMinaNFTMapStateProof,
        privateObjectsProof: RedactedMinaNFTMapStateProof
      ) {
        publicAttributesProof.verify();
        publicObjectsProof.verify();
        privateAttributesProof.verify();
        privateObjectsProof.verify();
        const computedState = RedactedMinaNFTState.create(
          publicAttributesProof.publicInput,
          publicObjectsProof.publicInput,
          privateAttributesProof.publicInput,
          privateObjectsProof.publicInput
        );
        RedactedMinaNFTState.assertEquals(computedState, state);
      },
    },
  },
});

const RedactedMinaNFTStateProofClass = Experimental.ZkProgram.Proof(
  RedactedMinaNFTCalculation
);
class RedactedMinaNFTStateProof extends RedactedMinaNFTStateProofClass {}

export {
  RedactedMinaNFTCalculation,
  RedactedMinaNFTMapCalculation,
  RedactedMinaNFTState,
  RedactedMinaNFTMapState,
  RedactedMinaNFTStateProof,
  RedactedMinaNFTMapStateProof,
  MapElement,
};
