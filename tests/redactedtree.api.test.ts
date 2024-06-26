import { describe, expect, it } from "@jest/globals";
import {
  Mina,
  fetchAccount,
  AccountUpdate,
  PrivateKey,
  PublicKey,
  Field,
  MerkleTree,
  JsonProof,
  verify,
  VerificationKey,
} from "o1js";
import { formatTime } from "../src/mina";
import { MinaNFT } from "../src/minanft";

import { blockchain, initBlockchain } from "../utils/testhelpers";
import { Memory } from "../src/mina";
import {
  MinaNFTTreeVerifierFunction,
  TreeElement,
} from "../src/plugins/redactedtree";
import { JWT } from "../env.json";
import { api } from "../src/api/api";

const blockchainInstance: blockchain = "local";
const height = 20;
const maxElements = 10;
const minMaskLength = 5;

const {
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
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
let maskLength: number = 0;
const size = 2 ** (height - 1);
//const proofs: TreeStateProof[] = [];
//let proof: TreeStateProof | undefined = undefined;
const transactions: string[] = [];
let verificationKey: VerificationKey | undefined = undefined;
let tx: Mina.PendingTransaction | undefined = undefined;
let verifier: PublicKey | undefined = undefined;
let deployer: PrivateKey | undefined = undefined;
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
let jobId: string = "";
// eslint-disable-next-line @typescript-eslint/no-inferrable-types
let proof: string = "";

beforeAll(async () => {
  const data = await initBlockchain(blockchainInstance, 0);
  expect(data).toBeDefined();
  if (data === undefined) return;

  const { deployer: d } = data;
  deployer = d;
  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
});

describe.skip(`MinaNFT Redacted Merkle Tree calculations`, () => {
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

  it(`should prepare witnesses`, async () => {
    expect(maskLength).toBeGreaterThan(0);
    if (maskLength === 0) return;
    console.time(`prepared transactions`);
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

        //console.log(originalWitness.toJSON());
        const transaction = {
          element: element.toJSON(),
          originalWitness: originalWitness.toJSON(),
          redactedWitness: redactedWitness.toJSON(),
        };
        const tx = JSON.stringify(transaction, null, 2);
        transactions.push(tx);
        /*
        const args = JSON.parse(tx);
        //console.log(args.originalWitness);
        const el = TreeElement.fromJSON(args.element);
        const ow = MerkleTreeWitness.fromJSON(args.originalWitness);
        const rw = MerkleTreeWitness.fromJSON(args.redactedWitness);

        const proof = await RedactedMinaNFTTreeCalculation.create(
          RedactedMinaNFTTreeState.create(el, ow, rw),
          el,
          ow,
          rw
        );

        expect(proof).toBeDefined();
        const ok = await verify(proof.toJSON(), verificationKey);
        expect(ok).toBeTruthy();

        Memory.info(`calculated proof ${i}`);
        */
      }
    }
    console.timeEnd(`prepared transactions`);
  });

  it.skip(`should calculate proof using api call`, async () => {
    const minanft = new api(JWT);
    console.log("transactions", transactions.length);

    const apiresult = await minanft.proof({
      transactions,
      developer: "@dfst",
      name: "tree",
      task: "proof",
      args: [height.toString()],
    });

    console.log("api result", apiresult);
    expect(apiresult.success).toBe(true);
    expect(apiresult.jobId).toBeDefined();
    if (apiresult.jobId === undefined) return;
    jobId = apiresult.jobId;
  });

  it(`should compile contracts`, async () => {
    console.log(`Compiling...`);
    console.time(`compiled all`);

    console.time(`compiled RedactedTreeCalculation`);
    const { verificationKey: vk } =
      await RedactedMinaNFTTreeCalculation.compile();
    verificationKey = vk;
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
      async () => {
        AccountUpdate.fundNewAccount(sender);
        await zkApp.deploy({});
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

  it.skip(`should get merged proof using api call`, async () => {
    expect(jobId).toBeDefined();
    if (jobId === undefined) return;
    expect(jobId).not.toBe("");
    if (jobId === "") return;
    const minanft = new api(JWT);
    const result = await minanft.waitForJobResult({ jobId });
    /*
    let ready: boolean = false;
    while (!ready) {
      await sleep(5000);
      const result = await minanft.proofResult({ jobId });
   */
    if (result.success) {
      if (result.result.result !== undefined) {
        //ready = true;
        //console.log("status", result.status);
        //console.log("Final result", result.result.result);
        proof = result.result.result;
        console.log(
          "Billed duration",
          formatTime(result.result.billedDuration),
          result.result.billedDuration
        );
        console.log(
          "Duration",
          formatTime(result.result.timeFinished - result.result.timeCreated),
          result.result.timeFinished - result.result.timeCreated
        );
      }
    } else {
      console.log("ERROR", result);
    }
    if (result.result.jobStatus === "failed") {
      //ready = true;
      console.log("status:", result.result.jobStatus);
      console.log("Final result", result.result.result);
      console.log(
        "Billed duration",
        formatTime(result.result.billedDuration),
        result.result.billedDuration
      );
      console.log(
        "Duration",
        formatTime(result.result.timeFailed - result.result.timeCreated),
        result.result.timeFailed - result.result.timeCreated
      );
      // }
    }
  });

  it(`should wait for MinaNFTTreeVerifier to be deployed`, async () => {
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    console.time(`waited for MinaNFTTreeVerifier to be deployed`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    console.timeEnd(`waited for MinaNFTTreeVerifier to be deployed`);
  });

  it.skip(`should verify merged proof off chain`, async () => {
    expect(proof).toBeDefined();
    expect(proof).not.toBe("");
    if (proof === "") return;
    expect(verificationKey).toBeDefined();
    if (verificationKey === undefined) return;
    const calculatedProof: TreeStateProof = await TreeStateProof.fromJSON(
      JSON.parse(proof) as JsonProof
    );
    const ok = await verify(calculatedProof.toJSON(), verificationKey);
    expect(ok).toBeTruthy();
  });

  it.skip(`should verify merged proof on chain`, async () => {
    expect(proof).toBeDefined();
    expect(proof).not.toBe("");
    if (proof === "") return;
    const calculatedProof: TreeStateProof = await TreeStateProof.fromJSON(
      JSON.parse(proof) as JsonProof
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
      async () => {
        await zkApp.verifyRedactedTree(calculatedProof);
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
