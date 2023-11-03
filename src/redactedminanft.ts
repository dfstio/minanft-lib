export { RedactedMinaNFT };
import { verify, Proof } from "o1js";
import { BaseMinaNFT } from "./baseminanft";
import { MinaNFT } from "./minanft";
import { Metadata, MetadataWitness } from "./contract/metadata";
import {
  RedactedMinaNFTMapCalculation,
  RedactedMinaNFTMapState,
  RedactedMinaNFTMapStateProof,
  MapElement,
} from "./plugins/redactedmap";

class RedactedMinaNFT extends BaseMinaNFT {
  nft: MinaNFT;

  constructor(nft: MinaNFT) {
    super();
    this.nft = nft;
  }

  /**
   * copy public attribute
   * @param key key of the attribute
   */
  public copyMetadata(key: string) {
    const value: Metadata | undefined = this.nft.getMetadata(key);
    if (value) this.metadata.set(key, value);
    else throw new Error("Map error");
  }

  /**
   *
   * @returns proof
   */
  public async proof(): Promise<RedactedMinaNFTMapStateProof> {
    await MinaNFT.compileRedactedMap();

    //console.log("Creating proof for redacted maps...");

    const { root, map } = this.getMetadataRootAndMap();
    const { root: originalRoot, map: originalMap } =
      this.nft.getMetadataRootAndMap();
    const elements: MapElement[] = [];
    let originalWitnesses: MetadataWitness[] = [];
    let redactedWitnesses: MetadataWitness[] = [];
    this.metadata.forEach((value: Metadata, key: string) => {
      const keyField = MinaNFT.stringToField(key);
      const redactedWitness = map.getWitness(keyField);
      const originalWitness = originalMap.getWitness(keyField);
      const element: MapElement = {
        originalRoot: originalRoot,
        redactedRoot: root,
        key: keyField,
        value,
      };
      elements.push(element);
      originalWitnesses.push(originalWitness);
      redactedWitnesses.push(redactedWitness);
    });

    let proofs: Proof<RedactedMinaNFTMapState, void>[] = [];
    for (let i = 0; i < elements.length; i++) {
      const state = RedactedMinaNFTMapState.create(
        elements[i],
        originalWitnesses[i],
        redactedWitnesses[i]
      );
      const proof = await RedactedMinaNFTMapCalculation.create(
        state,
        elements[i],
        originalWitnesses[i],
        redactedWitnesses[i]
      );
      proofs.push(proof);
    }
    originalWitnesses = [];
    redactedWitnesses = [];

    //console.log("Merging redacted proofs...");
    let proof: RedactedMinaNFTMapStateProof = proofs[0];
    for (let i = 1; i < proofs.length; i++) {
      const state = RedactedMinaNFTMapState.merge(
        proof.publicInput,
        proofs[i].publicInput
      );
      let mergedProof: RedactedMinaNFTMapStateProof | null =
        await RedactedMinaNFTMapCalculation.merge(state, proof, proofs[i]);
      proof = mergedProof;
      mergedProof = null;
    }
    proofs = [];

    if (MinaNFT.redactedMapVerificationKey === undefined) {
      throw new Error("Redacted map verification key is missing");
    }

    const verificationResult: boolean = await verify(
      proof.toJSON(),
      MinaNFT.redactedMapVerificationKey
    );

    //console.log("Proof verification result:", verificationResult);
    if (verificationResult === false) {
      throw new Error("Proof verification error");
    }

    return proof;
  }
}
