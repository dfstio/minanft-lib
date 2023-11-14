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
  UInt64,
  Signature,
  Types,
} from "o1js";

// Private key of the deployer:
import { DEPLOYER, NFT_TEST_SK } from "../env.json";
import { Memory } from "../utils/testhelpers";

const useLocalBlockchain: boolean = false;
const NUMBER_ITERATIONS = 2;

const MINAURL = "https://proxy.berkeley.minaexplorer.com/graphql";
const ARCHIVEURL = "https://archive.berkeley.minaexplorer.com";
const TESTWORLD2 = "https://proxy.testworld.minaexplorer.com/graphql";
const TESTWORLD2_ARCHIVE = "https://archive.testworld.minaexplorer.com";
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

  @method mint(address: PublicKey, vk: VerificationKey) {
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
  }

  @method update(value: Field, address: PublicKey) {
    const zkAppTokenAccount = new TokenAccount(address, this.token.id);
    zkAppTokenAccount.update(value);
  }
}

class TokenAccount extends SmartContract {
  @state(Field) value = State<Field>();

  @method update(value: Field) {
    const oldValue = this.value.getAndAssertEquals();
    oldValue.assertEquals(value.sub(Field(1)));
    this.value.set(value);
  }
}

class Token2 extends SmartContract {
  @state(Field) version = State<Field>();

  init() {
    super.init();
    this.version.set(Field(1));
  }
  events = {
    mint: Field,
  };

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  isNFT(address: PublicKey) {
    const account = Account(address, this.token.id);
    const tokenBalance = account.balance.getAndAssertEquals();
    tokenBalance.assertEquals(UInt64.from(1_000_000_000));
  }

  @method mint(address: PublicKey, vk: VerificationKey, data: Field) {
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
    this.emitEvent("mint", data);
  }

  @method upgrade(address: PublicKey, vk: VerificationKey) {
    this.isNFT(address);
    const update = AccountUpdate.createSigned(address, this.token.id);
    update.body.update.verificationKey = { isSome: Bool(true), value: vk };
  }

  @method update(value1: Field, value2: Field, address: PublicKey) {
    this.isNFT(address);
    const zkAppTokenAccount = new TokenAccount2(address, this.token.id);
    zkAppTokenAccount.update(value1, value2);
  }
}

class TokenAccount2 extends SmartContract {
  @state(Field) value1 = State<Field>();
  @state(Field) value2 = State<Field>();

  @method update(value1: Field, value2: Field) {
    const oldValue1 = this.value1.getAndAssertEquals();
    oldValue1.assertEquals(value1.sub(Field(1)));
    this.value1.set(value1);
    this.value2.set(value2);
  }
}

let token: PublicKey | undefined = undefined;
let tokenPrivateKey: PrivateKey | undefined = undefined;
let user1: PublicKey | undefined = undefined;
let userPrivateKey1: PrivateKey | undefined = undefined;
let user2: PublicKey | undefined = undefined;
let userPrivateKey2: PrivateKey | undefined = undefined;
let user3: PublicKey | undefined = undefined;
let userPrivateKey3: PrivateKey | undefined = undefined;
let user4: PublicKey | undefined = undefined;
let userPrivateKey4: PrivateKey | undefined = undefined;
let verificationKey: VerificationKey | undefined = undefined;
let nonce: number = 0;

beforeAll(async () => {
  Memory.info("start");
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
    //userPrivateKey1 = PrivateKey.fromBase58(NFT_TEST_SK);
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
    const tokenId = zkToken.token.id;
    const zkAppTokenAccount1 = new TokenAccount(user1PublicKey, tokenId);
    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.mint(user1PublicKey, verificationKey!);
        zkAppTokenAccount1.account.zkappUri.set("https://minanft.io/@token1");
      }
    );
    await transaction1.prove();
    transaction1.sign([deployer, user1PrivateKey]);
    const tx1 = await transaction1.send();
    expect(tx1).toBeDefined();
    expect(tx1.isSuccess).toBe(true);

    // We do not need to wait for the transaction to be included in the block
    // Just send next immediately using the same deployer account

    const zkAppTokenAccount2 = new TokenAccount(user2PublicKey, tokenId);
    const transaction2 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.mint(user2PublicKey, verificationKey!);
        zkAppTokenAccount2.account.zkappUri.set("https://minanft.io/@token2");
      }
    );
    await transaction2.prove();
    transaction2.sign([deployer, user2PrivateKey]);
    const tx2 = await transaction2.send();
    expect(tx2).toBeDefined();
    expect(tx2.isSuccess).toBe(true);

    console.log(`deploying the TokenAccounts...`);
    if (!useLocalBlockchain) {
      await tx1.wait({ maxAttempts: 120, interval: 60000 });
      await tx2.wait({ maxAttempts: 120, interval: 60000 });
    }
  });

  it("should change the state and check the balance", async () => {
    Memory.info("deployed");
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
    const zkToken = new Token(token);
    const tokenId = zkToken.token.id;
    const zkTokenAccount1 = new TokenAccount(user1PublicKey, tokenId);
    const zkTokenAccount2 = new TokenAccount(user2PublicKey, tokenId);

    const sender = deployer.toPublicKey();

    for (let i = 0; i < NUMBER_ITERATIONS; i++) {
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
      expect(tx1).toBeDefined();
      expect(tx1.isSuccess).toBe(true);

      const transaction2 = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
        () => {
          zkToken.update(Field(i + 1), user2PublicKey);
        }
      );
      await transaction2.prove();
      transaction2.sign([deployer]);
      const tx2 = await transaction2.send();
      expect(tx2).toBeDefined();
      expect(tx2.isSuccess).toBe(true);

      if (!useLocalBlockchain) {
        await tx1.wait({ maxAttempts: 120, interval: 60000 });
        await tx2.wait({ maxAttempts: 120, interval: 60000 });
      }
    }
  });

  it("should upgrade a Token contract", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined
    )
      return;

    const sender = deployer.toPublicKey();
    const { verificationKey: vkToken2 } = await Token2.compile();
    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: token });

    const transaction = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        const update = AccountUpdate.createSigned(token!);
        update.account.verificationKey.set(vkToken2);
        update.account.zkappUri.set("https://minanft.io/v2");
      }
    );
    await transaction.prove();
    transaction.sign([deployer, tokenPrivateKey]);
    const tx = await transaction.send();
    expect(tx).toBeDefined();
    expect(tx.isSuccess).toBe(true);
    console.log(
      `upgrading the Token contract on address ${token.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`
      //transaction.toPretty()
    );
    if (!useLocalBlockchain)
      await tx.wait({ maxAttempts: 120, interval: 60000 });
    Memory.info("Token upgraded");
  });

  it("should upgrade the TokenAccount contracts", async () => {
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
    const zkToken = new Token2(token);
    const sender = deployer.toPublicKey();
    const tokenId = zkToken.token.id;
    const { verificationKey: vkTokenAccount2 } = await TokenAccount2.compile();
    Memory.info("TokenAccount2. compiled");

    await fetchAccount({ publicKey: sender });
    await fetchAccount({ publicKey: token });
    await fetchAccount({ publicKey: user1PublicKey });
    await fetchAccount({ publicKey: user1PublicKey, tokenId });
    await fetchAccount({ publicKey: user2PublicKey });
    await fetchAccount({ publicKey: user2PublicKey, tokenId });
    const zkAppToken = new Token2(token);

    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        zkAppToken.upgrade(user1PublicKey, vkTokenAccount2);
      }
    );
    await transaction1.prove();
    transaction1.sign([deployer, userPrivateKey1]);
    const tx1 = await transaction1.send();
    expect(tx1).toBeDefined();
    expect(tx1.isSuccess).toBe(true);

    // We do not need to wait for the transaction to be included in the block
    // Just send next immediately using the same deployer account

    const transaction2 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        zkAppToken.upgrade(user2PublicKey, vkTokenAccount2);
      }
    );
    await transaction2.prove();
    transaction2.sign([deployer, userPrivateKey2]);
    const tx2 = await transaction2.send();
    expect(tx2).toBeDefined();
    expect(tx2.isSuccess).toBe(true);

    console.log(`upgrading the TokenAccounts...`);
    if (!useLocalBlockchain) {
      await tx1.wait({ maxAttempts: 120, interval: 60000 });
      await tx2.wait({ maxAttempts: 120, interval: 60000 });
    }
    verificationKey = vkTokenAccount2;
  });

  it("should change the state and check the balance of upgraded balances", async () => {
    Memory.info("before state change 2");
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
    const zkToken = new Token2(token);
    const tokenId = zkToken.token.id;
    const zkTokenAccount1 = new TokenAccount2(user1PublicKey, tokenId);
    const zkTokenAccount2 = new TokenAccount2(user2PublicKey, tokenId);

    const sender = deployer.toPublicKey();

    for (let i = 0; i < NUMBER_ITERATIONS; i++) {
      await fetchAccount({ publicKey: sender });
      await fetchAccount({ publicKey: token });
      await fetchAccount({ publicKey: user1PublicKey });
      await fetchAccount({ publicKey: user1PublicKey, tokenId });
      await fetchAccount({ publicKey: user2PublicKey });
      await fetchAccount({ publicKey: user2PublicKey, tokenId });
      const value11 = zkTokenAccount1.value1.get();
      const value12 = zkTokenAccount1.value2.get();
      const value21 = zkTokenAccount2.value1.get();
      const value22 = zkTokenAccount2.value2.get();
      console.log(
        "Iteration",
        i,
        "user1",
        "value1",
        value11.toJSON(),
        "value2",
        value12.toJSON()
      );
      console.log(
        "Iteration",
        i,
        "user2",
        "value1",
        value21.toJSON(),
        "value2",
        value22.toJSON()
      );
      expect(value11).toBeDefined();
      expect(value11.toJSON()).toBe((i + NUMBER_ITERATIONS).toString());
      expect(value12).toBeDefined();
      expect(value12.toJSON()).toBe(i.toString());

      expect(value21).toBeDefined();
      expect(value21.toJSON()).toBe((i + NUMBER_ITERATIONS).toString());
      expect(value22).toBeDefined();
      expect(value22.toJSON()).toBe(i.toString());

      const transaction1 = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
        () => {
          zkToken.update(
            Field(i + 1 + NUMBER_ITERATIONS),
            Field(i + 1),
            user1PublicKey
          );
        }
      );
      await transaction1.prove();
      transaction1.sign([deployer]);
      const tx1 = await transaction1.send();
      expect(tx1).toBeDefined();
      expect(tx1.isSuccess).toBe(true);

      const transaction2 = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
        () => {
          zkToken.update(
            Field(i + 1 + NUMBER_ITERATIONS),
            Field(i + 1),
            user2PublicKey
          );
        }
      );
      await transaction2.prove();
      transaction2.sign([deployer]);
      const tx2 = await transaction2.send();
      expect(tx2).toBeDefined();
      expect(tx2.isSuccess).toBe(true);
      console.log("Iteration", i, "done");

      if (!useLocalBlockchain) {
        await tx1.wait({ maxAttempts: 120, interval: 60000 });
        await tx2.wait({ maxAttempts: 120, interval: 60000 });
      }
    }
    Memory.info("after state change 2");
  });

  it("should deploy the new TokenAccount contracta", async () => {
    Memory.info("upgraded");
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined
    )
      return;
    const user3PrivateKey: PrivateKey = PrivateKey.random();
    const user4PrivateKey: PrivateKey = PrivateKey.random();
    const user3PublicKey: PublicKey = user3PrivateKey.toPublicKey();
    const user4PublicKey: PublicKey = user4PrivateKey.toPublicKey();
    user3 = user3PublicKey;
    userPrivateKey3 = user3PrivateKey;
    user4 = user4PublicKey;
    userPrivateKey4 = user4PrivateKey;
    const zkToken = new Token2(token!);
    const sender = deployer.toPublicKey();

    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.mint(user3PublicKey, verificationKey!, Field(3));
      }
    );
    await transaction1.prove();
    transaction1.sign([deployer, user3PrivateKey]);
    const tx1 = await transaction1.send();
    expect(tx1).toBeDefined();
    expect(tx1.isSuccess).toBe(true);

    // We do not need to wait for the transaction to be included in the block
    // Just send next immediately using the same deployer account

    const transaction2 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        AccountUpdate.fundNewAccount(sender);
        zkToken.mint(user4PublicKey, verificationKey!, Field(4));
      }
    );
    await transaction2.prove();
    transaction2.sign([deployer, user4PrivateKey]);
    const tx2 = await transaction2.send();
    expect(tx2).toBeDefined();
    expect(tx2.isSuccess).toBe(true);

    console.log(`deploying the new TokenAccounts...`);
    if (!useLocalBlockchain) {
      await tx1.wait({ maxAttempts: 120, interval: 60000 });
      await tx2.wait({ maxAttempts: 120, interval: 60000 });
    }
  });

  it("should change the state and check the balance of new contracts", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(user3).not.toBeUndefined();
    expect(userPrivateKey3).not.toBeUndefined();
    expect(user4).not.toBeUndefined();
    expect(userPrivateKey4).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user3 === undefined ||
      userPrivateKey3 === undefined ||
      user4 === undefined ||
      userPrivateKey4 === undefined
    )
      return;
    const user1PublicKey: PublicKey = user3;
    const user2PublicKey: PublicKey = user4;
    const zkToken = new Token2(token);
    const tokenId = zkToken.token.id;
    const zkTokenAccount1 = new TokenAccount(user1PublicKey, tokenId);
    const zkTokenAccount2 = new TokenAccount(user2PublicKey, tokenId);

    const sender = deployer.toPublicKey();

    for (let i = 0; i < NUMBER_ITERATIONS; i++) {
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
        "hasAccount3",
        hasAccount1,
        "value3",
        value1.toJSON(),
        "hasAccount4",
        hasAccount2,
        "value4",
        value2.toJSON()
      );
      expect(value1).toBeDefined();
      expect(value1.toJSON()).toBe(i.toString());
      expect(value2).toBeDefined();
      expect(value2.toJSON()).toBe(i.toString());

      const transaction1 = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
        () => {
          zkToken.update(Field(i + 1), Field(6), user1PublicKey);
        }
      );
      await transaction1.prove();
      transaction1.sign([deployer]);
      const tx1 = await transaction1.send();
      expect(tx1).toBeDefined();
      expect(tx1.isSuccess).toBe(true);

      const transaction2 = await Mina.transaction(
        { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
        () => {
          zkToken.update(Field(i + 1), Field(6), user2PublicKey);
        }
      );
      await transaction2.prove();
      transaction2.sign([deployer]);
      const tx2 = await transaction2.send();
      expect(tx2).toBeDefined();
      expect(tx2.isSuccess).toBe(true);

      if (!useLocalBlockchain) {
        await tx1.wait({ maxAttempts: 120, interval: 60000 });
        await tx2.wait({ maxAttempts: 120, interval: 60000 });
      }
    }
  });
});
