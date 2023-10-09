import {
  Field,
  SelfProof,
  Experimental,
  Struct,
  MerkleWitness,
  Poseidon
} from 'o1js';

// TODO: make this a generic class returned by function
class MerkleWitness10 extends MerkleWitness(10) { }
class MerkleWitness20 extends MerkleWitness(20) { }
class MerkleWitness30 extends MerkleWitness(30) { }


class MinaNFTTreeState extends Struct({
  root: Field,
  initialHash: Field,
  latestHash: Field,
}) {

  static create(
    root: Field,
    initialHash: Field,
    latestHash: Field,
    index: Field,
    value: Field,
    merkleTreeWitness: MerkleWitness10
  ) {
    const witnessRoot = merkleTreeWitness.calculateRoot(value);
    const calculatedIndex = merkleTreeWitness.calculateIndex()
    witnessRoot.assertEquals(root);
    calculatedIndex.assertEquals(index);
    latestHash.assertEquals(Poseidon.hash([initialHash, index, value]));

    return new MinaNFTTreeState({
      root,
      initialHash,
      latestHash
    });
  }

  static merge(state1: MinaNFTTreeState, state2: MinaNFTTreeState) {
    state1.root.assertEquals(state2.root)
    state1.latestHash.assertEquals(state2.initialHash)
    return state2
  }

  static assertEquals(state1: MinaNFTTreeState, state2: MinaNFTTreeState) {
    state1.initialHash.assertEquals(state2.initialHash);
    state1.latestHash.assertEquals(state2.latestHash);
    state1.root.assertEquals(state2.root);
  }
}

const MinaNFTTree = Experimental.ZkProgram({
  publicInput: MinaNFTTreeState,
  publicOutput: Field,

  methods: {
    create: {
      privateInputs: [Field, Field, Field, Field, Field, MerkleWitness10],

      method(
        state: MinaNFTTreeState,
        root: Field,
        initialHash: Field,
        latestHash: Field,
        index: Field,
        value: Field,
        merkleTreeWitness: MerkleWitness10
      ): Field {
        const computedState = MinaNFTTreeState.create(
          root,
          initialHash,
          latestHash,
          index,
          value,
          merkleTreeWitness
        );
        MinaNFTTreeState.assertEquals(computedState, state);
        return latestHash
      }
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      method(
        newState: MinaNFTTreeState,
        proof1: SelfProof<MinaNFTTreeState, Field>,
        proof2: SelfProof<MinaNFTTreeState, Field>,
      ): Field {
        proof1.verify()
        proof2.verify()

        proof2.publicInput.root.assertEquals(proof1.publicInput.root)
        proof2.publicInput.initialHash.assertEquals(proof1.publicInput.latestHash)
        proof2.publicInput.latestHash.assertEquals(newState.latestHash)
        return newState.latestHash
      }
    }
  },
});

const MinaNFTTreeProofClass = Experimental.ZkProgram.Proof(MinaNFTTree);
class MinaNFTTreeProof extends MinaNFTTreeProofClass { }

export { MinaNFTTree, MinaNFTTreeProof, MinaNFTTreeState, MerkleWitness10, MerkleWitness20, MerkleWitness30 }