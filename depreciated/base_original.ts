/*
import {
  Field,
  MerkleMapWitness,
  SmartContract,
  method,
  DeployArgs,
} from 'o1js';

import { MinaNFTTreeProof, MerkleWitness10 } from './tree';
import { MinaNFTMapProof } from './map';

class BaseMinaNFTContract extends SmartContract {
  deploy(args: DeployArgs) {
    super.deploy(args);
  }

  @method verifyMapWitness(state: Field, key: Field, value: Field, merkleMapWitness: MerkleMapWitness) {
    const [witnessRoot, witnessKey] = merkleMapWitness.computeRootAndKey(value)
    witnessRoot.assertEquals(state)
    witnessKey.assertEquals(key)
  }

  @method verifyMapProof(state: Field, minaNFTStateProof: MinaNFTMapProof) {
    minaNFTStateProof.publicInput.initialRoot.assertEquals(state)
    minaNFTStateProof.verify()
  }

  @method verifyTreeWitness(state: Field, index: Field, value: Field, merkleTreeWitness: MerkleWitness10) {
    const witnessRoot = merkleTreeWitness.calculateRoot(value)
    const calculatedIndex = merkleTreeWitness.calculateIndex()
    witnessRoot.assertEquals(state)
    calculatedIndex.assertEquals(index)
  }

  @method verifyTreeProof(state: Field, minaNFTTreeProof: MinaNFTTreeProof) {
    minaNFTTreeProof.publicInput.root.assertEquals(state);
    minaNFTTreeProof.verify();
  }
}

export { BaseMinaNFTContract }
*/