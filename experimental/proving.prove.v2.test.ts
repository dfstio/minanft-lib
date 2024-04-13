import { describe, expect, it } from "@jest/globals";
import { Cache, Field, Mina, fetchAccount, PublicKey } from "o1js";
import { initBlockchain } from "../utils/testhelpers";
import {
  MyContract,
  deserializeTransaction,
  transactionParams,
} from "./proving";
import fs from "fs/promises";

describe("Proving", () => {
  it(`should prove and send tx`, async () => {
    console.time("proved and sent tx");
    const cache: Cache = Cache.FileSystem("./cache");
    await initBlockchain("devnet");

    const data = await fs.readFile("proving.json", "utf8");
    const { tx: serializedTransaction, value, address } = JSON.parse(data);
    const zkAppPublicKey = PublicKey.fromBase58(address);
    const { fee, sender, nonce } = transactionParams(serializedTransaction);

    const zkApp = new MyContract(zkAppPublicKey);
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });
    const txNew = await Mina.transaction({ sender, fee, nonce }, async () => {
      await zkApp.setValue(Field.fromJSON(value));
    });
    const tx = deserializeTransaction(serializedTransaction, txNew);
    console.log("Compiling and proving...");
    await MyContract.compile({ cache });
    await tx.prove();
    const txSent = await tx.send();
    console.timeEnd("proved and sent tx");
    console.log({ txSent });
    const txIncluded = await txSent.wait();
    console.log({ txIncluded });
  });
});
