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

  @method checkPass(address: PublicKey, tokenId: Field) {
    const version = this.version.getAndRequireEquals();
    version.assertEquals(Field(1));
    const token = new TokenAccount(address, tokenId);
    const value = token.value.get();
    value.assertEquals(Field(1));
  }

  @method checkFail(address: PublicKey, tokenId: Field) {
    const version = this.version.getAndRequireEquals();
    version.assertEquals(Field(1));
    const token = new TokenAccount(address, tokenId);
    // If you comment next two lines, the test will pass
    const value = token.value.getAndRequireEquals();
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

let token: PublicKey | undefined = undefined;
let tokenPrivateKey: PrivateKey | undefined = undefined;
let user1: PublicKey | undefined = undefined;
let userPrivateKey1: PrivateKey | undefined = undefined;
let tokenVerificationKey: VerificationKey | undefined = undefined;
let tokenAccountVerificationKey: VerificationKey | undefined = undefined;
let nonce: number = 0;

beforeAll(async () => {
  const Local = Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);
  deployer = Local.testAccounts[0].privateKey;
  const { verificationKey: vk1 } = await TokenAccount.compile();
  tokenAccountVerificationKey = vk1;
  const { verificationKey: vk2 } = await Token.compile();
  tokenVerificationKey = vk2;
});

describe("Access token account", () => {
  it("should deploy a Token contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const zkAppTokenPrivateKey = PrivateKey.random();
    const zkAppTokenPublicKey = zkAppTokenPrivateKey.toPublicKey();
    userPrivateKey1 = PrivateKey.random();
    user1 = userPrivateKey1.toPublicKey();

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
        zkToken.version.set(Field(1));
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

    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user1 === undefined ||
      userPrivateKey1 === undefined
    )
      return;
    const user1PublicKey: PublicKey = user1;
    const user1PrivateKey: PrivateKey = userPrivateKey1;
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
  });

  it("should check values using get()", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(user1).not.toBeUndefined();
    expect(userPrivateKey1).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user1 === undefined ||
      userPrivateKey1 === undefined
    )
      return;
    const user1PublicKey: PublicKey = user1;
    const user1PrivateKey: PrivateKey = userPrivateKey1;
    const zkToken = new Token(token!);
    const tokenId = zkToken.token.id;
    const sender = deployer.toPublicKey();

    const tokenAccount1 = new TokenAccount(user1PublicKey, tokenId);
    await fetchAccount({ publicKey: user1PublicKey, tokenId });
    const value1 = tokenAccount1.value.get();
    expect(value1).toBeDefined();
    if (value1 === undefined) return;
    expect(value1.toBigInt()).toEqual(BigInt(1));

    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        zkToken.checkPass(user1PublicKey, tokenId);
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
  });

  it("should check values using getAndRequireEquals()", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    expect(user1).not.toBeUndefined();
    expect(userPrivateKey1).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined ||
      user1 === undefined ||
      userPrivateKey1 === undefined
    )
      return;
    const user1PublicKey: PublicKey = user1;
    const user1PrivateKey: PrivateKey = userPrivateKey1;
    const zkToken = new Token(token!);
    const tokenId = zkToken.token.id;
    const sender = deployer.toPublicKey();

    const tokenAccount1 = new TokenAccount(user1PublicKey, tokenId);
    await fetchAccount({ publicKey: user1PublicKey, tokenId });
    const value1 = tokenAccount1.value.get();
    expect(value1).toBeDefined();
    if (value1 === undefined) return;
    expect(value1.toBigInt()).toEqual(BigInt(1));

    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        zkToken.checkFail(user1PublicKey, tokenId);
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
  });
});
