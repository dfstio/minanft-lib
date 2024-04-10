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
} from "o1js";

// Private key of the deployer:
import { DEPLOYER } from "../env.json";

// True - local blockchain, false - Berkeley
const useLocalBlockchain: boolean = false;

const MINAURL = "https://proxy.berkeley.minaexplorer.com/graphql";
const TESTNET = "https://proxy.testworld.minaexplorer.com/graphql";
const tokenSymbol = "TEST";
const transactionFee = 150_000_000;
jest.setTimeout(1000 * 60 * 60 * 10); // 10 hours
let deployer: PrivateKey | undefined = undefined;

class Token extends SmartContract {
  @state(PublicKey) listed = State<PublicKey>();
  @state(UInt64) amount = State<UInt64>();

  @method mint(address: PublicKey) {
    const account = Account(address, this.token.id);
    const balance = account.balance.getAndRequireEquals();
    const amount = this.amount.getAndRequireEquals();
    balance.assertEquals(UInt64.from(0));
    this.token.mint({ address, amount });
  }
}

class Hacker extends SmartContract {
  @method mint(address: PublicKey) {
    this.token.mint({ address, amount: 1 });
  }

  @method steal(token: PublicKey, address: PublicKey) {
    const account = Account(address, this.token.id);
    const balance = account.balance.getAndRequireEquals();
    const balance1 = balance.add(UInt64.from(1));
    balance1.assertGreaterThan(balance);

    const tokenApp = new Token(token);
    tokenApp.mint(address);
  }
}

let token: PublicKey | undefined = undefined;
let tokenPrivateKey: PrivateKey | undefined = undefined;
let user: PublicKey | undefined = undefined;
let userPrivateKey: PrivateKey | undefined = undefined;
let hacker: PublicKey | undefined = undefined;
let hackerPrivateKey: PrivateKey | undefined = undefined;

beforeAll(async () => {
  if (useLocalBlockchain) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    const network = Mina.Network({
      mina: TESTNET,
    });
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(
      "EKEugRbaLrY1WLJqWhhzQWme381CUR2975fA1oKQb2ynaMiJFrTA"
    );
  }
  await Token.compile();
  await Hacker.compile();
});

describe("Mint tokens", () => {
  it("should deploy a Token and Hacker contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppTokenPrivateKey = PrivateKey.random();
    const zkAppTokenPublicKey = zkAppTokenPrivateKey.toPublicKey();
    userPrivateKey = PrivateKey.random();
    user = userPrivateKey.toPublicKey();
    const zkAppHackerPrivateKey = PrivateKey.random();
    const zkAppHackerPublicKey = zkAppHackerPrivateKey.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppTokenPublicKey });
    await fetchAccount({ publicKey: zkAppHackerPublicKey });

    const zkToken = new Token(zkAppTokenPublicKey);
    const zkHacker = new Hacker(zkAppHackerPublicKey);

    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender, 2);
        zkToken.deploy({});
        zkToken.account.tokenSymbol.set(tokenSymbol);
        zkToken.listed.set(user!);
        zkToken.amount.set(UInt64.from(1_000_000_000_000_000));
        zkHacker.deploy({});
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppTokenPrivateKey, zkAppHackerPrivateKey]);
    const tx = await transaction.send();
    console.log(
      `deploying the Token contract to an address ${zkAppTokenPublicKey.toBase58()}
and Hacker contract to an address ${zkAppHackerPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}
user: ${user!.toBase58()}
`
    );
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    token = zkAppTokenPublicKey;
    tokenPrivateKey = zkAppTokenPrivateKey;
    hacker = zkAppHackerPublicKey;
    hackerPrivateKey = zkAppHackerPrivateKey;
  });

  it("should mint a tokens and check the balance", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(user).not.toBeUndefined();
    expect(userPrivateKey).not.toBeUndefined();
    expect(hacker).not.toBeUndefined();
    expect(hackerPrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user === undefined ||
      userPrivateKey === undefined ||
      hacker === undefined ||
      hackerPrivateKey === undefined
    )
      return;
    const hackerPublicKey: PublicKey = hacker;
    const userPublicKey: PublicKey = user;
    const zkToken = new Token(token);
    const zkHacker = new Hacker(hacker);
    const tokenId = zkToken.token.id;
    const hackerTokenId = zkHacker.token.id;

    const sender = deployer.toPublicKey();
    let balance: UInt64 = UInt64.from(0);

    for (let i = 1; i <= 2; i++) {
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey: token });
      await fetchAccount({ publicKey: userPublicKey });
      //await fetchAccount({ publicKey: userPublicKey, tokenId });
      await fetchAccount({ publicKey: userPublicKey, tokenId: hackerTokenId });
      await fetchAccount({ publicKey: hackerPublicKey });
      //let hasAccountHacker = Mina.hasAccount(userPublicKey, hackerTokenId);
      //let hasAccount = Mina.hasAccount(userPublicKey, tokenId);
      console.log("Iteration", i);
      const transaction = await Mina.transaction(
        { sender, fee: transactionFee },
        () => {
          if (i === 1) AccountUpdate.fundNewAccount(sender, 2);
          if (i === 1) zkHacker.mint(userPublicKey);
          if (i === 1) zkToken.mint(userPublicKey);
          if (i > 1) zkHacker.steal(token!, userPublicKey);
        }
      );
      await transaction.prove();
      transaction.sign([
        deployer,
        tokenPrivateKey!,
        userPrivateKey!,
        hackerPrivateKey,
      ]); //
      const tx = await transaction.send();
      //console.log(`Transaction ${i}:`, transaction.toPretty());
      if (!useLocalBlockchain) {
        await tx.wait({ maxAttempts: 120, interval: 60000 });
      }
    }
    console.log(`Fetching account...`);
    await fetchAccount({ publicKey: userPublicKey, tokenId });
    const hasAccount = Mina.hasAccount(userPublicKey, tokenId);
    if (hasAccount) {
      //balance = Mina.getBalance(hackerPublicKey, tokenId);
      balance = Mina.getBalance(userPublicKey, tokenId);
      console.log(
        "Balance:",
        (balance.toBigInt() / BigInt(1_000_000_000)).toString()
      );
    }
  });
});
