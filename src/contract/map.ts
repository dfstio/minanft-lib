import {
  Field,
  SelfProof,
  Experimental,
  Struct,
  MerkleMapWitness,
} from 'o1js';

class MinaNFTMapState extends Struct({
  initialRoot: Field,
  latestRoot: Field,
}) {

  static create(
    initialRoot: Field,
    latestRoot: Field,
    key: Field,
    currentValue: Field,
    newValue: Field,
    merkleMapWitness: MerkleMapWitness,
  ) {
    const [witnessRootBefore, witnessKey] = merkleMapWitness.computeRootAndKey(currentValue);
    initialRoot.assertEquals(witnessRootBefore);
    witnessKey.assertEquals(key);
    const [witnessRootAfter, _] = merkleMapWitness.computeRootAndKey(newValue);
    latestRoot.assertEquals(witnessRootAfter);

    return new MinaNFTMapState({
      initialRoot,
      latestRoot
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
      privateInputs: [Field, Field, Field, Field, Field, MerkleMapWitness],

      method(
        state: MinaNFTMapState,
        initialRoot: Field,
        latestRoot: Field,
        key: Field,
        currentValue: Field,
        newValue: Field,
        merkleMapWitness: MerkleMapWitness
      ) {
        const computedState = MinaNFTMapState.create(
          initialRoot,
          latestRoot,
          key,
          currentValue,
          newValue,
          merkleMapWitness
        );
        MinaNFTMapState.assertEquals(computedState, state);
      }
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      method(
        newState: MinaNFTMapState,
        rollup1proof: SelfProof<MinaNFTMapState, void>,
        rollup2proof: SelfProof<MinaNFTMapState, void>,
      ) {
        rollup1proof.verify();
        rollup2proof.verify();

        rollup2proof.publicInput.initialRoot.assertEquals(rollup1proof.publicInput.latestRoot);
        rollup1proof.publicInput.initialRoot.assertEquals(newState.initialRoot);
        rollup2proof.publicInput.latestRoot.assertEquals(newState.latestRoot);
      }
    }
  },
});

const MinaNFTMapProofClass = Experimental.ZkProgram.Proof(MinaNFTMap);
class MinaNFTMapProof extends MinaNFTMapProofClass { }

export { MinaNFTMap, MinaNFTMapProof, MinaNFTMapState }