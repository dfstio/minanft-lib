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

const useLocalBlockchain: boolean = true;

const tokenSymbol = "NFT";
const transactionFee = 150_000_000;
jest.setTimeout(1000 * 60 * 60 * 10); // 10 hours
let deployer: PrivateKey | undefined = undefined;

class Token extends SmartContract {
  @state(Field) version = State<Field>();

  init() {
    super.init();
    this.version.set(Field(1));
  }

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method mint(address: PublicKey, vk: VerificationKey, value: Field) {
    this.token.mint({ address, amount: 1_000_000_000 });
    const update = AccountUpdate.createSigned(address, this.token.id);
    update.body.update.verificationKey = { isSome: Bool(true), value: vk };
    update.body.update.permissions = {
      isSome: Bool(true),
      value: {
        ...Permissions.default(),
        editState: Permissions.proof(),
      },
    };
    update.body.update.appState[0] = { isSome: Bool(true), value };
  }

  @method check(address: PublicKey, tokenId: Field) {
    const token = new TokenAccount(address, tokenId);
    const value = token.value.get();
    value.assertEquals(Field(1));
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

class Badge extends SmartContract {
  init() {
    super.init();
  }

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method issue(address: PublicKey, tokenId: Field) {
    const token = new TokenAccount(address, tokenId);
    // If you comment out the next two lines, the test will pass
    const value = token.value.get();
    value.assertEquals(Field(1));
    this.token.mint({ address, amount: 1_000_000_000 });
  }
}

let token: PublicKey | undefined = undefined;
let tokenPrivateKey: PrivateKey | undefined = undefined;
let badge: PublicKey | undefined = undefined;
let badgePrivateKey: PrivateKey | undefined = undefined;
let user1: PublicKey | undefined = undefined;
let userPrivateKey1: PrivateKey | undefined = undefined;
let user2: PublicKey | undefined = undefined;
let userPrivateKey2: PrivateKey | undefined = undefined;
let tokenVerificationKey: VerificationKey | undefined = undefined;
let tokenAccountVerificationKey: VerificationKey | undefined = undefined;
let nonce: number = 0;

beforeAll(async () => {
  const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);
  deployer = Local.testAccounts[0].privateKey;
  const { verificationKey: vk1 } = await TokenAccount.compile();
  tokenAccountVerificationKey = vk1;
  const { verificationKey: vk2 } = await Token.compile();
  tokenVerificationKey = vk2;
  await Badge.compile();
});

describe("Access two token accounts", () => {
  it("should deploy a Token contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const zkAppTokenPrivateKey = PrivateKey.random();
    const zkAppTokenPublicKey = zkAppTokenPrivateKey.toPublicKey();
    userPrivateKey1 = PrivateKey.random();
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
    expect(tx).toBeDefined();
    expect(tx.isSuccess).toBe(true);
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

  it("should deploy a Badge contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const zkAppTokenPrivateKey = PrivateKey.random();
    const zkAppTokenPublicKey = zkAppTokenPrivateKey.toPublicKey();

    const sender = deployer.toPublicKey();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: zkAppTokenPublicKey });
    const account = Account(sender);

    const zkToken = new Badge(zkAppTokenPublicKey);

    const transaction = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.deploy({});
        zkToken.account.tokenSymbol.set("Badge");
        zkToken.account.zkappUri.set("https://minanft.io");
      }
    );
    await transaction.prove();
    transaction.sign([deployer, zkAppTokenPrivateKey]);
    const tx = await transaction.send();
    expect(tx).toBeDefined();
    expect(tx.isSuccess).toBe(true);
    console.log(
      `deploying the Badge contract to an address ${zkAppTokenPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`
      //transaction.toPretty()
    );
    if (!useLocalBlockchain) {
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    }
    badge = zkAppTokenPublicKey;
    badgePrivateKey = zkAppTokenPrivateKey;
  });

  it("should deploy the TokenAccount contracts", async () => {
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
        AccountUpdate.fundNewAccount(sender, 1);
        zkToken.mint(user1PublicKey, tokenVerificationKey!, Field(1));
      }
    );
    await transaction1.prove();
    transaction1.sign([deployer, user1PrivateKey]);
    const tx1 = await transaction1.send();
    expect(tx1).toBeDefined();
    expect(tx1.isSuccess).toBe(true);

    if (!useLocalBlockchain) {
      await tx1.wait({ maxAttempts: 120, interval: 60000 });
    }

    const transaction2 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender, 1);
        zkToken.mint(user2PublicKey, tokenVerificationKey!, Field(1));
      }
    );
    await transaction2.prove();
    transaction2.sign([deployer, user2PrivateKey]);
    const tx2 = await transaction2.send();
    expect(tx2).toBeDefined();
    expect(tx2.isSuccess).toBe(true);

    console.log(`deploying the TokenAccounts...`);
    if (!useLocalBlockchain) {
      await tx2.wait({ maxAttempts: 120, interval: 60000 });
    }
  });

  it("should check values", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(user1).not.toBeUndefined();
    expect(userPrivateKey1).not.toBeUndefined();
    expect(user2).not.toBeUndefined();
    expect(userPrivateKey2).not.toBeUndefined();
    expect(badge).not.toBeUndefined();
    expect(badgePrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user1 === undefined ||
      userPrivateKey1 === undefined ||
      user2 === undefined ||
      userPrivateKey2 === undefined ||
      badge === undefined ||
      badgePrivateKey === undefined
    )
      return;
    const user1PublicKey: PublicKey = user1;
    const user2PublicKey: PublicKey = user2;
    const user1PrivateKey: PrivateKey = userPrivateKey1;
    const user2PrivateKey: PrivateKey = userPrivateKey2;
    const zkToken = new Token(token!);
    const tokenId = zkToken.token.id;
    const sender = deployer.toPublicKey();

    const tokenAccount1 = new TokenAccount(user1PublicKey, tokenId);
    const tokenAccount2 = new TokenAccount(user2PublicKey, tokenId);
    await fetchAccount({ publicKey: user1PublicKey, tokenId });
    await fetchAccount({ publicKey: user2PublicKey, tokenId });
    const value1 = tokenAccount1.value.get();
    const value2 = tokenAccount2.value.get();
    expect(value1).toBeDefined();
    expect(value2).toBeDefined();
    if (value1 === undefined || value2 === undefined) return;
    expect(value1.toBigInt()).toEqual(BigInt(1));
    expect(value2.toBigInt()).toEqual(BigInt(1));

    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        zkToken.check(user1PublicKey, tokenId);
      }
    );
    await transaction1.prove();
    transaction1.sign([deployer, user1PrivateKey]);
    const tx1 = await transaction1.send();
    expect(tx1).toBeDefined();
    expect(tx1.isSuccess).toBe(true);

    if (!useLocalBlockchain) {
      await tx1.wait({ maxAttempts: 120, interval: 60000 });
    }

    const transaction2 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        zkToken.check(user2PublicKey, tokenId);
      }
    );
    await transaction2.prove();
    transaction2.sign([deployer, user2PrivateKey]);
    const tx2 = await transaction2.send();
    expect(tx2).toBeDefined();
    expect(tx2.isSuccess).toBe(true);

    console.log(`checking the values...`);
    if (!useLocalBlockchain) {
      await tx2.wait({ maxAttempts: 120, interval: 60000 });
    }
  });

  it("should issue badges", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(user1).not.toBeUndefined();
    expect(userPrivateKey1).not.toBeUndefined();
    expect(user2).not.toBeUndefined();
    expect(userPrivateKey2).not.toBeUndefined();
    expect(badge).not.toBeUndefined();
    expect(badgePrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user1 === undefined ||
      userPrivateKey1 === undefined ||
      user2 === undefined ||
      userPrivateKey2 === undefined ||
      badge === undefined ||
      badgePrivateKey === undefined
    )
      return;
    const user1PublicKey: PublicKey = user1;
    const user2PublicKey: PublicKey = user2;
    const user1PrivateKey: PrivateKey = userPrivateKey1;
    const user2PrivateKey: PrivateKey = userPrivateKey2;
    const zkToken = new Token(token!);
    const zkBadge = new Badge(badge!);
    const tokenId = zkToken.token.id;
    const sender = deployer.toPublicKey();

    const tokenAccount1 = new TokenAccount(user1PublicKey, tokenId);
    const tokenAccount2 = new TokenAccount(user2PublicKey, tokenId);
    await fetchAccount({ publicKey: user1PublicKey, tokenId });
    await fetchAccount({ publicKey: user2PublicKey, tokenId });
    const value1 = tokenAccount1.value.get();
    const value2 = tokenAccount2.value.get();
    expect(value1).toBeDefined();
    expect(value2).toBeDefined();
    if (value1 === undefined || value2 === undefined) return;
    expect(value1.toBigInt()).toEqual(BigInt(1));
    expect(value2.toBigInt()).toEqual(BigInt(1));

    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender, 1);
        zkBadge.issue(user1PublicKey, tokenId);
      }
    );
    await transaction1.prove();
    transaction1.sign([deployer, user1PrivateKey]);
    const tx1 = await transaction1.send();
    expect(tx1).toBeDefined();
    expect(tx1.isSuccess).toBe(true);

    if (!useLocalBlockchain) {
      await tx1.wait({ maxAttempts: 120, interval: 60000 });
    }

    const transaction2 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender, 1);
        zkBadge.issue(user2PublicKey, tokenId);
      }
    );
    await transaction2.prove();
    transaction2.sign([deployer, user2PrivateKey]);
    const tx2 = await transaction2.send();
    expect(tx2).toBeDefined();
    expect(tx2.isSuccess).toBe(true);

    console.log(`issuing the badges...`);
    if (!useLocalBlockchain) {
      await tx2.wait({ maxAttempts: 120, interval: 60000 });
    }
  });
});
