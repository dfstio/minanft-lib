export { MinaNFTTreeVerifierFunction, TreeElement };

import {
  Field,
  SelfProof,
  ZkProgram,
  Struct,
  Poseidon,
  MerkleWitness,
  method,
  DeployArgs,
  Permissions,
  SmartContract,
} from "o1js";

class TreeElement extends Struct({
  originalRoot: Field,
  redactedRoot: Field,
  index: Field,
  value: Field,
}) {}

class BaseRedactedMinaNFTTreeState extends Struct({
  originalRoot: Field, // root of the original Tree
  redactedRoot: Field, // root of the Redacted Tree
  hash: Field, // hash of all the keys and values of the Redacted Tree
  count: Field, // number of keys in the Redacted Map
}) {}

function MinaNFTTreeVerifierFunction(height: number) {
  class MerkleTreeWitness extends MerkleWitness(height) {}

  class RedactedMinaNFTTreeState extends BaseRedactedMinaNFTTreeState {
    static create(
      element: TreeElement,
      originalWitness: MerkleTreeWitness,
      redactedWitness: MerkleTreeWitness
    ) {
      const originalWitnessRoot = originalWitness.calculateRoot(element.value);
      element.originalRoot.assertEquals(originalWitnessRoot);
      const calculatedOriginalIndex = originalWitness.calculateIndex();
      calculatedOriginalIndex.assertEquals(element.index);

      const redactedWitnessRoot = redactedWitness.calculateRoot(element.value);
      element.redactedRoot.assertEquals(redactedWitnessRoot);
      const calculatedRedactedIndex = redactedWitness.calculateIndex();
      calculatedRedactedIndex.assertEquals(element.index);

      return new RedactedMinaNFTTreeState({
        originalRoot: element.originalRoot,
        redactedRoot: element.redactedRoot,
        hash: Poseidon.hash([element.index, element.value]),
        count: Field(1),
      });
    }

    static merge(
      state1: RedactedMinaNFTTreeState,
      state2: RedactedMinaNFTTreeState
    ) {
      state1.originalRoot.assertEquals(state2.originalRoot);
      state1.redactedRoot.assertEquals(state2.redactedRoot);

      return new RedactedMinaNFTTreeState({
        originalRoot: state1.originalRoot,
        redactedRoot: state1.redactedRoot,
        hash: Poseidon.hash([state1.hash, state2.hash]),
        count: state1.count.add(state2.count),
      });
    }

    static assertEquals(
      state1: RedactedMinaNFTTreeState,
      state2: RedactedMinaNFTTreeState
    ) {
      state1.originalRoot.assertEquals(state2.originalRoot);
      state1.redactedRoot.assertEquals(state2.redactedRoot);
      state1.hash.assertEquals(state2.hash);
      state1.count.assertEquals(state2.count);
    }
  }

  const RedactedMinaNFTTreeCalculation = ZkProgram({
    name: "RedactedMinaNFTTreeCalculation_" + height.toString(),
    publicInput: RedactedMinaNFTTreeState,

    methods: {
      create: {
        privateInputs: [TreeElement, MerkleTreeWitness, MerkleTreeWitness],

        method(
          state: RedactedMinaNFTTreeState,
          element: TreeElement,
          originalWitness: MerkleTreeWitness,
          redactedWitness: MerkleTreeWitness
        ) {
          const computedState = RedactedMinaNFTTreeState.create(
            element,
            originalWitness,
            redactedWitness
          );
          RedactedMinaNFTTreeState.assertEquals(computedState, state);
        },
      },

      merge: {
        privateInputs: [SelfProof, SelfProof],

        method(
          newState: RedactedMinaNFTTreeState,
          proof1: SelfProof<RedactedMinaNFTTreeState, void>,
          proof2: SelfProof<RedactedMinaNFTTreeState, void>
        ) {
          proof1.verify();
          proof2.verify();
          const computedState = RedactedMinaNFTTreeState.merge(
            proof1.publicInput,
            proof2.publicInput
          );
          RedactedMinaNFTTreeState.assertEquals(computedState, newState);
        },
      },
    },
  });

  class RedactedMinaNFTTreeStateProof extends ZkProgram.Proof(
    RedactedMinaNFTTreeCalculation
  ) {}

  class MinaNFTTreeVerifier extends SmartContract {
    deploy(args: DeployArgs) {
      super.deploy(args);
      this.account.permissions.set({
        ...Permissions.default(),
        setDelegate: Permissions.proof(),
        incrementNonce: Permissions.proof(),
        setVotingFor: Permissions.proof(),
        setTiming: Permissions.proof(),
      });
    }

    @method verifyRedactedTree(proof: RedactedMinaNFTTreeStateProof) {
      proof.verify();
    }
  }
  return {
    RedactedMinaNFTTreeState,
    RedactedMinaNFTTreeCalculation,
    MinaNFTTreeVerifier,
    MerkleTreeWitness,
    RedactedMinaNFTTreeStateProof,
  };
}
