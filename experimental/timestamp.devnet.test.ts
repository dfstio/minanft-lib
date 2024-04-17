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
  UInt64,
  Provable,
  PrivateKey,
} from "o1js";
import { initBlockchain } from "../utils/testhelpers";

class Timestamp extends SmartContract {
  @state(Field) value = State<Field>();

  @method async setValue(value: Field, currentTime: UInt64) {
    const timestamp = this.network.timestamp.getAndRequireEquals();
    Provable.log("timestamp  :", timestamp);
    Provable.log("currentTime:", currentTime);
    this.value.set(value);
  }
}

describe("Devnet timestamp", () => {
  const app = PrivateKey.randomKeypair();
  const zkApp = new Timestamp(app.publicKey);
  let deployer: PrivateKey | undefined;

  it(`should deploy contract`, async () => {
    deployer = (await initBlockchain("devnet"))?.deployer;
    expect(deployer).toBeDefined();
    if (deployer === undefined) throw new Error("deployer is undefined");
    const cache: Cache = Cache.FileSystem("./cache");
    console.log("Compiling ...");
    await Timestamp.compile({ cache });
    console.log("Deploying...");

    const sender = deployer.toPublicKey();

    await fetchAccount({ publicKey: sender });
    const tx = await Mina.transaction(
      { sender, fee: "100000000", memo: "deploy" },
      async () => {
        AccountUpdate.fundNewAccount(sender);
        await zkApp.deploy({});
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

  it(`should send tx using timestamp`, async () => {
    expect(deployer).toBeDefined();
    if (deployer === undefined) throw new Error("deployer is undefined");
    const sender = deployer.toPublicKey();

    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: app.publicKey });
    const tx = await Mina.transaction(
      { sender, fee: "100000000", memo: "setValue" },
      async () => {
        await zkApp.setValue(Field(100), UInt64.from(Date.now()));
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
