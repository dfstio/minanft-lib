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
} from "o1js";

// Private key of the deployer:
import { DEPLOYER, NFT_TEST_SK } from "../env.json";

// True - local blockchain, false - Berkeley
const useLocalBlockchain: boolean = true;
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
  @state(Field) value = State<Field>();
  @state(Field) version = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
    });
  }

  init() {
    super.init();
    this.version.set(Field(1));
    this.value.set(Field(23));
  }

  @method update(value: Field) {
    this.value.getAndRequireEquals();
    this.value.set(value);
  }

  @method upgrade(verificationKey: VerificationKey, signature: Signature) {
    const version = this.version.getAndRequireEquals();
    signature
      .verify(this.address, [verificationKey.hash, version])
      .assertEquals(true);
    this.account.verificationKey.set(verificationKey);
    this.version.set(version.add(Field(1)));
  }
}

class Token2 extends SmartContract {
  @state(Field) value1 = State<Field>();
  @state(Field) version = State<Field>();
  @state(Field) value2 = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
    });
  }
  @method update(value1: Field, value2: Field) {
    this.value1.getAndRequireEquals();
    this.value2.getAndRequireEquals();
    this.value1.set(value1);
    this.value2.set(value2);
  }

  @method upgrade(verificationKey: VerificationKey, signature: Signature) {
    const version = this.version.getAndRequireEquals();
    signature.verify(this.address, [verificationKey.hash, version]);
    this.account.verificationKey.set(verificationKey);
    this.version.set(version.add(Field(1)));
  }
}

let token: PublicKey | undefined = undefined;
let tokenPrivateKey: PrivateKey | undefined = undefined;
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
  await Token.compile();
});

describe("Mint tokens", () => {
  it("should deploy a Token contract", async () => {
    expect(deployer).not.toBeUndefined();
    if (deployer === undefined) return;

    const zkAppTokenPrivateKey = PrivateKey.random();
    const zkAppTokenPublicKey = zkAppTokenPrivateKey.toPublicKey();
    token = zkAppTokenPublicKey;
    tokenPrivateKey = zkAppTokenPrivateKey;

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
        zkToken.deploy({ zkappKey: tokenPrivateKey });
        zkToken.account.tokenSymbol.set(tokenSymbol);
        zkToken.account.zkappUri.set("https://minanft.io");
      }
    );
    await transaction.prove();
    transaction.sign([deployer, tokenPrivateKey]);
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
  });

  it("should set the value", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined
    )
      return;
    const zkToken = new Token(token!);
    const sender = deployer.toPublicKey();

    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        zkToken.update(Field(1));
      }
    );
    await transaction1.prove();
    transaction1.sign([deployer]);
    const tx1 = await transaction1.send();

    console.log(`setting value...`);
    if (!useLocalBlockchain) {
      await tx1.wait({ maxAttempts: 120, interval: 60000 });
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
    const zkToken = new Token(token);
    const signature = Signature.create(tokenPrivateKey, [
      vkToken2.hash,
      Field(1),
    ]);

    const transaction = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        zkToken.upgrade(vkToken2, signature);
        //zkToken.account.zkappUri.set("https://minanft.io/v2");
      }
    );
    await transaction.prove();
    transaction.sign([deployer]);
    const tx = await transaction.send();
    console.log(
      `upgrading the Token contract on address ${token.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`
      //transaction.toPretty()
    );
    if (!useLocalBlockchain)
      await tx.wait({ maxAttempts: 120, interval: 60000 });
  });

  it("should set the value1 and value2", async () => {
    expect(deployer).not.toBeUndefined();
    expect(token).not.toBeUndefined();
    expect(tokenPrivateKey).not.toBeUndefined();
    if (
      deployer === undefined ||
      tokenPrivateKey === undefined ||
      token === undefined
    )
      return;
    const zkToken = new Token2(token!);
    const sender = deployer.toPublicKey();

    const transaction1 = await Mina.transaction(
      { sender, fee: transactionFee, memo: "minanft.io", nonce: nonce++ },
      () => {
        zkToken.update(Field(3), Field(4));
      }
    );
    await transaction1.prove();
    transaction1.sign([deployer]);
    const tx1 = await transaction1.send();

    console.log(`setting values...`);
    if (!useLocalBlockchain) {
      await tx1.wait({ maxAttempts: 120, interval: 60000 });
    }
  });
});
