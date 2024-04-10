/* eslint-disable @typescript-eslint/no-inferrable-types */
import { describe, expect, it } from "@jest/globals";
import {
  Mina,
  fetchAccount,
  AccountUpdate,
  PrivateKey,
  PublicKey,
  verify,
  Field,
  MerkleTree,
  JsonProof,
  VerificationKey,
} from "o1js";

import { MinaNFT } from "../src/minanft";
import { blockchain, initBlockchain } from "../utils/testhelpers";
import {
  MinaNFTTreeVerifierFunction,
  TreeElement,
} from "../src/plugins/redactedtree";
import { Memory } from "../src/mina";

const blockchainInstance: blockchain = "local";
const height = 16;
const maxElements = 10;
const minMaskLength = 5;

const {
  RedactedMinaNFTTreeState,
  RedactedMinaNFTTreeCalculation,
  MinaNFTTreeVerifier,
  MerkleTreeWitness,
  RedactedMinaNFTTreeStateProof,
} = MinaNFTTreeVerifierFunction(height);

class TreeStateProof extends RedactedMinaNFTTreeStateProof {}
const tree = new MerkleTree(height);
const redactedTree = new MerkleTree(height);
const leaves: Field[] = [];
const mask: boolean[] = [];
let maskLength: number = 0;
const size = 2 ** (height - 1);
//const proofs: TreeStateProof[] = [];
//let proof: TreeStateProof | undefined = undefined;
const proofs: string[] = [];
let mergedProof: string = "";
let verificationKey: VerificationKey | undefined = undefined;
let tx: Mina.PendingTransaction | undefined = undefined;
let verifier: PublicKey | undefined = undefined;

let deployer: PrivateKey | undefined = undefined;

beforeAll(async () => {
  const data = await initBlockchain(blockchainInstance, 0);
  expect(data).toBeDefined();
  if (data === undefined) return;

  const { deployer: d } = data;
  deployer = d;
  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
});

describe(`MinaNFT Redacted Merkle Tree calculations`, () => {
  it(`should compile contracts`, async () => {
    console.log(`Compiling...`);
    console.time(`compiled all`);

    console.time(`compiled RedactedTreeCalculation`);
    verificationKey = (await RedactedMinaNFTTreeCalculation.compile())
      .verificationKey;
    console.timeEnd(`compiled RedactedTreeCalculation`);

    console.time(`compiled TreeVerifier`);
    await MinaNFTTreeVerifier.compile();
    console.timeEnd(`compiled TreeVerifier`);

    console.timeEnd(`compiled all`);
    Memory.info(`compiled`);
  });

  it(`should deploy TreeVerifier`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    console.time(`deployed MinaNFTTreeVerifier`);
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log(
      `deploying the MinaNFTTreeVerifier contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new MinaNFTTreeVerifier(zkAppPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee() },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkApp.deploy({});
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppPrivateKey]);

    //console.log("Sending the deploy transaction...");
    tx = await transaction.send();
    console.timeEnd(`deployed MinaNFTTreeVerifier`);
    await MinaNFT.transactionInfo(tx, "deployed MinaNFTTreeVerifier", false);
    verifier = zkAppPublicKey;
    Memory.info(`deployed`);
  });

  it(`should prepare data`, async () => {
    expect(maxElements).toBeGreaterThan(minMaskLength);
    if (maxElements <= minMaskLength) return;
    expect(size).toBeGreaterThan(minMaskLength);
    if (size <= minMaskLength) return;
    const count = size > maxElements ? maxElements : size;
    expect(count).toBeGreaterThan(minMaskLength);
    if (count <= minMaskLength) return;
    console.log(`Generating ${count} elements...`);
    for (let i = 0; i < count; i++) {
      const value = Field.random();
      leaves.push(value);
      tree.setLeaf(BigInt(i), value);
      const use: boolean = Math.random() > 0.5;
      if (use && maskLength < minMaskLength) {
        mask.push(true);
        maskLength++;
        redactedTree.setLeaf(BigInt(i), value);
      } else {
        mask.push(false);
      }
    }
    let iterations = 0;
    while (maskLength < minMaskLength) {
      const index = Math.floor(Math.random() * (count - 1));
      if (mask[index] === false) {
        mask[index] = true;
        redactedTree.setLeaf(BigInt(index), leaves[index]);
        maskLength++;
      }
      iterations++;
      expect(iterations).toBeLessThan(minMaskLength * 100);
    }
    Memory.info(`prepared`);
    console.log(`maskLength: ${maskLength}`);
    expect(maskLength).toBeGreaterThan(0);
  });

  it(`should calculate proofs`, async () => {
    expect(maskLength).toBeGreaterThan(0);
    if (maskLength === 0) return;
    console.time(`calculated proofs`);
    const originalRoot = tree.getRoot();
    const redactedRoot = redactedTree.getRoot();
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) {
        const originalWitness = new MerkleTreeWitness(
          tree.getWitness(BigInt(i))
        );
        const redactedWitness = new MerkleTreeWitness(
          redactedTree.getWitness(BigInt(i))
        );
        const element = new TreeElement({
          originalRoot,
          redactedRoot,
          index: Field(i),
          value: leaves[i],
        });
        const state = RedactedMinaNFTTreeState.create(
          element,
          originalWitness,
          redactedWitness
        );
        const proof = await RedactedMinaNFTTreeCalculation.create(
          state,
          element,
          originalWitness,
          redactedWitness
        );
        proofs.push(JSON.stringify(proof.toJSON(), null, 2));
        Memory.info(`calculated proof ${i}`);
      }
    }
    console.timeEnd(`calculated proofs`);
  });

  it(`should merge proofs`, async () => {
    expect(proofs.length).toBeGreaterThan(1);
    if (proofs.length === 0) return;
    console.time(`merged proofs`);
    let proof: string = proofs[0];
    for (let i = 1; i < proofs.length; i++) {
      const proof1: TreeStateProof = TreeStateProof.fromJSON(
        JSON.parse(proof) as JsonProof
      );
      const proof2: TreeStateProof = TreeStateProof.fromJSON(
        JSON.parse(proofs[i]) as JsonProof
      );
      const state = RedactedMinaNFTTreeState.merge(
        proof1.publicInput,
        proof2.publicInput
      );
      const mergedProof = await RedactedMinaNFTTreeCalculation.merge(
        state,
        proof1,
        proof2
      );
      proof = JSON.stringify(mergedProof.toJSON(), null, 2);
      Memory.info(`merged proof ${i}`);
    }
    console.timeEnd(`merged proofs`);
    mergedProof = proof;
  });

  it(`should verify merged proof`, async () => {
    const proof: TreeStateProof = TreeStateProof.fromJSON(
      JSON.parse(mergedProof) as JsonProof
    );
    expect(proof).toBeDefined();
    if (proof === undefined) return;
    expect(verificationKey).toBeDefined();
    if (verificationKey === undefined) return;
    console.time("Proof verified");
    const verificationResult: boolean = await verify(
      proof.toJSON(),
      verificationKey
    );
    expect(verificationResult).toBe(true);
    console.timeEnd("Proof verified");
  });

  it(`should wait for MinaNFTTreeVerifier to be deployed`, async () => {
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    console.time(`waited for MinaNFTTreeVerifier to be deployed`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    console.timeEnd(`waited for MinaNFTTreeVerifier to be deployed`);
  });

  it(`should verify merged proof on chain`, async () => {
    const proof: TreeStateProof = TreeStateProof.fromJSON(
      JSON.parse(mergedProof) as JsonProof
    );
    expect(proof).toBeDefined();
    if (proof === undefined) return;
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(verifier).toBeDefined();
    if (verifier === undefined) return;
    console.time(`verified merged proof on chain`);
    const sender = deployer.toPublicKey();
    const zkApp = new MinaNFTTreeVerifier(verifier);
    const transaction = await Mina.transaction(
      { sender, fee: await MinaNFT.fee() },
      () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        zkApp.verifyRedactedTree(proof!);
      }
    );
    await transaction.prove();
    transaction.sign([deployer]);
    tx = await transaction.send();
    console.timeEnd(`verified merged proof on chain`);
    await MinaNFT.transactionInfo(tx, `verified merged proof on chain`, false);
    expect(await MinaNFT.wait(tx)).toBe(true);
    Memory.info(`verified merged proof on chain`);
  });
});
