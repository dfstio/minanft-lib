import { describe, expect, it } from "@jest/globals";
import { Cache, Field, Mina, fetchAccount } from "o1js";
import { initBlockchain } from "../utils/testhelpers";
import { zkAppPublicKey, MyContract } from "./proving";
import fs from "fs/promises";

describe("Proving", () => {
  it(`should prove and send tx`, async () => {
    console.time("proved and sent tx");
    const cache: Cache = Cache.FileSystem("./cache");
    const deployer = (await initBlockchain("devnet"))?.deployer;
    expect(deployer).toBeDefined();
    if (deployer === undefined) throw new Error("deployer is undefined");

    const zkApp = new MyContract(zkAppPublicKey);
    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const serializedTransaction = await fs.readFile("proving.json", "utf8");
    const { tx, blindingValues, value, fee, length } = JSON.parse(
      serializedTransaction
    );
    const txRestored: Mina.Transaction = Mina.Transaction.fromJSON(
      JSON.parse(tx)
    ) as Mina.Transaction;

    const txNew = await Mina.transaction({ sender, fee }, async () => {
      await zkApp.setValue(Field.fromJSON(value));
    });

    let i: number;
    for (i = 0; i < length; i++) {
      txRestored.transaction.accountUpdates[i].lazyAuthorization =
        txNew.transaction.accountUpdates[i].lazyAuthorization;
      (
        txRestored.transaction.accountUpdates[i].lazyAuthorization as any
      ).blindingValue.value[1][1] = BigInt(blindingValues[i]);
    }

    console.log("Compiling and proving...");
    await MyContract.compile({ cache });
    await txRestored.prove();
    const txSent = await txRestored.send();
    console.timeEnd("proved and sent tx");
    console.log({ txSent });
    const txIncluded = await txSent.wait();
    console.log({ txIncluded });
  });
});
