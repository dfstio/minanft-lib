import { Field, MerkleWitness, ZkProgram, method, SmartContract } from "o1js";

function TreeCalculationFunction(height: number) {
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
  return TreeCalculation;
}

function TreeVerifierFunction(height: number) {
  const TreeCalculation = TreeCalculationFunction(height);
  class TreeProof extends ZkProgram.Proof(TreeCalculation) {}

  class TreeVerifier extends SmartContract {
    @method verifyRedactedTree(proof: TreeProof) {
      proof.verify();
    }
  }
  return TreeVerifier;
}

async function main() {
  const TreeCalculation = TreeCalculationFunction(4);
  const TreeVerifier = TreeVerifierFunction(4);
  await TreeCalculation.compile();
  await TreeVerifier.compile();
}

main();
