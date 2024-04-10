export {
  MerkleTreeWitness20,
  RedactedMinaNFTTreeState20,
  RedactedMinaNFTTreeCalculation20,
  RedactedMinaNFTTreeStateProof20,
  MinaNFTTreeVerifier20,
};

import { TreeElement, BaseRedactedMinaNFTTreeState } from "./redactedtree";
import {
  Field,
  SelfProof,
  ZkProgram,
  Poseidon,
  MerkleWitness,
  method,
  DeployArgs,
  Permissions,
  SmartContract,
} from "o1js";

class MerkleTreeWitness20 extends MerkleWitness(20) {}

class RedactedMinaNFTTreeState20 extends BaseRedactedMinaNFTTreeState {
  static create(
    element: TreeElement,
    originalWitness: MerkleTreeWitness20,
    redactedWitness: MerkleTreeWitness20
  ) {
    const originalWitnessRoot = originalWitness.calculateRoot(element.value);
    element.originalRoot.assertEquals(originalWitnessRoot);
    const calculatedOriginalIndex = originalWitness.calculateIndex();
    calculatedOriginalIndex.assertEquals(element.index);

    const redactedWitnessRoot = redactedWitness.calculateRoot(element.value);
    element.redactedRoot.assertEquals(redactedWitnessRoot);
    const calculatedRedactedIndex = redactedWitness.calculateIndex();
    calculatedRedactedIndex.assertEquals(element.index);

    return new RedactedMinaNFTTreeState20({
      originalRoot: element.originalRoot,
      redactedRoot: element.redactedRoot,
      hash: Poseidon.hash([element.index, element.value]),
      count: Field(1),
    });
  }

  static merge(
    state1: RedactedMinaNFTTreeState20,
    state2: RedactedMinaNFTTreeState20
  ) {
    state1.originalRoot.assertEquals(state2.originalRoot);
    state1.redactedRoot.assertEquals(state2.redactedRoot);

    return new RedactedMinaNFTTreeState20({
      originalRoot: state1.originalRoot,
      redactedRoot: state1.redactedRoot,
      hash: state1.hash.add(state2.hash),
      count: state1.count.add(state2.count),
    });
  }

  static assertEquals(
    state1: RedactedMinaNFTTreeState20,
    state2: RedactedMinaNFTTreeState20
  ) {
    state1.originalRoot.assertEquals(state2.originalRoot);
    state1.redactedRoot.assertEquals(state2.redactedRoot);
    state1.hash.assertEquals(state2.hash);
    state1.count.assertEquals(state2.count);
  }
}

const RedactedMinaNFTTreeCalculation20 = ZkProgram({
  name: "RedactedMinaNFTTreeCalculation20",
  publicInput: RedactedMinaNFTTreeState20,

  methods: {
    create: {
      privateInputs: [TreeElement, MerkleTreeWitness20, MerkleTreeWitness20],

      async method(
        state: RedactedMinaNFTTreeState20,
        element: TreeElement,
        originalWitness: MerkleTreeWitness20,
        redactedWitness: MerkleTreeWitness20
      ) {
        const computedState = RedactedMinaNFTTreeState20.create(
          element,
          originalWitness,
          redactedWitness
        );
        RedactedMinaNFTTreeState20.assertEquals(computedState, state);
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      async method(
        newState: RedactedMinaNFTTreeState20,
        proof1: SelfProof<RedactedMinaNFTTreeState20, void>,
        proof2: SelfProof<RedactedMinaNFTTreeState20, void>
      ) {
        proof1.verify();
        proof2.verify();
        const computedState = RedactedMinaNFTTreeState20.merge(
          proof1.publicInput,
          proof2.publicInput
        );
        RedactedMinaNFTTreeState20.assertEquals(computedState, newState);
      },
    },
  },
});

class RedactedMinaNFTTreeStateProof20 extends ZkProgram.Proof(
  RedactedMinaNFTTreeCalculation20
) {}

class MinaNFTTreeVerifier20 extends SmartContract {
  async deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
  }

  @method async verifyRedactedTree(proof: RedactedMinaNFTTreeStateProof20) {
    proof.verify();
  }
}
