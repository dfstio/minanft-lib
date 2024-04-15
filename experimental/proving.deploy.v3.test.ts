import { describe, expect, it } from "@jest/globals";
import { Cache, AccountUpdate, Mina, fetchAccount, Field, verify } from "o1js";
import { initBlockchain } from "../utils/testhelpers";
import {
  zkAppPrivateKey,
  zkAppPublicKey,
  MyContract,
  MyZkProgram,
} from "./proving.v3";
import fs from "fs/promises";

describe("Proving", () => {
  it(`should deploy contract`, async () => {
    expect(zkAppPrivateKey.toPublicKey().toBase58()).toBe(
      zkAppPublicKey.toBase58()
    );
    const deployer = (await initBlockchain("devnet"))?.deployer;
    expect(deployer).toBeDefined();
    if (deployer === undefined) throw new Error("deployer is undefined");
    const cache: Cache = Cache.FileSystem("./cache");
    console.log("Compiling ...");
    const { verificationKey } = await MyZkProgram.compile({ cache });
    await MyContract.compile({ cache });
    console.log("Deploying MyContract...");
    const zkApp = new MyContract(zkAppPublicKey);
    const sender = deployer.toPublicKey();

    await fetchAccount({ publicKey: sender });
    const tx = await Mina.transaction(
      { sender, fee: "100000000", memo: "lazy proving" },
      async () => {
        AccountUpdate.fundNewAccount(sender);
        await zkApp.deploy({});
        zkApp.account.zkappUri.set("zkcloudworker.com");
      }
    );
    const txSent = await tx.sign([deployer, zkAppPrivateKey]).send();
    console.log({ txSent });
    const proof = await MyZkProgram.check(Field(20));
    const ok = await verify(proof, verificationKey);
    expect(ok).toBe(true);
    await fs.writeFile(
      "./json/proof3.json",
      JSON.stringify(proof.toJSON(), null, 2)
    );
    const txIncluded = await txSent.wait();
    console.log({ txIncluded });
  });
});
