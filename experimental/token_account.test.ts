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
  Field,
  Bool,
  Permissions,
  DeployArgs,
  VerificationKey,
} from "o1js";

// Private key of the deployer:
import { DEPLOYER } from "../env.json";

// True - local blockchain, false - Berkeley
const useLocalBlockchain: boolean = true;

const MINAURL = "https://proxy.berkeley.minaexplorer.com/graphql";
const ARCHIVEURL = "https://archive.berkeley.minaexplorer.com";
const tokenSymbol = "TEST";
const transactionFee = 150_000_000;
jest.setTimeout(1000 * 60 * 60 * 10); // 10 hours
let deployer: PrivateKey | undefined = undefined;

class Token extends SmartContract {
  @method mint(address: PublicKey) {
    this.token.mint({ address, amount: 1 });
    const update = AccountUpdate.createSigned(address, this.token.id);
    update.body.update.appState[0] = { isSome: Bool(true), value: Field(1234) };
  }

  @method check(address: PublicKey, value: Field) {
    const tokenId = this.token.id;
    const update = AccountUpdate.createSigned(address, this.token.id);
    update.body.preconditions.account.state[0] = { isSome: Bool(true), value };
  }
}

class TokenAccount extends SmartContract {
  @state(Field) value = State<Field>();

  @method empty() {
    this.value.getAndRequireEquals();
  }
}

let token: PublicKey | undefined = undefined;
let tokenPrivateKey: PrivateKey | undefined = undefined;
let user: PublicKey | undefined = undefined;
let userPrivateKey: PrivateKey | undefined = undefined;
//let counterKey: VerificationKey | undefined = undefined;
//let counter: PublicKey | undefined = undefined;
//let counterPrivateKey: PrivateKey | undefined = undefined;

beforeAll(async () => {
  if (useLocalBlockchain) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    const { privateKey } = Local.testAccounts[0];
    deployer = privateKey;
  } else {
    const network = Mina.Network({
      mina: MINAURL,
      archive: ARCHIVEURL,
    });
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
  }
  await TokenAccount.compile();
  //counterKey = verificationKey;
  await Token.compile();
});

describe("Mint tokens", () => {
  it("should deploy a Token and Counter contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const sender = deployer.toPublicKey();
    const zkAppTokenPrivateKey = PrivateKey.random();
    const zkAppTokenPublicKey = zkAppTokenPrivateKey.toPublicKey();
    userPrivateKey = PrivateKey.random();
    user = userPrivateKey.toPublicKey();
    //const zkAppCounterPrivateKey = PrivateKey.random();
    //const zkAppCounterPublicKey = zkAppCounterPrivateKey.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppTokenPublicKey });
    //await fetchAccount({ publicKey: zkAppCounterPublicKey });

    const zkToken = new Token(zkAppTokenPublicKey);

    //const zkCounter = new Counter(zkAppCounterPublicKey);
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.deploy({});
        zkToken.account.tokenSymbol.set(tokenSymbol);
        //zkCounter.deploy({});
        //zkCounter.counter.set(UInt64.from(0));
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppTokenPrivateKey]); //, zkAppCounterPrivateKey
    const tx = await transaction.send();
    console.log(
      `deploying the Token contract to an address ${zkAppTokenPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`
      //deploying the Counter contract to an address ${zkAppCounterPublicKey.toBase58()}
      //transaction.toPretty()
    );
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    token = zkAppTokenPublicKey;
    tokenPrivateKey = zkAppTokenPrivateKey;
    //counter = zkAppCounterPublicKey;
    //counterPrivateKey = zkAppCounterPrivateKey;
  });
  /*
  it("should fund the Token", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;
    const zkToken = new Token(token!);
    const tokenId = zkToken.token.id;
    const sender = deployer.toPublicKey();
    const transaction = await Mina.transaction(
      { sender, fee: transactionFee },
      () => {
        AccountUpdate.fundNewAccount(sender);
        const update = AccountUpdate.createSigned(deployer!.toPublicKey());
        update.send({ to: token!, amount: 10_000_000_000 });
        update.send({ to: user!, amount: 10_000_000_000 });
      }
    );
    await transaction.prove();
    transaction.sign([deployer]); //, zkAppCounterPrivateKey
    const tx = await transaction.send();
    console.log(`funding the Token address`);
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
  });
*/
  it("should mint a tokens and check the balance", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(user).not.toBeUndefined();
    expect(userPrivateKey).not.toBeUndefined();
    //expect(counter).not.toBeUndefined();
    //expect(counterPrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user === undefined ||
      userPrivateKey === undefined
      //counter === undefined ||
      //counterPrivateKey === undefined
    )
      return;
    //const counterPublicKey: PublicKey = counter;
    const userPublicKey: PublicKey = user;
    const zkToken = new Token(token);
    const tokenId = zkToken.token.id;

    const sender = deployer.toPublicKey();
    let balance: UInt64 = UInt64.from(0);

    for (let i = 1; i <= 2; i++) {
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey: token });
      await fetchAccount({ publicKey: userPublicKey });
      await fetchAccount({ publicKey: userPublicKey, tokenId });
      //await fetchAccount({ publicKey: counterPublicKey });
      //await fetchAccount({ publicKey: counterPublicKey, tokenId });
      //let hasAccount = Mina.hasAccount(counterPublicKey, tokenId);
      let hasAccount = Mina.hasAccount(userPublicKey, tokenId);
      console.log("Iteration", i, "hasAccount", hasAccount);
      if (i === 1) {
        const transaction = await Mina.transaction(
          { sender, fee: transactionFee },
          () => {
            AccountUpdate.fundNewAccount(sender);
            //zkToken.mint(counterPublicKey, balance);
            zkToken.mint(userPublicKey);
          }
        );
        await transaction.prove();
        transaction.sign([deployer, tokenPrivateKey!, userPrivateKey!]); // , counterPrivateKey
        const tx = await transaction.send();
        //console.log(`Transaction ${i}:`, transaction.toPretty());
        if (!useLocalBlockchain) {
          await tx.wait({ maxAttempts: 120, interval: 60000 });
        }
      } else {
        const transaction = await Mina.transaction(
          { sender, fee: transactionFee },
          () => {
            zkToken.check(userPublicKey!, Field(1234));
            /*
            const update = AccountUpdate.createSigned(userPublicKey, tokenId);
            update.body.mayUseToken = AccountUpdate.MayUseToken.No;
            update.body.update.appState.fill({
              isSome: Bool(false),
              value: Field(1),
            });
            */
          }
        );
        await transaction.prove();
        transaction.sign([deployer, tokenPrivateKey!, userPrivateKey!]);
        const tx = await transaction.send();
        //console.log(`Transaction ${i}:`, transaction.toPretty());
        if (!useLocalBlockchain) {
          await tx.wait({ maxAttempts: 120, interval: 60000 });
        }
      }

      console.log(`Fetching accounts...`);
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey: token });
      await fetchAccount({ publicKey: userPublicKey });
      await fetchAccount({ publicKey: userPublicKey, tokenId });
      //await fetchAccount({ publicKey: counterPublicKey });
      //await fetchAccount({ publicKey: counterPublicKey, tokenId });
      //hasAccount = Mina.hasAccount(counterPublicKey, tokenId);
      hasAccount = Mina.hasAccount(userPublicKey, tokenId);
      if (hasAccount) {
        //balance = Mina.getBalance(counterPublicKey, tokenId);
        balance = Mina.getBalance(userPublicKey, tokenId);
        console.log("Balance:", balance.toString());
        const zkApp = new TokenAccount(userPublicKey!, tokenId);
        const value = zkApp.value.get();
        console.log("Value:", value.toJSON());
      }
    }
  });
});
