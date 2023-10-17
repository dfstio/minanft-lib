import { Field, SelfProof, Experimental, Struct, MerkleMapWitness } from "o1js";

class MapUpdate extends Struct({
  initialRoot: Field,
  latestRoot: Field,
  key: Field,
  currentValue: Field,
  newValue: Field,
  witness: MerkleMapWitness,
}) {}

class MinaNFTMapState extends Struct({
  initialRoot: Field,
  latestRoot: Field,
}) {
  static create(update: MapUpdate) {
    const [witnessRootBefore, witnessKey] = update.witness.computeRootAndKey(
      update.currentValue
    );
    update.initialRoot.assertEquals(witnessRootBefore);
    witnessKey.assertEquals(update.key);
    const [witnessRootAfter, _] = update.witness.computeRootAndKey(
      update.newValue
    );
    update.latestRoot.assertEquals(witnessRootAfter);

    return new MinaNFTMapState({
      initialRoot: update.initialRoot,
      latestRoot: update.latestRoot,
    });
  }

  static merge(state1: MinaNFTMapState, state2: MinaNFTMapState) {
    return new MinaNFTMapState({
      initialRoot: state1.initialRoot,
      latestRoot: state2.latestRoot,
    });
  }

  static assertEquals(state1: MinaNFTMapState, state2: MinaNFTMapState) {
    state1.initialRoot.assertEquals(state2.initialRoot);
    state1.latestRoot.assertEquals(state2.latestRoot);
  }
}

class MinaNFTState extends Struct({
  publicAttributes: MinaNFTMapState,
  publicObjects: MinaNFTMapState,
  privateAttributes: MinaNFTMapState,
  privateObjects: MinaNFTMapState,
}) {
  static updatePublicAttributes(
    update: MapUpdate,
    publicObjectsRoot: Field,
    privateAttributesRoot: Field,
    privateObjectsRoot: Field
  ) {
    return new MinaNFTState({
      publicAttributes: MinaNFTMapState.create(update),
      publicObjects: new MinaNFTMapState({
        initialRoot: publicObjectsRoot,
        latestRoot: publicObjectsRoot,
      }),
      privateAttributes: new MinaNFTMapState({
        initialRoot: privateAttributesRoot,
        latestRoot: privateAttributesRoot,
      }),
      privateObjects: new MinaNFTMapState({
        initialRoot: privateObjectsRoot,
        latestRoot: privateObjectsRoot,
      }),
    });
  }

  static updatePrivateAttributes(
    publicAttributesRoot: Field,
    publicObjectsRoot: Field,
    update: MapUpdate,
    privateObjectsRoot: Field
  ) {
    return new MinaNFTState({
      publicAttributes: new MinaNFTMapState({
        initialRoot: publicAttributesRoot,
        latestRoot: publicAttributesRoot,
      }),
      publicObjects: new MinaNFTMapState({
        initialRoot: publicObjectsRoot,
        latestRoot: publicObjectsRoot,
      }),
      privateAttributes: MinaNFTMapState.create(update),
      privateObjects: new MinaNFTMapState({
        initialRoot: privateObjectsRoot,
        latestRoot: privateObjectsRoot,
      }),
    });
  }

  static merge(state1: MinaNFTState, state2: MinaNFTState) {
    return new MinaNFTState({
      publicAttributes: MinaNFTMapState.merge(
        state1.publicAttributes,
        state2.publicAttributes
      ),
      publicObjects: MinaNFTMapState.merge(
        state1.publicObjects,
        state2.publicObjects
      ),
      privateAttributes: MinaNFTMapState.merge(
        state1.privateAttributes,
        state2.privateAttributes
      ),
      privateObjects: MinaNFTMapState.merge(
        state1.privateObjects,
        state2.privateObjects
      ),
    });
  }

  static assertEquals(state1: MinaNFTState, state2: MinaNFTState) {
    MinaNFTMapState.assertEquals(
      state1.publicAttributes,
      state2.publicAttributes
    );
    MinaNFTMapState.assertEquals(state1.publicObjects, state2.publicObjects);
    MinaNFTMapState.assertEquals(
      state1.privateAttributes,
      state2.privateAttributes
    );
    MinaNFTMapState.assertEquals(state1.privateObjects, state2.privateObjects);
  }
}

const MinaNFTUpdate = Experimental.ZkProgram({
  publicInput: MinaNFTState,

  methods: {
    updatePublicAttributes: {
      privateInputs: [MapUpdate, Field, Field, Field],

      method(
        state: MinaNFTState,
        update: MapUpdate,
        publicObjectsRoot: Field,
        privateAttributesRoot: Field,
        privateObjectsRoot: Field
      ) {
        const computedState = MinaNFTState.updatePublicAttributes(
          update,
          publicObjectsRoot,
          privateAttributesRoot,
          privateObjectsRoot
        );
        MinaNFTState.assertEquals(computedState, state);
      },
    },

    updatePrivateAttributes: {
      privateInputs: [Field, Field, MapUpdate, Field],

      method(
        state: MinaNFTState,
        publicAttributesRoot: Field,
        publicObjectsRoot: Field,
        update: MapUpdate,
        privateObjectsRoot: Field
      ) {
        const computedState = MinaNFTState.updatePrivateAttributes(
          publicAttributesRoot,
          publicObjectsRoot,
          update,
          privateObjectsRoot
        );
        MinaNFTState.assertEquals(computedState, state);
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      method(
        newState: MinaNFTState,
        proof1: SelfProof<MinaNFTState, void>,
        proof2: SelfProof<MinaNFTState, void>
      ) {
        proof1.verify();
        proof2.verify();

        proof1.publicInput.publicAttributes.latestRoot.assertEquals(
          proof2.publicInput.publicAttributes.initialRoot
        );
        proof1.publicInput.publicObjects.latestRoot.assertEquals(
          proof2.publicInput.publicObjects.initialRoot
        );
        proof1.publicInput.privateAttributes.latestRoot.assertEquals(
          proof2.publicInput.privateAttributes.initialRoot
        );
        proof1.publicInput.privateObjects.latestRoot.assertEquals(
          proof2.publicInput.privateObjects.initialRoot
        );

        proof1.publicInput.publicAttributes.initialRoot.assertEquals(
          newState.publicAttributes.initialRoot
        );
        proof1.publicInput.publicObjects.initialRoot.assertEquals(
          newState.publicObjects.initialRoot
        );
        proof1.publicInput.privateAttributes.initialRoot.assertEquals(
          newState.privateAttributes.initialRoot
        );
        proof1.publicInput.privateObjects.initialRoot.assertEquals(
          newState.privateObjects.initialRoot
        );

        proof2.publicInput.publicAttributes.latestRoot.assertEquals(
          newState.publicAttributes.latestRoot
        );
        proof2.publicInput.publicObjects.latestRoot.assertEquals(
          newState.publicObjects.latestRoot
        );
        proof2.publicInput.privateAttributes.latestRoot.assertEquals(
          newState.privateAttributes.latestRoot
        );
        proof2.publicInput.privateObjects.latestRoot.assertEquals(
          newState.privateObjects.latestRoot
        );
      },
    },
  },
});

const MinaNFTStateProofClass = Experimental.ZkProgram.Proof(MinaNFTUpdate);
class MinaNFTStateProof extends MinaNFTStateProofClass {}

export {
  MinaNFTUpdate,
  MinaNFTState,
  MinaNFTStateProof,
  MapUpdate,
  MinaNFTMapState,
};
