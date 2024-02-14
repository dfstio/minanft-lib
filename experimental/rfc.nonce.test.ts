import { describe, expect, it } from "@jest/globals";
import {
  method,
  SmartContract,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  Account,
  state,
  State,
  Field,
} from "o1js";

// Private key of the deployer:
import { DEPLOYER, DEPLOYERS } from "../env.json";
import { MinaNFT } from "../src/minanft";

// True - local blockchain, false - Berkeley
const useLocalBlockchain: boolean = false;
const txNumber = 256;

const transactionFee = 10_000_000;
jest.setTimeout(1000 * 60 * 60 * 10); // 10 hours
let deployer: PrivateKey | undefined = undefined;
let nonce: number = 0;

class Counter extends SmartContract {
  @state(Field) value = State<Field>();

  @method changeValue(newValue: Field) {
    this.value.set(newValue);
  }
}

let counter: PublicKey | undefined = undefined;
let counterPrivateKey: PrivateKey | undefined = undefined;

beforeAll(async () => {
  if (useLocalBlockchain) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    MinaNFT.minaInit("berkeley");
    deployer = PrivateKey.fromBase58(DEPLOYERS[6]);
  }
  await Counter.compile();
});

describe("Mint tokens", () => {
  it("should deploy a Counter contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppCounterPrivateKey = PrivateKey.random();
    const zkAppCounterPublicKey = zkAppCounterPrivateKey.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppCounterPublicKey });

    const zkCounter = new Counter(zkAppCounterPublicKey);
    const account = Account(sender);
    nonce = Number(account.nonce.get().toBigint());
    console.log("Nonce:", nonce.toString());
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee, nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkCounter.deploy({});
        zkCounter.value.set(Field(1));
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppCounterPrivateKey]);
    const tx = await transaction.send();

    console.log(
      `deploying the Counter contract to an address ${zkAppCounterPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`
    );
    if (!useLocalBlockchain) {
      const hash = tx.hash();
      if (hash === undefined) {
        throw new Error("Transaction hash is undefined");
        return;
      }
      console.log(
        `Waiting for the transaction to be included in a block...`,
        hash
      );

      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    counter = zkAppCounterPublicKey;
    counterPrivateKey = zkAppCounterPrivateKey;
  });

  it("should change the counter", async () => {
    expect(deployer).not.toBeUndefined();
    expect(counter).not.toBeUndefined();
    expect(counterPrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      counter === undefined ||
      counterPrivateKey === undefined
    )
      return;
    const counterPublicKey: PublicKey = counter;
    const zkCounter = new Counter(counterPublicKey);

    const sender = deployer.toPublicKey();
    let tx: Mina.TransactionId | undefined = undefined;
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: counterPublicKey });

    console.log(`Sending ${txNumber} transactions...`);
    console.time(`sent ${txNumber} transactions`);
    for (let i = 0; i < txNumber; i++) {
      const transaction = await Mina.transaction(
        { sender, fee: transactionFee, nonce: nonce++, memo: `zkCloudWorker`},
        () => {
          zkCounter.changeValue(Field(i + 2));
        }
      );
      await transaction.prove();
      transaction.sign([deployer, counterPrivateKey]);
      tx = await transaction.send();
      console.log(`Transaction ${i} sent`); //, transaction.toPretty());
    }
    console.timeEnd(`sent ${txNumber} transactions`);
    if (!useLocalBlockchain && tx !== undefined) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    console.log(`Fetching accounts...`);
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: counterPublicKey });
    const value: Field = zkCounter.value.get();
    expect(value.toJSON()).toBe((txNumber + 1).toString());
  });
});
