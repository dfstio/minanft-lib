export { RedactedTree };
import {
  verify,
  PrivateKey,
  AccountUpdate,
  Mina,
  Account,
  MerkleTree,
  Field,
  VerificationKey,
} from "o1js";
import { MinaNFT } from "./minanft";
import {
  MinaNFTTreeVerifierFunction,
  TreeElement,
} from "./plugins/redactedtree";
import { Memory, sleep } from "./mina";
import { fetchMinaAccount } from "./fetch";

class RedactedTree {
  height: number;
  originalTree: MerkleTree;
  redactedTree: MerkleTree;
  leafs: { key: number; value: Field }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contracts: any;
  /*
      RedactedMinaNFTTreeState,
      RedactedMinaNFTTreeCalculation,
      MinaNFTTreeVerifier,
      MerkleTreeWitness,
      RedactedMinaNFTTreeStateProof,
  */
  verificationKey: VerificationKey | undefined = undefined;

  constructor(height: number, originalTree: MerkleTree) {
    this.height = height;
    this.originalTree = originalTree;
    this.redactedTree = new MerkleTree(height);
    this.contracts = MinaNFTTreeVerifierFunction(height);
  }

  /**
   * copy public attribute
   * @param key key of the attribute
   */
  public set(key: number, value: Field): void {
    this.redactedTree.setLeaf(BigInt(key), value);
    this.leafs.push({ key, value });
  }

  public async compile(): Promise<VerificationKey> {
    if (this.verificationKey !== undefined) return this.verificationKey;
    console.time(`compiled RedactedTreeCalculation`);
    await sleep(100); // alow GC to run
    const verificationKey = (
      await this.contracts.RedactedMinaNFTTreeCalculation.compile()
    ).verificationKey;
    console.timeEnd(`compiled RedactedTreeCalculation`);
    this.verificationKey = verificationKey;
    return verificationKey;
  }

  /**
   *
   * @returns proof
   */
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  public async proof(verbose: boolean = false) {
    class TreeStateProof extends this.contracts.RedactedMinaNFTTreeStateProof {}
    const verificationKey = await this.compile();
    console.time(`calculated proofs`);
    console.log(`calculating ${this.leafs.length} proofs...`);
    const originalRoot = this.originalTree.getRoot();
    const redactedRoot = this.redactedTree.getRoot();
    const proofs: TreeStateProof[] = [];
    for (let i = 0; i < this.leafs.length; i++) {
      await sleep(100); // alow GC to run
      const originalWitness = new this.contracts.MerkleTreeWitness(
        this.originalTree.getWitness(BigInt(this.leafs[i].key))
      );
      const redactedWitness = new this.contracts.MerkleTreeWitness(
        this.redactedTree.getWitness(BigInt(this.leafs[i].key))
      );
      const element = new TreeElement({
        originalRoot,
        redactedRoot,
        index: Field(this.leafs[i].key),
        value: this.leafs[i].value,
      });
      const state = this.contracts.RedactedMinaNFTTreeState.create(
        element,
        originalWitness,
        redactedWitness
      );
      const proof = await this.contracts.RedactedMinaNFTTreeCalculation.create(
        state,
        element,
        originalWitness,
        redactedWitness
      );
      proofs.push(proof);
      if (verbose) Memory.info(`proof ${i} calculated`);
    }
    console.timeEnd(`calculated proofs`);
    Memory.info(`calculated proofs`);

    console.time(`merged proofs`);
    let proof: TreeStateProof = proofs[0];
    for (let i = 1; i < proofs.length; i++) {
      await sleep(100); // alow GC to run
      const state = this.contracts.RedactedMinaNFTTreeState.merge(
        proof.publicInput,
        proofs[i].publicInput
      );
      const mergedProof =
        await this.contracts.RedactedMinaNFTTreeCalculation.merge(
          state,
          proof,
          proofs[i]
        );
      proof = mergedProof;
      if (verbose) Memory.info(`proof ${i} merged`);
    }
    console.timeEnd(`merged proofs`);
    Memory.info(`merged proofs`);
    const ok = verify(proof, verificationKey);
    if (!ok) {
      throw new Error("proof verification failed");
    }
    return proof;
  }

  public async deploy(
    deployer: PrivateKey,
    privateKey: PrivateKey,
    nonce?: number
  ): Promise<Mina.PendingTransaction | undefined> {
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = privateKey;
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    await this.contracts.MinaNFTTreeVerifier.compile();
    console.log(
      `deploying the MinaNFTTreeVerifier contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchMinaAccount({ publicKey: sender });
    await fetchMinaAccount({ publicKey: zkAppPublicKey });
    const deployNonce =
      nonce ?? Number(Mina.getAccount(sender).nonce.toBigint());
    const hasAccount = Mina.hasAccount(zkAppPublicKey);

    const zkApp = new this.contracts.MinaNFTTreeVerifier(zkAppPublicKey);
    const transaction = await Mina.transaction(
      {
        sender,
        fee: await MinaNFT.fee(),
        memo: "minanft.io",
        nonce: deployNonce,
      },
      async () => {
        if (!hasAccount) AccountUpdate.fundNewAccount(sender);
        await zkApp.deploy({});
        zkApp.account.tokenSymbol.set("VERIFY");
        zkApp.account.zkappUri.set("https://minanft.io/@treeverifier");
      }
    );
    transaction.sign([deployer, zkAppPrivateKey]);
    const tx = await transaction.send();
    await MinaNFT.transactionInfo(tx, "verifier deploy", false);
    if (tx.status === "pending") {
      return tx;
    } else return undefined;
  }
}
