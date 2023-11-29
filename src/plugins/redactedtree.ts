export {
  RedactedMinaNFTTreeCalculation,
  RedactedMinaNFTTreeState,
  RedactedMinaNFTTreeStateProof,
  TreeElement,
};
import {
  Field,
  SelfProof,
  ZkProgram,
  Struct,
  Poseidon,
  MerkleWitness,
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

function RedactedMinaNFTTreeState(height: number) {
  class MerkleTreeWitness extends MerkleWitness(height) {}

  class RedactedMinaNFTTreeState_ extends BaseRedactedMinaNFTTreeState {
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

      return new RedactedMinaNFTTreeState_({
        originalRoot: element.originalRoot,
        redactedRoot: element.redactedRoot,
        hash: Poseidon.hash([element.index, element.value]),
        count: Field(1),
      });
    }

    static merge(
      state1: RedactedMinaNFTTreeState_,
      state2: RedactedMinaNFTTreeState_
    ) {
      state1.originalRoot.assertEquals(state2.originalRoot);
      state1.redactedRoot.assertEquals(state2.redactedRoot);

      return new RedactedMinaNFTTreeState_({
        originalRoot: state1.originalRoot,
        redactedRoot: state1.redactedRoot,
        hash: Poseidon.hash([state1.hash, state2.hash]),
        count: state1.count.add(state2.count),
      });
    }

    static assertEquals(
      state1: RedactedMinaNFTTreeState_,
      state2: RedactedMinaNFTTreeState_
    ) {
      state1.originalRoot.assertEquals(state2.originalRoot);
      state1.redactedRoot.assertEquals(state2.redactedRoot);
      state1.hash.assertEquals(state2.hash);
      state1.count.assertEquals(state2.count);
    }
  }
  return RedactedMinaNFTTreeState_;
}

function RedactedMinaNFTTreeCalculation(height: number) {
  class MerkleTreeWitness extends MerkleWitness(height) {}
  class RedactedMinaNFTTreeState_ extends RedactedMinaNFTTreeState(height) {}

  const RedactedMinaNFTTreeCalculation_ = ZkProgram({
    name: "RedactedMinaNFTTreeCalculation_" + height.toString(),
    publicInput: RedactedMinaNFTTreeState_,

    methods: {
      create: {
        privateInputs: [TreeElement, MerkleTreeWitness, MerkleTreeWitness],

        method(
          state: RedactedMinaNFTTreeState_,
          element: TreeElement,
          originalWitness: MerkleTreeWitness,
          redactedWitness: MerkleTreeWitness
        ) {
          const computedState = RedactedMinaNFTTreeState_.create(
            element,
            originalWitness,
            redactedWitness
          );
          RedactedMinaNFTTreeState_.assertEquals(computedState, state);
        },
      },

      merge: {
        privateInputs: [SelfProof, SelfProof],

        method(
          newState: RedactedMinaNFTTreeState_,
          proof1: SelfProof<RedactedMinaNFTTreeState_, void>,
          proof2: SelfProof<RedactedMinaNFTTreeState_, void>
        ) {
          proof1.verify();
          proof2.verify();
          const computedState = RedactedMinaNFTTreeState_.merge(
            proof1.publicInput,
            proof2.publicInput
          );
          RedactedMinaNFTTreeState_.assertEquals(computedState, newState);
        },
      },
    },
  });
  return RedactedMinaNFTTreeCalculation_;
}

function RedactedMinaNFTTreeStateProof(height: number) {
  const RedactedMinaNFTTreeCalculation_ =
    RedactedMinaNFTTreeCalculation(height);
  class RedactedMinaNFTTreeStateProof_ extends ZkProgram.Proof(
    RedactedMinaNFTTreeCalculation_
  ) {}
  return RedactedMinaNFTTreeStateProof_;
}
