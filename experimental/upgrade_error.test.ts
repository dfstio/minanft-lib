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

const transactionFee = 150_000_000;
jest.setTimeout(1000 * 60 * 60 * 10); // 10 hours
let deployer: PrivateKey | undefined = undefined;

class Token extends SmartContract {
  @state(Field) value = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method update(value: Field) {
    this.value.set(value);
  }
}

class Token2 extends SmartContract {
  @state(Field) value1 = State<Field>();
  @state(Field) value2 = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }

  @method update(value1: Field, value2: Field) {
    this.value1.set(value1);
    this.value2.set(value2);
  }
}

let token: PublicKey | undefined = undefined;
let tokenPrivateKey: PrivateKey | undefined = undefined;
let nonce: number = 0;

beforeAll(async () => {
  const Local = Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);
  deployer = Local.testAccounts[0].privateKey;
  await Token.compile();
});

describe("Upgrade the SmartContract using Signature", () => {
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
      }
    );
    await transaction.prove();
    transaction.sign([deployer, tokenPrivateKey]);
    const tx = await transaction.send();
    console.log(
      `deploying the Token contract to an address ${zkAppTokenPublicKey.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`
    );
    expect(tx).toBeDefined();
    expect(tx.isSuccess).toBe(true);
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
    console.log(
      `upgrading the Token contract on address ${token.toBase58()}
using the deployer with public key ${sender.toBase58()}:
`,
      transaction.toPretty()
    );
    expect(tx).toBeDefined();
    expect(tx.isSuccess).toBe(true);
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
  });
});
