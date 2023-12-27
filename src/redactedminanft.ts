export { RedactedMinaNFT };
import {
  verify,
  Proof,
  PrivateKey,
  AccountUpdate,
  fetchAccount,
  Mina,
  Account,
} from "o1js";
import { BaseMinaNFT } from "./baseminanft";
import { PrivateMetadata } from "./privatemetadata";
import { MinaNFT } from "./minanft";
import { Metadata, MetadataWitness } from "./contract/metadata";
import {
  RedactedMinaNFTMapCalculation,
  RedactedMinaNFTMapState,
  RedactedMinaNFTMapStateProof,
  MapElement,
} from "./plugins/redactedmap";
import { MinaNFTVerifier } from "./plugins/verifier";

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
    const value: PrivateMetadata | undefined = this.nft.getMetadata(key);
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
    this.metadata.forEach((value: PrivateMetadata, key: string) => {
      const keyField = MinaNFT.stringToField(key);
      const redactedWitness = map.getWitness(keyField);
      const originalWitness = originalMap.getWitness(keyField);
      const element: MapElement = new MapElement({
        originalRoot: originalRoot,
        redactedRoot: root,
        key: keyField,
        value: new Metadata({ data: value.data, kind: value.kind }),
      });
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

  /**
   *
   * @returns proof
   */
  public async prepareProofData(): Promise<string[]> {
    const { root, map } = this.getMetadataRootAndMap();
    const { root: originalRoot, map: originalMap } =
      this.nft.getMetadataRootAndMap();
    const transactions: string[] = [];
    //const elements: MapElement[] = [];
    //let originalWitnesses: MetadataWitness[] = [];
    //let redactedWitnesses: MetadataWitness[] = [];
    this.metadata.forEach((value: PrivateMetadata, key: string) => {
      const keyField = MinaNFT.stringToField(key);
      const redactedWitness = map.getWitness(keyField);
      const originalWitness = originalMap.getWitness(keyField);
      const element: MapElement = new MapElement({
        originalRoot: originalRoot,
        redactedRoot: root,
        key: keyField,
        value: new Metadata({ data: value.data, kind: value.kind }),
      });
      transactions.push(
        JSON.stringify({
          el: element.toFields().map((f) => f.toJSON()),
          ow: originalWitness.toFields().map((f) => f.toJSON()),
          rw: redactedWitness.toFields().map((f) => f.toJSON()),
        })
      );
    });
    return transactions;
  }

  public static async deploy(
    deployer: PrivateKey,
    privateKey: PrivateKey,
    nonce?: number
  ): Promise<Mina.TransactionId | undefined> {
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = privateKey;
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    await MinaNFT.compileVerifier();
    console.log(
      `deploying the MinaNFTVerifierBadge contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });
    const deployNonce = nonce ?? Number(Account(sender).nonce.get().toBigint());
    const hasAccount = Mina.hasAccount(zkAppPublicKey);

    const zkApp = new MinaNFTVerifier(zkAppPublicKey);
    const transaction = await Mina.transaction(
      {
        sender,
        fee: await MinaNFT.fee(),
        memo: "minanft.io",
        nonce: deployNonce,
      },
      () => {
        if (!hasAccount) AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
        zkApp.account.tokenSymbol.set("VERIFY");
        zkApp.account.zkappUri.set("https://minanft.io/@verifier");
      }
    );
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "verifier deploy", false);
    if (tx.isSuccess) {
      return tx;
    } else return undefined;
  }
}
