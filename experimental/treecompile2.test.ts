import { describe, expect, it } from "@jest/globals";
import { Field, MerkleWitness, ZkProgram, method, SmartContract } from "o1js";

function TreeFunction(height: number) {
  class MerkleTreeWitness extends MerkleWitness(height) {}
  const TreeCalculation = ZkProgram({
    name: "TreeCalculation",
    publicInput: Field,

    methods: {
      check: {
        privateInputs: [MerkleTreeWitness, Field],

        method(root: Field, witness: MerkleTreeWitness, value: Field) {
          const calculatedRoot = witness.calculateRoot(value);
          calculatedRoot.assertEquals(root);
        },
      },
    },
  });

  class TreeProof extends ZkProgram.Proof(TreeCalculation) {}

  class TreeVerifier extends SmartContract {
    @method verifyRedactedTree(proof: TreeProof) {
      proof.verify();
    }
  }
  return { calculation: TreeCalculation, verifier: TreeVerifier };
}

const height = 5;
const { calculation: TreeCalculation, verifier: TreeVerifier } =
  TreeFunction(height);

describe(`Merkle Tree contract`, () => {
  it(`should compile contracts`, async () => {
    await TreeCalculation.compile();
    await TreeVerifier.compile();
  });
});
