import { Field, MerkleWitness, ZkProgram, method, SmartContract } from "o1js";

export function TreeFunction(height: number) {
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
  return { TreeCalculation, TreeVerifier };
}
