import { describe, expect, it } from "@jest/globals";
import { Cache, Field, Mina, fetchAccount, PublicKey, verify } from "o1js";
import { initBlockchain } from "../utils/testhelpers";
import {
  MyContract,
  MyZkProgram,
  deserializeTransaction,
  transactionParams,
} from "./proving.v3";
import fs from "fs/promises";

describe("Proving", () => {
  it(`should prove and send tx`, async () => {
    console.time("proved and sent tx");
    const cache: Cache = Cache.FileSystem("./cache");
    await initBlockchain("devnet");
    console.log("Compiling and proving...");
    const { verificationKey } = await MyZkProgram.compile({ cache });
    await MyContract.compile({ cache });

    const data = await fs.readFile("./json/proving3.json", "utf8");
    const {
      tx: serializedTransaction,
      value: valueStr,
      address,
    } = JSON.parse(data);
    const value = Field.fromJSON(valueStr);
    const zkAppPublicKey = PublicKey.fromBase58(address);
    const { fee, sender, nonce } = transactionParams(serializedTransaction);
    const proof = await MyZkProgram.check(value);
    const ok = await verify(proof, verificationKey);
    expect(ok).toBe(true);

    const zkApp = new MyContract(zkAppPublicKey);
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });
    const txNew = await Mina.transaction({ sender, fee, nonce }, async () => {
      await zkApp.setValue(value, proof);
    });
    const tx = deserializeTransaction(serializedTransaction, txNew);

    await tx.prove();
    const txSent = await tx.send();
    console.timeEnd("proved and sent tx");
    console.log({ txSent });
    const txIncluded = await txSent.wait();
    console.log({ txIncluded });
  });
});
