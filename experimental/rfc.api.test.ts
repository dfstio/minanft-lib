import { describe, expect, it } from "@jest/globals";
import {
  Mina,
  fetchAccount,
  AccountUpdate,
  PrivateKey,
  PublicKey,
  Field,
  MerkleTree,
  Account,
  Cache,
  SmartContract,
  method,
  state,
  State,
  MerkleWitness,
  Types,
} from "o1js";
import axios from "axios";
import { formatTime, Memory } from "../src/mina";
import { MinaNFT } from "../src/minanft";

import {  blockchain, initBlockchain } from "../utils/testhelpers";
import { JWT } from "../env.json";
import { api } from "../src/api/api";

const blockchainInstance: blockchain = "testworld2";
const maxElements = 128;

class MerkleTreeWitness20 extends MerkleWitness(20) {}

class RealTimeVoting extends SmartContract {
  @state(Field) root = State<Field>();

  @method addVoteToMerkleTree(
    guaranteedState: Field,
    newState: Field,
    witness: MerkleTreeWitness20,
    value: Field
  ) {
    const calculatedRoot = witness.calculateRoot(value);
    const oldCalculatedRoot = witness.calculateRoot(Field(0));
    guaranteedState.assertEquals(oldCalculatedRoot);
    newState.assertEquals(calculatedRoot);
    this.root.set(newState);
  }
}

const tree = new MerkleTree(20);
const leaves: Field[] = [];
const transactions: string[] = [];
let tx: Mina.TransactionId | undefined = undefined;
let votingContract: PublicKey | undefined = undefined;
let votingPrivateKey: PrivateKey | undefined = undefined;
let deployer: PrivateKey | undefined = undefined;
let jobId: string = "";
let proofs: string = "";
let startTime: number = 0;
let endTime: number = 0;

beforeAll(async () => {
  const data = await initBlockchain(blockchainInstance, 0);
  expect(data).toBeDefined();
  if (data === undefined) return;

  const { deployer: d } = data;
  deployer = d;
  expect(deployer).toBeDefined();
  if (deployer === undefined) return;
});

describe(`Parallel SmartContract proofs calculations`, () => {
  it(`should prepare data`, async () => {
    console.log(`Generating ${maxElements} elements...`);
    for (let i = 0; i < maxElements; i++) {
      const oldRoot: Field = tree.getRoot();
      const value = Field.random();
      leaves.push(value);
      tree.setLeaf(BigInt(i), value);
      const newRoot: Field = tree.getRoot();
      const witness = new MerkleTreeWitness20(tree.getWitness(BigInt(i)));
      const calculatedRoot = witness.calculateRoot(value);
      expect(calculatedRoot.toJSON()).toEqual(newRoot.toJSON());
      const oldCalculatedRoot = witness.calculateRoot(Field(0));
      expect(oldCalculatedRoot.toJSON()).toEqual(oldRoot.toJSON());
      const transaction = {
        id: i.toString(),
        oldRoot: oldRoot.toJSON(),
        newRoot: newRoot.toJSON(),
        witness: witness.toJSON(),
        value: value.toJSON(),
      };
      const tx = JSON.stringify(transaction, null, 2);
      transactions.push(tx);
    }

    votingPrivateKey = PrivateKey.fromBase58(
      "EKFCNNGdcMpuy85Y4cifs3J9PX1LZxrKwGHxjpvMzt8NKrtdqiZA"
    ); 
    //PrivateKey.random();
    votingContract = votingPrivateKey.toPublicKey();
    Memory.info(`prepared`);
  });

  it(`should compile contracts`, async () => {
    console.log(`Compiling...`);
    console.time(`compiled`);
    const cache: Cache = Cache.FileSystem("./treecache");
    await RealTimeVoting.compile({ cache });
    console.timeEnd(`compiled`);
    Memory.info(`compiled`);
  });
  /*
  it(`should deploy RealTimeVoting`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) return;
    expect(votingPrivateKey).toBeDefined();
    if (votingPrivateKey === undefined) return;
    console.time(`deployed RealTimeVoting`);
    const sender = deployer.toPublicKey();
    const zkAppPrivateKey = votingPrivateKey;
    console.log("zkAppPrivateKey", zkAppPrivateKey.toBase58());
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    console.log(
      `deploying the RealTimeVoting contract to an address ${zkAppPublicKey.toBase58()} using the deployer with public key ${sender.toBase58()}...`
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const zkApp = new RealTimeVoting(zkAppPublicKey);
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
    console.timeEnd(`deployed RealTimeVoting`);
    await MinaNFT.transactionInfo(tx, "deployed RealTimeVoting", false);
    votingContract = zkAppPublicKey;
    Memory.info(`deployed`);
  });

  it(`should wait for RealTimeVoting to be deployed`, async () => {
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    console.time(`waited for RealTimeVoting to be deployed`);
    expect(await MinaNFT.wait(tx)).toBe(true);
    console.timeEnd(`waited for RealTimeVoting to be deployed`);
  });
*/
  it(`should calculate proof using api call`, async () => {
    expect(votingPrivateKey).toBeDefined();
    if (votingPrivateKey === undefined) return;
    const minanft = new api(JWT);
    console.log("transactions", transactions.length);
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    const sender = deployer.toPublicKey();
    const account = Account(sender);
    const nonce: number = Number(account.nonce.get().toBigint());
    console.log("Nonce:", nonce.toString());

    const apiresult = await minanft.proof({
      transactions,
      developer: "@dfst",
      name: "rfc-voting",
      task: "proof",
      args: [votingPrivateKey.toBase58(), nonce.toString()],
    });
    startTime = Date.now();

    console.log("api call result", apiresult);
    expect(apiresult.success).toBe(true);
    expect(apiresult.jobId).toBeDefined();
    if (apiresult.jobId === undefined) return;
    jobId = apiresult.jobId;
  });

  it(`should get proofs using api call`, async () => {
    expect(jobId).toBeDefined();
    if (jobId === undefined) return;
    expect(jobId).not.toBe("");
    if (jobId === "") return;
    const minanft = new api(JWT);
    const result = await minanft.waitForJobResult({ jobId });
    endTime = Date.now();
    console.log(
      `Time spent to calculate ${maxElements} proofs: ${endTime - startTime} ms`
    );

    if (result.success) {
      if (result.result.result !== undefined) {
        proofs = result.result.result;
        console.log("Billed duration", result.result.billedDuration, "ms");
        console.log(
          "Duration",
          result.result.timeFinished - result.result.timeCreated,
          "ms"
        );
      }
    } else {
      console.log("ERROR", result);
    }
    if (result.result.jobStatus === "failed") {
      console.log("status:", result.result.jobStatus);
      console.log("Final result", result.result.result);
      console.log("Billed duration", result.result.billedDuration, "ms");
      console.log(
        "Duration",
        result.result.timeFailed - result.result.timeCreated,
        "ms"
      );
    }
  });

  it(`should send transaction to chain`, async () => {
    expect(proofs).toBeDefined();
    expect(proofs).not.toBe("");
    expect(deployer).not.toBeUndefined();
    expect(votingContract).not.toBeUndefined();
    if (deployer === undefined || votingContract === undefined || proofs === "")
      return;

    const url: string =
      "https://minanft-storage.s3.eu-west-1.amazonaws.com/" + proofs;
    const response: any = await axios.get(url);
    const txs = response.data.txs;
    console.log("Downloaded transactions:", txs.length);
    const sender = deployer.toPublicKey();
    let tx: Mina.TransactionId | undefined = undefined;
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: votingContract });

    console.log(`Sending ${maxElements} transactions...`);

    for (let i = 0; i < maxElements; i++) {
      const txData = txs.find((t: any) => t.i.toString() === i.toString());
      const transaction: Mina.Transaction = Mina.Transaction.fromJSON(
        JSON.parse(txData.tx) as Types.Json.ZkappCommand
      ) as Mina.Transaction;
      tx = await transaction.send();
      //console.log(`Transaction ${i} sent`); //, transaction.toPretty());
      if (i === 0) {
        await MinaNFT.transactionInfo(tx, `first`, false);
        console.log(
          "Waiting for a new block to put the remaining transactions in one block..."
        );
        expect(await MinaNFT.wait(tx)).toBe(true);
        console.time(`sent ${maxElements - 1} transactions`);
      }
    }
    console.timeEnd(`sent ${maxElements - 1} transactions`);
    expect(tx).toBeDefined();
    if (tx === undefined) return;
    await MinaNFT.transactionInfo(tx, `sent last transaction`, false);
    expect(await MinaNFT.wait(tx)).toBe(true);
    Memory.info(`end`);
  });
});
