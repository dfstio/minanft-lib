import {
  Field,
  SelfProof,
  Experimental,
  Struct,
  MerkleMapWitness,
} from 'o1js';

class MapUpdate extends Struct ({
  initialRoot: Field,
  latestRoot: Field,
  key: Field,
  currentValue: Field,
  newValue: Field,
  witness: MerkleMapWitness
}) {}

class MinaNFTMapState extends Struct({
  initialRoot: Field,
  latestRoot: Field,
}) {

  static create( update: MapUpdate) {
    const [witnessRootBefore, witnessKey] = update.witness.computeRootAndKey(update.currentValue);
    update.initialRoot.assertEquals(witnessRootBefore);
    witnessKey.assertEquals(update.key);
    const [witnessRootAfter, _] = update.witness.computeRootAndKey(update.newValue);
    update.latestRoot.assertEquals(witnessRootAfter);

    return new MinaNFTMapState({
      initialRoot: update.initialRoot,
      latestRoot: update.latestRoot
    });
  }

  static merge(state1: MinaNFTMapState, state2: MinaNFTMapState) {
    return new MinaNFTMapState({
      initialRoot: state1.initialRoot,
      latestRoot: state2.latestRoot
    });
  }

  static assertEquals(state1: MinaNFTMapState, state2: MinaNFTMapState) {
    state1.initialRoot.assertEquals(state2.initialRoot);
    state1.latestRoot.assertEquals(state2.latestRoot);
  }
}

const MinaNFTMap = Experimental.ZkProgram({
  publicInput: MinaNFTMapState,

  methods: {
    create: {
      privateInputs: [MapUpdate],

      method(
        state: MinaNFTMapState,
        update: MapUpdate
      ) {
        const computedState = MinaNFTMapState.create( update )
        MinaNFTMapState.assertEquals(computedState, state);
      }
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      method(
        newState: MinaNFTMapState,
        proof1: SelfProof<MinaNFTMapState, void>,
        proof2: SelfProof<MinaNFTMapState, void>,
      ) {
        proof1.verify();
        proof2.verify();

        proof2.publicInput.initialRoot.assertEquals(proof1.publicInput.latestRoot);
        proof1.publicInput.initialRoot.assertEquals(newState.initialRoot);
        proof2.publicInput.latestRoot.assertEquals(newState.latestRoot);
      }
    }
  },
});

const MinaNFTMapProofClass = Experimental.ZkProgram.Proof(MinaNFTMap);
class MinaNFTMapProof extends MinaNFTMapProofClass { }

export { MinaNFTMap, MinaNFTMapProof, MinaNFTMapState, MapUpdate }