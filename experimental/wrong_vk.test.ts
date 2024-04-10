import { describe, expect, it } from "@jest/globals";
import {
  method,
  SmartContract,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  UInt64,
  state,
  State,
} from "o1js";

// Private key of the deployer:
import { DEPLOYER } from "../env.json";

// True - local blockchain, false - Berkeley
const useLocalBlockchain: boolean = true;

const MINAURL = "https://proxy.berkeley.minaexplorer.com/graphql";
const ARCHIVEURL = "https://archive.berkeley.minaexplorer.com";
const transactionFee = 150_000_000;
jest.setTimeout(1000 * 60 * 60 * 10); // 10 hours
let deployer: PrivateKey | undefined = undefined;

class Counter extends SmartContract {
  @state(UInt64) counter = State<UInt64>();

  @method increaseCounter() {
    const counter = this.counter.getAndRequireEquals();
    this.counter.set(counter.add(UInt64.from(1)));
  }
}

class Counter2 extends SmartContract {
  @state(UInt64) counter = State<UInt64>();
  @state(UInt64) counter2 = State<UInt64>();

  @method increaseCounter() {
    const counter = this.counter.getAndRequireEquals();
    const counter2 = this.counter.getAndRequireEquals();
    this.counter.set(counter.add(UInt64.from(1)));
    this.counter2.set(counter2.add(UInt64.from(1)));
  }
}

let counterPublicKey: PublicKey | undefined = undefined;
let counterPrivateKey: PrivateKey | undefined = undefined;

beforeAll(async () => {
  if (useLocalBlockchain) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    deployer = Local.testAccounts[0].privateKey;
  } else {
    const network = Mina.Network({
      mina: MINAURL,
      archive: ARCHIVEURL,
    });
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
  }
  await Counter.compile();
  await Counter2.compile();
});

describe("Test calling SmartContract with wrong verificatiob key", () => {
  it("should deploy a Counter contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    counterPrivateKey = PrivateKey.random();
    counterPublicKey = counterPrivateKey.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: counterPublicKey });

    const zkCounter = new Counter(counterPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkCounter.deploy({});
        zkCounter.counter.set(UInt64.from(1));
      }
    );
    await transaction.prove();
    transaction.sign([deployer, counterPrivateKey]);
    const tx = await transaction.send();
    console.log(
      `deploying the Counter contract to an address ${counterPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`,
      transaction.toPretty()
    );
    if (!useLocalBlockchain) {
      console.log(`Transaction hash: ${tx.hash()}`);
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
  });

  it("should call Counter using Counter2 code", async () => {
    expect(deployer).not.toBeUndefined();
    expect(counterPublicKey).not.toBeUndefined();
    expect(counterPrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      counterPublicKey === undefined ||
      counterPrivateKey === undefined
    )
      return;
    const sender = deployer.toPublicKey();

    const wrongCounter2PublicKey: PublicKey = counterPublicKey;
    // on wrongCounter2PublicKey the Counter code is deployed
    // but we use a Counter2 code to call it
    const zkCounter2 = new Counter2(wrongCounter2PublicKey);
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: wrongCounter2PublicKey });

    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        zkCounter2.increaseCounter();
      }
    );
    await transaction.prove();
    transaction.sign([deployer, counterPrivateKey]);
    const tx = await transaction.send();
    console.log(`Transaction`, transaction.toPretty());
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
  });
});
