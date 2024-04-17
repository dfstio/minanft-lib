import { describe, expect, it } from "@jest/globals";
import {
  Cache,
  AccountUpdate,
  Mina,
  fetchAccount,
  Field,
  SmartContract,
  method,
  state,
  State,
  PrivateKey,
} from "o1js";
import { initBlockchain } from "../utils/testhelpers";

class MyContract extends SmartContract {
  @state(Field) value = State<Field>();

  @method async setValue(value: Field) {
    this.value.set(value);
  }
}

describe("Devnet fetch", () => {
  const app = PrivateKey.randomKeypair();
  const zkApp = new MyContract(app.publicKey);
  let deployer: PrivateKey | undefined;

  it(`should deploy contract`, async () => {
    deployer = (await initBlockchain("devnet"))?.deployer;
    expect(deployer).toBeDefined();
    if (deployer === undefined) throw new Error("deployer is undefined");
    const cache: Cache = Cache.FileSystem("./cache");
    console.log("Compiling ...");
    await MyContract.compile({ cache });
    console.log("Deploying...");

    const sender = deployer.toPublicKey();

    await fetchAccount({ publicKey: sender });
    const tx = await Mina.transaction(
      { sender, fee: "100000000", memo: "deploy" },
      async () => {
        AccountUpdate.fundNewAccount(sender);
        await zkApp.deploy({});
        zkApp.value.set(Field(100));
      }
    );
    const txSent = await tx.sign([deployer, app.privateKey]).send();
    console.log({
      status: txSent.status,
      hash: txSent.hash,
      errors: txSent.errors,
    });
    const txIncluded = await txSent.wait();
    console.log({ status: txIncluded.status, hash: txIncluded.hash });
  });

  it(`should send tx`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) throw new Error("deployer is undefined");
    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: app.publicKey });
    const value = zkApp.value.get();
    expect(value.toBigInt()).toBe(BigInt(100));

    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: app.publicKey });
    const tx = await Mina.transaction(
      { sender, fee: "100000000", memo: "setValue" },
      async () => {
        await zkApp.setValue(Field(200));
      }
    );
    await tx.prove();
    const txSent = await tx.sign([deployer]).send();
    console.log({
      status: txSent.status,
      hash: txSent.hash,
      errors: txSent.errors,
    });
    const txIncluded = await txSent.wait();
    console.log({ status: txIncluded.status, hash: txIncluded.hash });
  });
});
