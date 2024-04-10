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
  UInt64,
  state,
  State,
  checkZkappTransaction,
  Bool,
  UInt32,
} from "o1js";

// Private key of the deployer:
import { DEPLOYER } from "../env.json";

// True - local blockchain, false - Berkeley
const useLocalBlockchain: boolean = false;

const MINAURL = "https://proxy.berkeley.minaexplorer.com/graphql";
const ARCHIVEURL = "https://archive.berkeley.minaexplorer.com";
const TESTWORLD2 = "https://proxy.testworld.minaexplorer.com/graphql";
const TESTWORLD2_ARCHIVE = "https://archive.testworld.minaexplorer.com";
const tokenSymbol = "TEST";
const transactionFee = 150_000_000;
jest.setTimeout(1000 * 60 * 60 * 10); // 10 hours
let deployer: PrivateKey | undefined = undefined;
let nonce: number = 0;

class Counter extends SmartContract {
  @state(UInt64) counter = State<UInt64>();

  @method increaseCounter() {
    const counter = this.counter.getAndRequireEquals();
    const newCounter = counter.add(UInt64.from(1));
    this.counter.set(newCounter);
  }
}

class Token extends SmartContract {
  @method mint(address: PublicKey) {
    // const account = Account(address, this.token.id);
    //const tokenBalance = account.balance.getAndRequireEquals();
    //tokenBalance.assertEquals(balance);
    //const app = new Counter(address);
    //const key = app.counter.getAndRequireEquals();
    //key.assertEquals(balance);
    //app.increaseCounter();
    this.token.mint({ address, amount: 1 });
  }
}
let token: PublicKey | undefined = undefined;
let tokenPrivateKey: PrivateKey | undefined = undefined;
let counter: PublicKey | undefined = undefined;
let counterPrivateKey: PrivateKey | undefined = undefined;

beforeAll(async () => {
  if (useLocalBlockchain) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    const network = Mina.Network({
      mina: TESTWORLD2,
      archive: TESTWORLD2_ARCHIVE,
    });
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
  }
  await Counter.compile();
  await Token.compile();
});

describe("Mint tokens", () => {
  it("should deploy a Token and Counter contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppTokenPrivateKey = PrivateKey.random();
    const zkAppTokenPublicKey = zkAppTokenPrivateKey.toPublicKey();
    const zkAppCounterPrivateKey = PrivateKey.random();
    const zkAppCounterPublicKey = zkAppCounterPrivateKey.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppTokenPublicKey });
    await fetchAccount({ publicKey: zkAppCounterPublicKey });

    const zkToken = new Token(zkAppTokenPublicKey);
    const zkCounter = new Counter(zkAppCounterPublicKey);
    const account = Account(sender);
    nonce = Number(account.nonce.get().toBigint());
    console.log("Nonce:", nonce.toString());
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee, nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.deploy({});
        zkToken.account.tokenSymbol.set(tokenSymbol);
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppTokenPrivateKey]);
    const tx = await transaction.send();
    await fetchAccount({ publicKey: sender });

    const transaction1 = await Mina.transaction(
      {
        sender,
        fee: transactionFee,
        nonce: nonce++,
      },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkCounter.deploy({});
        zkCounter.counter.set(UInt64.from(0));
      }
    );
    await transaction1.prove();
    transaction1.sign([deployer, zkAppCounterPrivateKey]);
    const tx1 = await transaction1.send();
    console.log(
      `deploying the Token contract to an address ${zkAppTokenPublicKey.toBase58()}
deploying the Counter contract to an address ${zkAppCounterPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`
      //transaction.toPretty()
    );
    if (!useLocalBlockchain) {
      const hash = tx.hash();
      const hash1 = tx1.hash();
      if (hash === undefined) {
        throw new Error("Transaction hash is undefined");
        return;
      }
      if (hash1 === undefined) {
        throw new Error("Transaction hash1 is undefined");
        return;
      }
      console.log(
        `Waiting for the transaction to be included in a block...`,
        hash
      );
      console.log(
        `Waiting for the transaction 1 to be included in a block...`,
        hash1
      );

      let status = await checkZkappTransaction(hash);
      console.log("Status", status);
      let status1 = await checkZkappTransaction(hash1);
      console.log("Status1", status1);
      await tx.wait({ maxAttempts: 120, interval: 60000 });

      status = await checkZkappTransaction(hash);
      console.log("Status", status);
      await tx1.wait({ maxAttempts: 120, interval: 60000 });
      status1 = await checkZkappTransaction(hash1);
      console.log("Status1", status1);
    }

    token = zkAppTokenPublicKey;
    tokenPrivateKey = zkAppTokenPrivateKey;
    counter = zkAppCounterPublicKey;
    counterPrivateKey = zkAppCounterPrivateKey;
  });

  it("should mint a tokens and check the balance", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(counter).not.toBeUndefined();
    expect(counterPrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      counter === undefined ||
      counterPrivateKey === undefined
    )
      return;
    const counterPublicKey: PublicKey = counter;
    const zkToken = new Token(token);
    const tokenId = zkToken.token.id;

    const sender = deployer.toPublicKey();
    let balance: UInt64 = UInt64.from(0);
    let tx: Mina.TransactionId | undefined = undefined;

    for (let i = 1; i <= 5; i++) {
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey: token });
      await fetchAccount({ publicKey: counterPublicKey });
      await fetchAccount({ publicKey: counterPublicKey, tokenId });

      const transaction = await Mina.transaction(
        { sender, fee: transactionFee, nonce: nonce++ },
        () => {
          zkToken.mint(counterPublicKey);
        }
      );
      await transaction.prove();
      transaction.sign([deployer, tokenPrivateKey, counterPrivateKey]);
      tx = await transaction.send();
      console.log(`Transaction ${i}:`); //, transaction.toPretty());
      /*
      if (!useLocalBlockchain) {
        await tx.wait({ maxAttempts: 120, interval: 60000 });
      }
      console.log(`Fetching accounts...`);
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey: token });
      await fetchAccount({ publicKey: counterPublicKey });
      await fetchAccount({ publicKey: counterPublicKey, tokenId });
      hasAccount = Mina.hasAccount(counterPublicKey, tokenId);
      if (hasAccount) {
        balance = Mina.getBalance(counterPublicKey, tokenId);
        console.log("Balance:", balance.toString());
        expect(balance.toBigInt()).toEqual(BigInt(i));
      }
      */
    }
    if (!useLocalBlockchain && tx !== undefined) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    console.log(`Fetching accounts...`);
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: token });
    await fetchAccount({ publicKey: counterPublicKey });
    await fetchAccount({ publicKey: counterPublicKey, tokenId });
    const hasAccount = Mina.hasAccount(counterPublicKey, tokenId);
    if (hasAccount) {
      balance = Mina.getBalance(counterPublicKey, tokenId);
      console.log("Balance:", balance.toString());
      expect(balance.toBigInt()).toEqual(BigInt(5));
    }
  });
});
