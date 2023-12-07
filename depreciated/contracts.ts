import type {
  Field,
  MerkleWitness,
  ZkProgram,
  method,
  SmartContract,
} from "o1js";
import type * as O1js from "o1js";

export async function TreeFunction(height: number, o1js: O1js) {
  const { Field, MerkleWitness, ZkProgram, method, SmartContract } = o1js;

  class MerkleTreeWitness extends MerkleWitness(height) {}
  const TreeCalculation = ZkProgram({
    name: "TreeCalculation",
    publicInput: Field,

    methods: {
      check: {
        privateInputs: [MerkleTreeWitness, Field],

        method(root: Field, witness: MerkleTreeWitness, value: Field) {
          const calculatedRoot = witness.calculateRoot(value);
          root.assertEquals(calculatedRoot);
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
