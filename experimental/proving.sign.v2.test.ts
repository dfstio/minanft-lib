import { describe, expect, it } from "@jest/globals";
import { Field, Mina, fetchAccount } from "o1js";
import { initBlockchain } from "../utils/testhelpers";
import { zkAppPublicKey, MyContract, serializeTransaction } from "./proving";
import fs from "fs/promises";

describe("Proving", () => {
  it(`should prepare and sign tx`, async () => {
    const deployer = (await initBlockchain("devnet"))?.deployer;
    expect(deployer).toBeDefined();
    if (deployer === undefined) throw new Error("deployer is undefined");

    const zkApp = new MyContract(zkAppPublicKey);
    const sender = deployer.toPublicKey();

    console.time("prepared and signed tx");
    const value = Field(10);
    const fee = "100000000";
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const tx = await Mina.transaction({ sender, fee }, async () => {
      await zkApp.setValue(value);
    });
    tx.sign([deployer]);

    const data: string = JSON.stringify(
      {
        tx: serializeTransaction(tx),
        value: value.toJSON(),
        address: zkAppPublicKey.toBase58(),
      },
      null,
      2
    );

    await fs.writeFile("proving.json", data);
    console.timeEnd("prepared and signed tx");
  });
});
