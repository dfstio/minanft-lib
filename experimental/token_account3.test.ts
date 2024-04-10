import { describe, expect, it } from "@jest/globals";
import {
  method,
  SmartContract,
  AccountUpdate,
  fetchAccount,
  PrivateKey,
  Mina,
  PublicKey,
  state,
  State,
  Field,
  Bool,
  Permissions,
  DeployArgs,
  VerificationKey,
  Account,
} from "o1js";

// Private key of the deployer:
import { DEPLOYER, NFT_TEST_SK } from "../env.json";

// True - local blockchain, false - Berkeley
const useLocalBlockchain: boolean = false;

const MINAURL = "https://proxy.berkeley.minaexplorer.com/graphql";
const ARCHIVEURL = "https://archive.berkeley.minaexplorer.com";
const TESTWORLD2 = "https://proxy.testworld.minaexplorer.com/graphql";
const TESTWORLD2_ARCHIVE = "https://archive.testworld.minaexplorer.com";
const tokenSymbol = "NFT";
const transactionFee = 150_000_000;
jest.setTimeout(1000 * 60 * 60 * 10); // 10 hours
let deployer: PrivateKey | undefined = undefined;

class Token extends SmartContract {
  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
  }

  @method mint(address: PublicKey, vk: VerificationKey) {
    this.token.mint({ address, amount: 1 });
    const update = AccountUpdate.createSigned(address, this.token.id);
    update.body.update.verificationKey = { isSome: Bool(true), value: vk };
    update.body.update.permissions = {
      isSome: Bool(true),
      value: {
        ...Permissions.default(),
        setDelegate: Permissions.proof(),
        incrementNonce: Permissions.proof(),
        setVotingFor: Permissions.proof(),
        setTiming: Permissions.proof(),
      },
    };
  }

  @method update(value: Field, address: PublicKey) {
    const zkAppTokenAccount = new TokenAccount(address, this.token.id);
    zkAppTokenAccount.update(value);
  }
}

class TokenAccount extends SmartContract {
  @state(Field) value = State<Field>();

  @method update(value: Field) {
    const oldValue = this.value.getAndRequireEquals();
    oldValue.assertEquals(value.sub(Field(1)));
    this.value.set(value);
  }
}

let token: PublicKey | undefined = undefined;
let tokenPrivateKey: PrivateKey | undefined = undefined;
let user1: PublicKey | undefined = undefined;
let userPrivateKey1: PrivateKey | undefined = undefined;
let user2: PublicKey | undefined = undefined;
let userPrivateKey2: PrivateKey | undefined = undefined;
let verificationKey: VerificationKey | undefined = undefined;
let nonce: number = 0;

beforeAll(async () => {
  if (useLocalBlockchain) {
    const Local = Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    deployer = Local.testAccounts[0].privateKey;
  } else {
    const network = Mina.Network({
      mina: TESTWORLD2,
      archive: TESTWORLD2_ARCHIVE,
    });
    Mina.setActiveInstance(network);
    deployer = PrivateKey.fromBase58(DEPLOYER);
  }
  const { verificationKey: vk } = await TokenAccount.compile();
  verificationKey = vk;
  await Token.compile();
});

describe("Mint tokens", () => {
  it("should deploy a Token contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const zkAppTokenPrivateKey = PrivateKey.random();
    const zkAppTokenPublicKey = zkAppTokenPrivateKey.toPublicKey();
    userPrivateKey1 = PrivateKey.fromBase58(NFT_TEST_SK);
    user1 = userPrivateKey1.toPublicKey();
    userPrivateKey2 = PrivateKey.random();
    user2 = userPrivateKey2.toPublicKey();

    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppTokenPublicKey });
    const account = Account(sender);
    nonce = Number(account.nonce.get().toBigint());

    const zkToken = new Token(zkAppTokenPublicKey);

    const transaction = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.deploy({});
        zkToken.account.tokenSymbol.set(tokenSymbol);
        zkToken.account.zkappUri.set("https://minanft.io");
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppTokenPrivateKey]);
    const tx = await transaction.send();
    console.log(
      `deploying the Token contract to an address ${zkAppTokenPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`
      //transaction.toPretty()
    );
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    token = zkAppTokenPublicKey;
    tokenPrivateKey = zkAppTokenPrivateKey;
  });

  it("should deploy the TokenAccount contract", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(user1).not.toBeUndefined();
    expect(userPrivateKey1).not.toBeUndefined();
    expect(user2).not.toBeUndefined();
    expect(userPrivateKey2).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user1 === undefined ||
      userPrivateKey1 === undefined ||
      user2 === undefined ||
      userPrivateKey2 === undefined
    )
      return;
    const user1PublicKey: PublicKey = user1;
    const user2PublicKey: PublicKey = user2;
    const user1PrivateKey: PrivateKey = userPrivateKey1;
    const user2PrivateKey: PrivateKey = userPrivateKey2;
    const zkToken = new Token(token!);
    const sender = deployer.toPublicKey();

    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.mint(user1PublicKey, verificationKey!);
      }
    );
    await transaction1.prove();
    transaction1.sign([deployer, user1PrivateKey]);
    const tx1 = await transaction1.send();

    // We do not need to wait for the transaction to be included in the block
    // Just send next immediately using the same deployer account

    const transaction2 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.mint(user2PublicKey, verificationKey!);
      }
    );
    await transaction2.prove();
    transaction2.sign([deployer, user2PrivateKey]);
    const tx2 = await transaction2.send();

    console.log(`deploying the TokenAccounts...`);
    if (!useLocalBlockchain) {
      await tx1.wait({ maxAttempts: 120, interval: 60000 });
      await tx2.wait({ maxAttempts: 120, interval: 60000 });
    }
  });

  it("should change the state and check the balance", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(user1).not.toBeUndefined();
    expect(userPrivateKey1).not.toBeUndefined();
    expect(user2).not.toBeUndefined();
    expect(userPrivateKey2).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user1 === undefined ||
      userPrivateKey2 === undefined ||
      user2 === undefined ||
      userPrivateKey2 === undefined
    )
      return;
    const user1PublicKey: PublicKey = user1;
    const user2PublicKey: PublicKey = user2;
    const zkToken = new Token(token);
    const tokenId = zkToken.token.id;
    const zkTokenAccount1 = new TokenAccount(user1PublicKey, tokenId);
    const zkTokenAccount2 = new TokenAccount(user2PublicKey, tokenId);

    const sender = deployer.toPublicKey();

    for (let i = 0; i < 10; i++) {
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey: token });
      await fetchAccount({ publicKey: user1PublicKey });
      await fetchAccount({ publicKey: user1PublicKey, tokenId });
      await fetchAccount({ publicKey: user2PublicKey });
      await fetchAccount({ publicKey: user2PublicKey, tokenId });
      const hasAccount1 = Mina.hasAccount(user1PublicKey, tokenId);
      const hasAccount2 = Mina.hasAccount(user2PublicKey, tokenId);
      const value1 = zkTokenAccount1.value.get();
      const value2 = zkTokenAccount2.value.get();
      console.log(
        "Iteration",
        i,
        "hasAccount1",
        hasAccount1,
        "value1",
        value1.toJSON(),
        "hasAccount2",
        hasAccount2,
        "value2",
        value2.toJSON()
      );
      expect(value1).toBeDefined();
      expect(value1.toJSON()).toBe(i.toString());
      expect(value2).toBeDefined();
      expect(value2.toJSON()).toBe(i.toString());

      const transaction1 = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
        () => {
          zkToken.update(Field(i + 1), user1PublicKey);
        }
      );
      await transaction1.prove();
      transaction1.sign([deployer]);
      const tx1 = await transaction1.send();

      const transaction2 = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
        () => {
          zkToken.update(Field(i + 1), user2PublicKey);
        }
      );
      await transaction2.prove();
      transaction2.sign([deployer]);
      const tx2 = await transaction2.send();

      if (!useLocalBlockchain) {
        await tx1.wait({ maxAttempts: 120, interval: 60000 });
        await tx2.wait({ maxAttempts: 120, interval: 60000 });
      }
    }
  });
});
