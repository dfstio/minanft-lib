import { describe, expect, it } from "@jest/globals";
import {
  Cache,
  AccountUpdate,
  Mina,
  fetchAccount,
  PublicKey,
  verify,
  Keypair,
  PrivateKey,
  Account,
} from "o1js";
import { initBlockchain } from "../utils/testhelpers";
import { SignTestContract } from "../src/contract-v2/sign-test";
import { accountBalanceMina } from "../utils/testhelpers";
const fee = 150_000_000;

const zkAppAddressString =
  "B62qk7nXjEzGJdyQFNVs5UauASTQJgiJSBpHJmDcFTiYQrDDTGDsNFT";

describe("Proving", () => {
  it(`should prove and send tx`, async () => {
    const cache: Cache = Cache.FileSystem("./cache");
    const deployer = (await initBlockchain("devnet"))?.deployer;
    expect(deployer).toBeDefined();
    if (deployer === undefined) throw new Error("deployer is undefined");
    const sender = deployer.toPublicKey();
    console.log("Sender balance", await accountBalanceMina(sender));
    console.log("Compiling...");
    await SignTestContract.compile({ cache });
    const zkAppPrivateKey = PrivateKey.fromBase58(
      "EKEYnXmLnVBjnCPdNSncbqvQFE5ms9yq9ZVJskbZbyL2BHYtMe3X"
    );
    const zkAppPublicKey = zkAppPrivateKey.toPublicKey();
    expect(zkAppPublicKey.toBase58()).toBe(zkAppAddressString);

    const zkApp = new SignTestContract(zkAppPublicKey);
    await fetchAccount({ publicKey: sender });
    const tx = await Mina.transaction(
      { sender, fee: "100000000", memo: "deploy" },
      async () => {
        AccountUpdate.fundNewAccount(sender);
        await zkApp.deploy({});
        zkApp.account.zkappUri.set("https://minanft.io");
      }
    );
    tx.sign([deployer, zkAppPrivateKey]);
    const txSent = await tx.send();
    console.log({ txSent });
    const txIncluded = await txSent.wait();
    console.log({ txIncluded });
  });
});
