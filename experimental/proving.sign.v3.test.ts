import { describe, expect, it } from "@jest/globals";
import { Field, Mina, fetchAccount, JsonProof } from "o1js";
import { initBlockchain } from "../utils/testhelpers";
import {
  zkAppPublicKey,
  MyContract,
  MyZkProgram,
  MyZkProgramProof,
  serializeTransaction,
} from "./proving.v3";
import fs from "fs/promises";

describe("Proving", () => {
  it(`should prepare and sign tx`, async () => {
    const deployer = (await initBlockchain("devnet"))?.deployer;
    expect(deployer).toBeDefined();
    if (deployer === undefined) throw new Error("deployer is undefined");

    const zkApp = new MyContract(zkAppPublicKey);
    const sender = deployer.toPublicKey();

    console.time("prepared and signed tx");
    const value = Field(15);
    const fee = "100000000";

    const proofTemplate = JSON.parse(
      await fs.readFile("./json/proof3.json", "utf8")
    );
    proofTemplate.publicInput = [value.toJSON()];
    const proof: MyZkProgramProof = MyZkProgramProof.fromJSON(
      proofTemplate as JsonProof
    );
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppPublicKey });

    const tx = await Mina.transaction({ sender, fee }, async () => {
      await zkApp.setValue(value, proof);
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

    await fs.writeFile("./json/proving3.json", data);
    console.timeEnd("prepared and signed tx");
  });
});
